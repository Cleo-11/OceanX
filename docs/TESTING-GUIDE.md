# Marketplace Sign-Only Claim Testing Guide (Sepolia)

## Overview
This guide walks through testing the complete "user pays" marketplace claim flow on Ethereum Sepolia testnet.

**Flow Summary:**
1. Backend generates EIP-712 signature (does NOT submit tx)
2. Client receives signature and submits `OCXToken.claim(...)` transaction (pays gas)
3. Client posts txHash to backend for verification and DB finalization

---

## Prerequisites

### 1. Environment Setup (`server/.env`)

Create or update `server/.env` with the following values:

```bash
# Blockchain Configuration
RPC_URL=https://sepolia.infura.io/v3/a52d834f9c2c425f815099e9819a360b
CHAIN_ID=11155111
TOKEN_CONTRACT_ADDRESS=0x3282E5D599b2A19c59C2c89EC9BDe5b5ad0F257E

# Backend Signer (MUST match authorizedSigner in contract)
BACKEND_PRIVATE_KEY=0xf679fc3342dfcb4d70f87357103aaffd03cb56caf3211432aa5068ca1ae7c664
BACKEND_SIGNER_ADDRESS=0x14Ac0ceB3fF8858358b487F6A24553fa3a04407b

# Supabase (if using DB)
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-supabase-key>

# Server
PORT=5000
NODE_ENV=development
```

### 2. Test Wallet Configuration

**Test Player Wallet:** `0x5711b49b29680c1eabb3e3eb6c191d4db70c853c`

**Requirements:**
- Must have Sepolia ETH for gas (~0.01 ETH recommended)
- Get Sepolia ETH from faucet: https://sepoliafaucet.com/

### 3. Contract Verification

Verify the contract is deployed and configured correctly:

```bash
# Check contract exists
curl https://sepolia.infura.io/v3/a52d834f9c2c425f815099e9819a360b \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x3282E5D599b2A19c59C2c89EC9BDe5b5ad0F257E","latest"],"id":1}'

# Result should NOT be "0x" (that means no contract)
```

**Verify authorizedSigner:**
The contract constructor must have set `authorizedSigner = 0x14Ac0ceB3fF8858358b487F6A24553fa3a04407b` (matches BACKEND_PRIVATE_KEY).

### 4. Database Setup (Optional)

If using Supabase, create the `trades` table:

```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  wallet_address TEXT NOT NULL,
  resource_type TEXT,
  resource_amount INTEGER,
  ocx_amount TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
  tx_hash TEXT,
  nonce TEXT,
  deadline BIGINT,
  block_number BIGINT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_trades_wallet ON trades(wallet_address);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_tx_hash ON trades(tx_hash);
```

---

## Testing Steps

### Step 1: Start Backend Server

```bash
cd server
npm install  # If not already done
node index.js
```

**Expected output:**
```
✅ OCXToken ABI loaded successfully
Server listening on port 5000
Environment: development
```

### Step 2: Request Signature from Backend

**Option A: Using curl**

```bash
curl -X POST http://localhost:5000/marketplace/sign-claim \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: 0x5711b49b29680c1eabb3e3eb6c191d4db70c853c" \
  -H "x-auth-signature: <wallet-signature>" \
  -H "x-auth-message: <auth-message>" \
  -d '{
    "ocxAmount": "100"
  }'
```

**Option B: Using Postman or similar**
- Method: POST
- URL: `http://localhost:5000/marketplace/sign-claim`
- Headers:
  - `Content-Type: application/json`
  - `x-wallet-address: 0x5711b49b29680c1eabb3e3eb6c191d4db70c853c`
  - (Add auth headers as required by your middleware)
- Body:
```json
{
  "ocxAmount": "100"
}
```

**Expected Response:**
```json
{
  "success": true,
  "tradeId": "uuid-here",
  "wallet": "0x5711b49b29680c1eabb3e3eb6c191d4db70c853c",
  "ocxAmount": 100,
  "amountWei": "100000000000000000000",
  "nonce": "0",
  "deadline": 1699999999,
  "signature": "0x1234567890abcdef...",
  "v": 27,
  "r": "0xabcd...",
  "s": "0xef01...",
  "message": "Signature generated. Client must call OCXToken.claim() to execute transaction."
}
```

**Save the response values - you'll need them for the next step!**

### Step 3: Submit Claim Transaction (Client Pays Gas)

Using the values from Step 2, run the client script:

```bash
cd client
node submit-claim.js \
  0x5711b49b29680c1eabb3e3eb6c191d4db70c853c \
  100000000000000000000 \
  0 \
  1699999999 \
  0x1234567890abcdef... \
  <PLAYER_PRIVATE_KEY>
```

**Replace:**
- `100000000000000000000` with the `amountWei` from response
- `0` with the `nonce` from response
- `1699999999` with the `deadline` from response
- `0x1234567890abcdef...` with the `signature` from response
- `<PLAYER_PRIVATE_KEY>` with your test wallet's private key

