# Solana Handler - API Marketplace Payment System

This is the Solana-native payment handler for the AiPI marketplace. It replaces the previous x402/Ethereum implementation.

## Features

- ✅ Manual Solana transaction verification
- ✅ SPL Token (USDC) transfers for earnings claims
- ✅ IPFS integration for API metadata
- ✅ MongoDB for API listings and usage analytics
- ✅ Solana devnet and mainnet-beta support

## Prerequisites

- Node.js v18+
- Solana CLI tools (optional, for keypair generation)
- MongoDB Atlas account
- Pinata/IPFS access
- Solana wallet with USDC for testing

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Generate Solana Keypair

```bash
# Using Solana CLI
solana-keygen new --outfile wallet.json

# Get public key
solana-keygen pubkey wallet.json

# Export private key as base58
solana-keygen export --outfile key.json wallet.json
```

## Usage

### Start Server

```bash
npm start

# Or with auto-reload
npm run dev
```

Server runs on `http://localhost:4021`

## API Endpoints

### Payment Flow

#### 1. Get Payment Info
```http
GET /aipi/payment-info?id=<IPFS_CID>
```

Returns payment requirements:
```json
{
  "paymentRequired": true,
  "recipient": "7xKp...xyz",
  "amount": 0.01,
  "token": "USDC",
  "tokenMint": "Gh9Z...xyz",
  "apiCid": "QmXxx...",
  "requestId": "uuid",
  "description": "Payment for API call"
}
```

#### 2. Make Paid API Call
```http
POST /aipi/
Content-Type: application/json

{
  "cid": "<IPFS_CID>",
  "signature": "<solana_transaction_signature>",
  "requestId": "<uuid>",
  "data": {} // optional POST data for API
}
```

### Management Endpoints

#### Store Listing
```http
POST /store-listing
{
  "cid": "QmXxx...",
  "ownerId": "SolanaPublicKey...",
  "earning": 0
}
```

#### Get Listings
```http
GET /listings
```

#### Generate API Key
```http
POST /keygen
{
  "cid": "QmXxx..."
}
```

#### Get Usage Stats
```http
GET /usage/:apiId
```

#### Claim Earnings
```http
POST /claim
{
  "apiId": "QmXxx..."
}
```

Returns:
```json
{
  "success": true,
  "signature": "5x7k...",
  "amount": 10.5,
  "to": "Owner's Solana address",
  "explorer": "https://explorer.solana.com/tx/..."
}
```

#### Get Earnings by Owner
```http
POST /earnings
{
  "address": "SolanaPublicKey..."
}
```

#### Check USDC Balance
```http
GET /balance/:address
```

#### Health Check
```http
GET /health
```

Returns Solana connection status.

## Payment Verification

The system verifies Solana transactions by:

1. Fetching transaction from blockchain
2. Checking transaction age (max 5 minutes)
3. Verifying transaction success
4. Parsing SPL token transfers
5. Matching recipient and amount

## Security

- Payment signatures are verified on-chain
- Private keys stored in environment variables
- MongoDB API key authentication
- CORS enabled for cross-origin requests

## Migration from Ethereum

This replaces:
- ❌ `x402-express` → ✅ Manual verification
- ❌ `ethers.js` → ✅ `@solana/web3.js`
- ❌ EVM addresses → ✅ Solana public keys (base58)
- ❌ base-sepolia → ✅ Solana devnet/mainnet

## Testing

### 1. Get Devnet USDC

Request airdrop from Solana faucet or use:
```bash
spl-token create-account Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
```

### 2. Test Payment Flow

1. Get payment info from `/aipi/payment-info`
2. Make USDC transfer using Phantom wallet or CLI
3. Submit transaction signature to `/aipi/`
4. Verify API response

### 3. Test Claims

1. Accumulate earnings
2. Call `/claim` endpoint
3. Check Solana Explorer for transaction

## Troubleshooting

### "Recipient does not have a USDC token account"

User needs to create associated token account:
```bash
spl-token create-account <USDC_MINT>
```

### "Transaction not found"

- Transaction not confirmed yet (wait a few seconds)
- Wrong network (check devnet vs mainnet)
- Invalid signature format

### "Payment verification failed"

- Amount mismatch
- Wrong recipient
- Transaction too old (>5 minutes)
- Transaction failed on-chain

## License

ISC
