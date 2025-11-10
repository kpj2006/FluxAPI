import { Connection, PublicKey, clusterApiUrl, Keypair } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  getAccount
} from '@solana/spl-token';
import bs58 from 'bs58';

// USDC Mint Address on Solana Devnet
const USDC_MINT_DEVNET = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
// For mainnet-beta, use: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

/**
 * Initialize Solana connection
 */
export function getConnection() {
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Get Keypair from environment variable
 */
export function getKeypairFromEnv() {
  const privateKeyString = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKeyString) {
    throw new Error('SOLANA_PRIVATE_KEY not set in environment');
  }
  
  try {
    // Support both base58 and JSON array formats
    let secretKey;
    if (privateKeyString.startsWith('[')) {
      // JSON array format: [123, 45, 67, ...]
      secretKey = new Uint8Array(JSON.parse(privateKeyString));
    } else {
      // Base58 format
      secretKey = bs58.decode(privateKeyString);
    }
    return Keypair.fromSecretKey(secretKey);
  } catch (error) {
    throw new Error(`Failed to parse SOLANA_PRIVATE_KEY: ${error.message}`);
  }
}

/**
 * Get USDC mint address based on cluster
 */
export function getUsdcMint() {
  const cluster = process.env.SOLANA_CLUSTER || 'devnet';
  if (cluster === 'mainnet-beta') {
    return new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  }
  return USDC_MINT_DEVNET;
}

/**
 * Verify a Solana transaction for payment
 * 
 * @param {string} signature - Transaction signature to verify
 * @param {string} expectedRecipient - Expected recipient public key
 * @param {number} expectedAmount - Expected amount in USDC (e.g., 0.01)
 * @param {number} maxAgeSeconds - Maximum age of transaction in seconds (default: 300 = 5 minutes)
 * @returns {Promise<{valid: boolean, error?: string, transaction?: any}>}
 */
export async function verifyPaymentTransaction(
  signature, 
  expectedRecipient, 
  expectedAmount, 
  maxAgeSeconds = 300
) {
  try {
    const connection = getConnection();
    const usdcMint = getUsdcMint();
    
    // Fetch transaction
    const transaction = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });
    
    if (!transaction) {
      return { valid: false, error: 'Transaction not found or not confirmed' };
    }
    
    // Check transaction age
    const txTime = transaction.blockTime;
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - txTime > maxAgeSeconds) {
      return { valid: false, error: 'Transaction too old' };
    }
    
    // Check if transaction was successful
    if (transaction.meta?.err) {
      return { valid: false, error: 'Transaction failed on chain' };
    }
    
    // Parse token transfer from transaction
    const { preTokenBalances, postTokenBalances } = transaction.meta;
    
    if (!preTokenBalances || !postTokenBalances) {
      return { valid: false, error: 'No token balances found in transaction' };
    }
    
    // Find USDC transfers
    let recipientReceived = 0;
    const recipientPubkey = new PublicKey(expectedRecipient);
    
    for (let i = 0; i < postTokenBalances.length; i++) {
      const post = postTokenBalances[i];
      const pre = preTokenBalances.find(p => p.accountIndex === post.accountIndex);
      
      // Check if this is a USDC account
      if (post.mint !== usdcMint.toBase58()) continue;
      
      // Get the account owner
      const accountPubkey = transaction.transaction.message.accountKeys[post.accountIndex];
      
      // Check if this account belongs to recipient
      try {
        const tokenAccount = await getAssociatedTokenAddress(
          usdcMint,
          recipientPubkey
        );
        
        if (accountPubkey.toBase58() === tokenAccount.toBase58()) {
          // Calculate amount received (USDC has 6 decimals)
          const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmount) : 0;
          const postAmount = parseFloat(post.uiTokenAmount.uiAmount);
          recipientReceived = postAmount - preAmount;
          break;
        }
      } catch (error) {
        // Continue checking other accounts
        continue;
      }
    }
    
    // Verify amount (allow small rounding differences)
    const amountDiff = Math.abs(recipientReceived - expectedAmount);
    if (amountDiff > 0.000001) { // 0.000001 USDC tolerance
      return { 
        valid: false, 
        error: `Amount mismatch: expected ${expectedAmount}, got ${recipientReceived}` 
      };
    }
    
    return { 
      valid: true, 
      transaction: {
        signature,
        timestamp: txTime,
        amount: recipientReceived,
        recipient: expectedRecipient
      }
    };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Transfer USDC using SPL Token
 * 
 * @param {string} toAddress - Recipient Solana public key
 * @param {number} amount - Amount in USDC (e.g., 10.5 for 10.5 USDC)
 * @returns {Promise<string>} Transaction signature
 */
export async function transferUSDC(toAddress, amount) {
  try {
    const connection = getConnection();
    const wallet = getKeypairFromEnv();
    const usdcMint = getUsdcMint();
    const recipient = new PublicKey(toAddress);
    
    // Get associated token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      wallet.publicKey
    );
    
    const toTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      recipient
    );
    
    // Check if recipient token account exists
    try {
      await getAccount(connection, toTokenAccount);
    } catch (error) {
      throw new Error(
        'Recipient does not have a USDC token account. ' +
        'They need to create one first or you need to create it for them.'
      );
    }
    
    // Convert amount to smallest unit (USDC has 6 decimals)
    const amountInSmallestUnit = BigInt(Math.floor(amount * 1_000_000));
    
    // Create transfer instruction
    const transferInstruction = createTransferCheckedInstruction(
      fromTokenAccount,
      usdcMint,
      toTokenAccount,
      wallet.publicKey,
      amountInSmallestUnit,
      6, // USDC decimals
      [],
      TOKEN_PROGRAM_ID
    );
    
    // Create and send transaction
    const { Transaction } = await import('@solana/web3.js');
    const transaction = new Transaction().add(transferInstruction);
    
    const signature = await connection.sendTransaction(transaction, [wallet], {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
    
  } catch (error) {
    throw new Error(`USDC transfer failed: ${error.message}`);
  }
}

/**
 * Get USDC balance for a public key
 * 
 * @param {string} publicKey - Solana public key
 * @returns {Promise<number>} Balance in USDC
 */
export async function getUSDCBalance(publicKey) {
  try {
    const connection = getConnection();
    const usdcMint = getUsdcMint();
    const pubkey = new PublicKey(publicKey);
    
    const tokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      pubkey
    );
    
    const accountInfo = await getAccount(connection, tokenAccount);
    return Number(accountInfo.amount) / 1_000_000; // Convert to USDC
    
  } catch (error) {
    return 0; // Account doesn't exist or has no USDC
  }
}

/**
 * Check if an address is a valid Solana public key
 * 
 * @param {string} address - Address to validate
 * @returns {boolean}
 */
export function isValidSolanaAddress(address) {
  try {
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey.toBytes());
  } catch {
    return false;
  }
}
