"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Loader2 } from "lucide-react";

function EarnContent() {
  const { publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiList, setApiList] = useState<any[]>([]);
  const [selectedApi, setSelectedApi] = useState<any | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Set mounted state to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch earnings when wallet is connected
  useEffect(() => {
    if (mounted && publicKey) {
      fetchEarnings(publicKey.toBase58());
    } else {
      setApiList([]);
      setSelectedApi(null);
    }
  }, [mounted, publicKey]);

  async function fetchEarnings(address: string) {
    setLoading(true);
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/earnings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await resp.json();
      
      if (data.apiIds && Array.isArray(data.apiIds)) {
        const apisWithMeta = await Promise.all(
          data.apiIds.map(async (api: any) => {
            try {
              const resp = await fetch(`https://gateway.pinata.cloud/ipfs/${api.cid}`);
              const meta = await resp.json();
              return { ...api, ...meta, apiId: api._id || api.apiId, cid: api.cid };
            } catch (e) {
              return { ...api, name: api.cid, error: 'Failed to fetch metadata', apiId: api._id || api.apiId };
            }
          })
        );
        setApiList(apisWithMeta);
        setApiResponse(null);
        if (apisWithMeta.length > 0) setSelectedApi(apisWithMeta[0]);
        else setSelectedApi(null);
      } else {
        setApiList([]);
        setSelectedApi(null);
        setApiResponse("No APIs found");
      }
    } catch (err) {
      setApiResponse("Failed to fetch earnings");
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim() {
    if (!selectedApi) return;
    setClaiming(true);
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId: selectedApi.cid }),
      });
      const result = await resp.json();
      setApiResponse(JSON.stringify(result, null, 2));
      
      // Refresh earnings after successful claim
      if (result.success && publicKey) {
        await fetchEarnings(publicKey.toBase58());
      }
    } catch (err) {
      setApiResponse('Failed to claim earnings');
    } finally {
      setClaiming(false);
    }
  }

  // Prevent hydration mismatch by not rendering wallet-dependent UI until mounted
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="brutalist-container flex flex-col" style={{ width: '100%', maxWidth: 500, margin: '0 auto', padding: 32, background: '#fff', border: '3px solid #000', boxShadow: '4px 4px 0 #000', borderRadius: 12 }}>
        <h2 style={{ fontWeight: 900, fontSize: 28, marginBottom: 24 }}>Earn with FluxAPI</h2>
        <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Connect your Solana wallet to start earning from your APIs.</p>
        
        <div style={{ marginBottom: 20 }}>
          <WalletMultiButton style={{
            fontWeight: 900,
            fontSize: 18,
            border: '3px solid #000',
            background: '#f0f0f0',
            boxShadow: '4px 4px 0 #000',
            borderRadius: 8,
          }} />
        </div>
        
        {publicKey && (
          <div style={{ marginBottom: 16, fontSize: 14, fontWeight: 700 }}>
            Connected Wallet: <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{publicKey.toBase58()}</span>
          </div>
        )}
        
        {loading && (
          <div style={{ textAlign: 'center', padding: 16 }}>Loading earnings...</div>
        )}
        
        {apiList.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <label htmlFor="api-dropdown" style={{ fontWeight: 700, marginBottom: 8, display: 'block' }}>Select an API to claim earnings:</label>
            <select
              id="api-dropdown"
              value={selectedApi ? selectedApi.apiId : ''}
              onChange={e => {
                const found = apiList.find(api => String(api.apiId) === String(e.target.value));
                setSelectedApi(found || null);
              }}
              style={{ padding: 8, fontSize: 16, borderRadius: 4, border: '2px solid #000', width: '100%', marginBottom: 16 }}
            >
              <option value="" disabled>Select API</option>
              {apiList.map(api => (
                <option key={api.apiId} value={api.apiId}>
                  {api.name || api.cid} (Earnings: {api.earning ?? 0} USDC)
                </option>
              ))}
            </select>
            <button
              disabled={!selectedApi || claiming}
              style={{
                padding: '12px 24px',
                fontWeight: 800,
                fontSize: 16,
                border: '2px solid #000',
                background: '#e0ffe0',
                borderRadius: 6,
                cursor: !selectedApi || claiming ? 'not-allowed' : 'pointer',
                marginBottom: 12,
                width: '100%',
              }}
              onClick={handleClaim}
            >
              {claiming ? 'Claiming...' : 'Claim Earnings'}
            </button>
          </div>
        )}
        
        {!loading && publicKey && apiList.length === 0 && !apiResponse && (
          <div style={{ textAlign: 'center', padding: 16, color: '#666' }}>
            No APIs found for this wallet. List an API to start earning!
          </div>
        )}
        
        {apiResponse && (
          <pre style={{ background: '#f8f8f8', padding: 16, border: '2px solid #000', borderRadius: 8, fontSize: 13, marginTop: 16, overflow: 'auto' }}>{apiResponse}</pre>
        )}
      </div>
    </div>
  );
}

export default function Earn() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <EarnContent />;
}

