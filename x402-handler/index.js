import express from "express";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

import fs from 'fs';
import crypto from 'crypto';
import { getJsonFromIpfs } from './lib/ipfs.js';
import { generateApiKeyFromUuid } from './lib/keygen.js';
import { listApis, storeApi, logUsage, getUsageLogsByApiId, getApiIdsByOwner } from './lib/mongodb.js';
import { 
  verifyPaymentTransaction, 
  transferUSDC, 
  getUSDCBalance,
  isValidSolanaAddress,
  getConnection
} from './lib/solana.js';

const UUID_SEQ_FILE = process.cwd() + '/uuid-seq.json';

// In-memory storage fallback if MongoDB is not configured
const IN_MEMORY_STORAGE = {
  apis: [],
  usageLogs: []
};

const USE_MEMORY_STORAGE = !process.env.MONGODB_API_KEY || process.env.MONGODB_API_KEY === 'your_mongodb_api_key';

if (USE_MEMORY_STORAGE) {
  console.log('⚠️  Using in-memory storage (data will be lost on restart)');
  console.log('💡 To use persistent storage, configure MongoDB in .env file');
}

app.post('/store-listing', async (req, res) => {
  const { cid, ownerId, earning = 0 } = req.body;
  if (!cid) {
    return res.status(400).json({ error: 'CID is required' });
  }
  try {
    if (USE_MEMORY_STORAGE) {
      // In-memory storage
      const api = {
        _id: crypto.randomUUID(),
        cid,
        ownerId: ownerId?.toLowerCase()?.trim()?.toString() || '',
        earning,
        createdAt: new Date().toISOString()
      };
      IN_MEMORY_STORAGE.apis.push(api);
      console.log('✅ Stored API in memory:', api);
      res.json({ success: true, id: api._id });
    } else {
      // MongoDB storage
      const insertedId = await storeApi({ cid, ownerId, earning });
      res.json({ success: true, id: insertedId });
    }
  } catch (err) {
    console.error('Error storing API:', err);
    res.status(500).json({ error: 'Failed to store API' });
  }
});

app.get('/listings', async (req, res) => {
  try {
    if (USE_MEMORY_STORAGE) {
      // Return in-memory storage
      const apis = IN_MEMORY_STORAGE.apis.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      console.log('📋 Fetching listings from memory:', apis.length, 'APIs');
      res.json({ listings: apis });
    } else {
      // MongoDB storage
      const apis = await listApis();
      res.json({ listings: apis });
    }
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: 'Could not read APIs from database' });
  }
});