**Expected Output:**
```
=== OCXToken Claim Submission (User Pays Gas) ===

📋 Configuration:
   RPC: https://sepolia.infura.io/v3/...
   Token Contract: 0x3282E5D599b2A19c59C2c89EC9BDe5b5ad0F257E
   Recipient: 0x5711b49b29680c1eabb3e3eb6c191d4db70c853c
   Amount (OCX): 100.0

🔑 Player wallet: 0x5711b49b29680c1eabb3e3eb6c191d4db70c853c
💰 Player balance: 0.05 ETH
✅ Nonce verified
⛓️  Submitting claim transaction...

✅ Transaction submitted!
   TX Hash: 0xabc123def456...
   Waiting for confirmation...

✅ Transaction confirmed!
   Block: 12345678
   Gas used: 123456

📊 Claimed Event:
   Account: 0x5711b49b29680c1eabb3e3eb6c191d4db70c853c
   Amount: 100.0 OCX
   Nonce: 0

💰 New token balance: 100.0 OCX

🔗 View on explorer:
   https://sepolia.etherscan.io/tx/0xabc123def456...

✅ SUCCESS! Claim completed.
```

**Save the TX Hash for Step 4!**

### Step 4: Confirm Trade on Backend

Using the txHash from Step 3:

```bash
curl -X POST http://localhost:5000/marketplace/trade/confirm \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: 0x5711b49b29680c1eabb3e3eb6c191d4db70c853c" \
  -H "x-auth-signature: <wallet-signature>" \
  -H "x-auth-message: <auth-message>" \
  -d '{
    "txHash": "0xabc123def456...",
    "tradeId": "uuid-from-step2"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "tradeId": "uuid-here",
  "txHash": "0xabc123def456...",
  "blockNumber": 12345678,
  "ocxReceived": "100",
  "resourcesDeducted": null,
  "message": "Trade confirmed and player balance updated"
}
```

### Step 5: Verify Database Updates

If using Supabase, check the database:

```sql
-- Check trade record
SELECT * FROM trades WHERE wallet_address = '0x5711b49b29680c1eabb3e3eb6c191d4db70c853c';

-- Should show status = 'confirmed', tx_hash populated

-- Check player record
SELECT wallet_address, total_ocx_earned FROM players 
WHERE wallet_address = '0x5711b49b29680c1eabb3e3eb6c191d4db70c853c';

-- total_ocx_earned should have increased by 100
```

---

## Verification Checklist

- [ ] Backend loaded OCXToken ABI successfully
- [ ] POST /marketplace/sign-claim returned valid signature
- [ ] `trades` table has pending record (if DB enabled)
- [ ] Client script verified on-chain nonce matched
- [ ] Client script submitted tx successfully
- [ ] Transaction confirmed on Sepolia (check etherscan)
- [ ] `Claimed` event was emitted with correct account and amount
- [ ] Player token balance increased by claim amount
- [ ] POST /marketplace/trade/confirm verified tx
- [ ] `trades` table shows status = 'confirmed' with txHash
- [ ] Player's `total_ocx_earned` increased correctly
- [ ] Contract `nonces[player]` incremented by 1

---

## Troubleshooting

### "Invalid signature" error
- **Cause:** Backend signer doesn't match contract's `authorizedSigner`
- **Fix:** Verify `BACKEND_PRIVATE_KEY` corresponds to the address set as `authorizedSigner` during contract deployment

### "Insufficient funds for gas"
- **Cause:** Test wallet has no Sepolia ETH
- **Fix:** Get Sepolia ETH from https://sepoliafaucet.com/

### "Nonce mismatch"
- **Cause:** Nonce changed between signing and submitting (someone else claimed, or previous failed tx)
- **Fix:** Request a fresh signature from backend

### "Transaction not found"
- **Cause:** Transaction hasn't been mined yet, or RPC issue
- **Fix:** Wait a few seconds and retry, or check different RPC endpoint

### "Claim already used"
- **Cause:** Same signature was already used (replay protection)
- **Fix:** This is expected behavior - request a new signature for a new claim

### "Insufficient claimable balance"
- **Cause:** Contract doesn't have enough tokens
- **Fix:** Check `tokenContract.balanceOf(contractAddress)` - the contract should have the 40% remainder minted to it

---

## Next Steps

Once testing is successful:

1. **Add resource validation:** Update `/marketplace/sign-claim` to verify player has sufficient resources before signing
2. **Add idempotency:** Implement idempotency keys to prevent duplicate trade requests
3. **Add rate limiting:** Ensure `claimLimiter` is properly configured
4. **Frontend integration:** Wire up the marketplace UI to call these endpoints
5. **Event monitoring:** Consider adding websocket/event notifications for trade status
6. **Switch to Base:** Update `CHAIN_ID=8453` and `RPC_URL` for Base mainnet when ready

---

## Security Notes

- **Never commit private keys:** Keep `.env` out of version control
- **Validate all inputs:** Backend should validate resource amounts before signing
- **Short TTL:** Signatures expire in 1 hour (deadline) - this is good practice
- **Nonce tracking:** Contract enforces sequential nonces per account
- **Replay protection:** Contract tracks used claim hashes via `usedClaims` mapping
- **Auth middleware:** All endpoints protected by `requireClaimAuth`
- **Rate limiting:** `claimLimiter` prevents abuse

---

## Files Created/Modified

### New Files:
- `server/abis/OCXToken.json` - Token contract ABI
- `server/sign-claim.js` - Standalone signature generator script
- `server/test-claim-service.js` - End-to-end test script
- `client/submit-claim.js` - Client claim submission script
- `TESTING-GUIDE.md` - This file

### Modified Files:
- `server/claimService.js` - Added `generateClaimSignature()` and `verifyClaimTransaction()`
- `server/index.js` - Added POST `/marketplace/sign-claim` and POST `/marketplace/trade/confirm`
- `server/.env.example` - Updated with required env vars

---

## Contact & Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify all env vars are set correctly
3. Check Sepolia block explorer for transaction details
4. Ensure test wallet has sufficient ETH

Happy testing! 🚀