app.get("/test-api", async (req, res) => {
  console.log("logger")
 res.send({
   report: {
     status: "success",
     data:"hello world"
   },
 });
});
// NEW: Solana-based payment flow
// Step 1: Get payment requirements for an API
app.get("/fluxapi/payment-info", async (req, res) => {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const cid = searchParams.get("id");

  if (!cid) {
    return res.status(400).json({ error: "Missing CID" });
  }

  try {
    const api = await getJsonFromIpfs(cid);
    if (!api) {
      return res.status(404).json({ error: "Cannot find API" });
    }

    const requestId = crypto.randomUUID();
    
    res.json({
      paymentRequired: true,
      recipient: process.env.SOLANA_PAYMENT_WALLET,
      amount: api.costPerRequest,
      token: "USDC",
      tokenMint: process.env.SOLANA_USDC_MINT || "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr", // Devnet USDC
      apiCid: cid,
      requestId,
      description: `Payment for ${api.name || 'API'} call`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch API info' });
  }
});

// Step 2: Make API call with payment verification
app.post("/fluxapi/", async (req, res) => {
  const { cid, signature, requestId, data } = req.body;

  if (!cid) {
    return res.status(400).json({ error: "Missing CID" });
  }

  try {
    const api = await getJsonFromIpfs(cid);
    if (!api) {
      return res.status(404).json({ error: "Cannot find API" });
    }

    // Verify payment if signature provided
    if (signature) {
      const paymentRecipient = process.env.SOLANA_PAYMENT_WALLET;
      const expectedAmount = api.costPerRequest;

      const verification = await verifyPaymentTransaction(
        signature,
        paymentRecipient,
        expectedAmount,
        300 // 5 minutes max age
      );

      if (!verification.valid) {
        return res.status(402).json({ 
          error: 'Payment verification failed',
          details: verification.error
        });
      }

      // Payment verified, proceed with API call
      let apiKey = generateApiKeyFromUuid(api.id);
      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers["x-fluxapi-access-code"] = apiKey;

      let responseStatus = 200;
      let responseTimeMs = 0;
      let start = Date.now();

      try {
        let response;
        if (data) {
          response = await fetch(api.endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(data),
          });
        } else {
          response = await fetch(api.endpoint, { 
            headers: apiKey ? { "x-api-key": apiKey } : undefined 
          });
        }
        
        responseStatus = response.status;
        responseTimeMs = Date.now() - start;
        const responseData = await response.json();
        
        // Log usage with Solana signature
        if (api._id) {
          await logUsage({ 
            apiId: api._id.$oid || api._id, 
            responseStatus, 
            responseTimeMs,
            paymentSignature: signature,
            paymentAmount: expectedAmount
          });
        }

        res.json({
          success: true,
          data: responseData,
          payment: {
            signature,
            amount: expectedAmount,
            verified: true
          }
        });

      } catch (err) {
        responseStatus = 500;
        responseTimeMs = Date.now() - start;
        
        if (api._id) {
          await logUsage({ 
            apiId: api._id.$oid || api._id, 
            responseStatus, 
            responseTimeMs 
          });
        }
        
        res.status(500).json({ error: 'API call failed', details: err.message });
      }

    } else {
      // No payment signature provided
      return res.status(402).json({ 
        error: 'Payment required',
        message: 'Please submit a valid payment transaction signature',
        paymentInfo: {
          recipient: process.env.SOLANA_PAYMENT_WALLET,
          amount: api.costPerRequest,
          token: "USDC"
        }
      });
    }

  } catch (err) {
    res.status(500).json({ error: 'Request processing failed', details: err.message });
  }
});

app.get("/api/health/:id", async (req, res) => {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const cid = searchParams.get("id");
  console.log(cid);
  const api = await getJsonFromIpfs(cid);
  if (!cid) {
    return res.status(400).json({ error: "Missing CID" });
  }
  if (!api) {
    return res.status(404).json({ error: "Cannot find API" });
  }
  let apiKey = generateApiKeyFromUuid(api.id);
  const headers = apiKey ? { "x-api-key": apiKey } : undefined;
  fetch(api.endpoint + '/health', { headers }).then(response => {
    if (response.ok) {
      res.send({
        report: {
          status: "online",
        },
      });
    } else {
      res.send({
        report: {
          status: "offline",
        },
      });
    }
  });  
});

app.post('/keygen', async (req, res) => {
  const { cid } = req.body;
  if (!cid) {
    return res.status(400).json({ error: 'CID is required' });
  }
  let seq = 1;
  if (fs.existsSync(UUID_SEQ_FILE)) {
    try {
      seq = JSON.parse(fs.readFileSync(UUID_SEQ_FILE, 'utf8'));
      if (typeof seq !== 'number' || !Number.isFinite(seq)) seq = 1;
    } catch {
      seq = 1;
    }
  }
  const randomStr = Math.random().toString(36).slice(2, 10) + crypto.randomBytes(4).toString('hex');
  const uuid = `fluxapi-${seq}-${randomStr}`;
  fs.writeFileSync(UUID_SEQ_FILE, String(seq + 1));
  let apiKey = generateApiKeyFromUuid(uuid);
  res.json({ apiKey, uuid });
});

app.get('/usage/:apiId', async (req, res) => {
  const { apiId } = req.params;
  if (!apiId) {
    return res.status(400).json({ error: 'apiId is required' });
  }
  try {
    const logs = await getUsageLogsByApiId(apiId, 1000);
    const formatted = logs.map(log => ({
      timestamp: log.timestamp,
      responseStatus: log.responseStatus,
      responseTimeMs: log.responseTimeMs
    }));
    res.json({ apiId, usage: formatted ,usageCount: logs.length});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch usage logs' });
  }
});

// Function to add mock usage stats for a given API
async function addMockUsageStats(apiId, count = 50) {
  for (let i = 0; i < count; i++) {
    const responseStatus = [200, 201, 400, 401, 403, 404, 500][Math.floor(Math.random() * 7)];
    const responseTimeMs = Math.floor(Math.random() * 800) + 100; // 100-900ms
    await logUsage(apiId, responseStatus, responseTimeMs);
  }
  return count;
}

// Endpoint to trigger mock usage stat insertion
app.get('/mock-usage/:apiId', async (req, res) => {
  const { apiId } = req.params;
  if (!apiId) return res.status(400).json({ error: 'apiId is required' });
  const inserted = await addMockUsageStats(apiId);
  res.json({ message: `Inserted ${inserted} mock usage logs for ${apiId}` });
});

app.post('/claim', async (req, res) => {
  const { apiId } = req.body;
  if (!apiId) {
    return res.status(400).json({ error: 'apiId is required' });
  }
  
  try {
    const { getApiByCid } = await import('./lib/mongodb.js');
    
    // Get API by CID
    const api = await getApiByCid(apiId);
    if (!api) return res.status(404).json({ error: 'API not found' });
    
    const earning = api.earning || 0;
    const to = api.ownerId;
    
    // Validate Solana address
    if (!isValidSolanaAddress(to)) {
      return res.status(400).json({ error: 'Invalid owner Solana address' });
    }
    
    if (earning <= 0) {
      return res.status(400).json({ error: 'No earnings to claim' });
    }

    // Transfer USDC on Solana
    try {
      const signature = await transferUSDC(to, earning);
      
      // Reset earnings to 0
      const fetch = (await import('node-fetch')).default;
      const ENDPOINT = process.env.MONGODB_ENDPOINT;
      const DB = process.env.MONGODB_DATABASE_NAME;
      const dataSource = process.env.MONGODB_DATA_SOURCE;
      const APIS_COLLECTION = 'apis';
      
      await fetch(`${ENDPOINT}/action/updateOne`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Request-Headers': '*',
          'api-key': process.env.MONGODB_API_KEY,
        },
        body: JSON.stringify({
          collection: APIS_COLLECTION,
          database: DB,
          dataSource: dataSource,
          filter: { cid: apiId },
          update: { "$set": { earning: 0 } },
        }),
      });
      
      res.json({ 
        success: true, 
        signature, 
        amount: earning, 
        to,
        explorer: `https://explorer.solana.com/tx/${signature}?cluster=${process.env.SOLANA_CLUSTER || 'devnet'}`
      });
      
    } catch (transferError) {
      res.status(500).json({ 
        error: 'USDC transfer failed', 
        details: transferError.message 
      });
    }
    
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to claim earnings' });
  }
});

app.post('/earnings', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'address is required' });
  }
  
  // Validate Solana address
  if (!isValidSolanaAddress(address)) {
    return res.status(400).json({ error: 'Invalid Solana address' });
  }
  
  try {
    const apiIds = await getApiIdsByOwner(address);
    res.json({ apiIds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// NEW: Check USDC balance for a Solana address
app.get('/balance/:address', async (req, res) => {
  const { address } = req.params;
  
  if (!isValidSolanaAddress(address)) {
    return res.status(400).json({ error: 'Invalid Solana address' });
  }
  
  try {
    const balance = await getUSDCBalance(address);
    res.json({ 
      address, 
      balance, 
      token: 'USDC' 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// NEW: Health check with Solana connection status
app.get('/health', async (req, res) => {
  try {
    const connection = getConnection();
    const slot = await connection.getSlot();
    res.json({
      status: 'healthy',
      blockchain: 'solana',
      cluster: process.env.SOLANA_CLUSTER || 'devnet',
      currentSlot: slot,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

app.listen(4021, () => {
  console.log(`Server listening at http://localhost:4021`);
});
