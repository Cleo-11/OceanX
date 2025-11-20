# Manual Testing Guide for Claim Validation

## Prerequisites

1. **Backend server running**: `pnpm dev` or check port 5000
2. **Database setup**: Supabase with `players` and `trades` tables
3. **Test player account**: A player with known wallet, coins, and resources
4. **API client**: Postman, curl, or browser DevTools

## Setup Test Environment

### 1. Create Test Player in Database

```sql
-- Connect to Supabase SQL Editor or psql

-- Check if player exists
SELECT * FROM players WHERE wallet_address = '0xYourTestWallet';

-- If not exists, create one
INSERT INTO players (
  user_id,
  wallet_address,
  submarine_tier,
  coins,
  nickel,
  cobalt,
  copper,
  manganese,
  total_ocx_earned,
  created_at
) VALUES (
  (SELECT id FROM auth.users LIMIT 1), -- Use existing user or create one
  '0xYourTestWallet',
  1,
  100,  -- 100 coins = 100 OCX claimable
  50,   -- 50 nickel = 5 OCX
  20,   -- 20 cobalt = 10 OCX
  10,   -- 10 copper = 10 OCX
  5,    -- 5 manganese = 10 OCX
  0,
  NOW()
);

-- Verify player data
SELECT 
  wallet_address,
  coins,
  nickel,
  cobalt,
  copper,
  manganese,
  submarine_tier
FROM players 
WHERE wallet_address = '0xYourTestWallet';

-- Expected max claimable: 100 + 5 + 10 + 10 + 10 = 135 OCX
```

### 2. Get Authentication Token

You need a valid wallet signature to authenticate. Two options:

**Option A: Use existing game session**
1. Open browser DevTools → Network tab
2. Log into OceanX game
3. Find any API request with `Authorization: Bearer ...` header
4. Copy the token

**Option B: Generate signature manually**
```javascript
// In browser console or Node.js with ethers installed
const { ethers } = require('ethers');

const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY');
const message = 'Sign in to OceanX';
const signature = await wallet.signMessage(message);

console.log('Wallet:', wallet.address);
console.log('Signature:', signature);
```

## Test Cases

### Test 1: Valid Claim Within Balance

**Expected Result**: ✅ Success (HTTP 200)

```bash
curl -X POST http://localhost:5000/marketplace/sign-claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SIGNATURE_HERE" \
  -d '{
    "ocxAmount": 50
  }'
```

**Expected Response**:
```json
{
  "signature": "0x...",
  "nonce": 123,
  "deadline": 1700000000,
  "tradeId": 42
}
```

**Verification**:
```sql
-- Check trades table
SELECT * FROM trades 
WHERE wallet_address = '0xYourTestWallet' 
ORDER BY created_at DESC 
LIMIT 1;

-- Should show status='pending', ocx_amount='50000000000000000000' (50 OCX in wei)
```

### Test 2: Claim Exceeds Balance

**Expected Result**: ❌ Rejected (HTTP 403 - AMOUNT_EXCEEDS_LIMIT)

```bash
curl -X POST http://localhost:5000/marketplace/sign-claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SIGNATURE_HERE" \
  -d '{
    "ocxAmount": 999999
  }'
```

**Expected Response**:
```json
{
  "error": "Requested amount exceeds allowable claim. Max: 135.0 OCX. Reason: OK",
  "code": "AMOUNT_EXCEEDS_LIMIT"
}
```

**Server Logs** (check terminal):
```
⚠️ Sign-claim rejected: 0xYourTestWallet requested 999999.0 OCX but max is 135.0
```

### Test 3: Invalid Amount (Zero or Negative)

**Expected Result**: ❌ Rejected (HTTP 400 - INVALID_AMOUNT)

```bash
curl -X POST http://localhost:5000/marketplace/sign-claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SIGNATURE_HERE" \
  -d '{
    "ocxAmount": 0
  }'
```

**Expected Response**:
```json
{
  "error": "Invalid OCX amount",
  "code": "INVALID_AMOUNT"
}
```

### Test 4: Resource Trade - Valid

**Expected Result**: ✅ Success (HTTP 200)

```bash
curl -X POST http://localhost:5000/marketplace/sign-claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SIGNATURE_HERE" \
  -d '{
    "ocxAmount": 10,
    "resourceType": "copper",
    "resourceAmount": 5
  }'
```

**Expected**: Signature generated, player has 10 copper (≥ 5 requested)

**Verification**:
```sql
SELECT resource_type, resource_amount, ocx_amount, status
FROM trades 
WHERE wallet_address = '0xYourTestWallet' 
ORDER BY created_at DESC 
LIMIT 1;

-- Should show: resource_type='copper', resource_amount=5, ocx_amount='10000000000000000000'
```

### Test 5: Resource Trade - Insufficient Resources

**Expected Result**: ❌ Rejected (HTTP 403 - INSUFFICIENT_RESOURCES)

```bash
curl -X POST http://localhost:5000/marketplace/sign-claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SIGNATURE_HERE" \
  -d '{
    "ocxAmount": 50,
    "resourceType": "manganese",
    "resourceAmount": 999
  }'
```

**Expected Response**:
```json
{
  "error": "Insufficient manganese. Available: 5, requested: 999",
  "code": "INSUFFICIENT_RESOURCES"
}
```

### Test 6: Idempotency - Duplicate Request

**Expected Result**: ✅ Idempotent response (HTTP 200 with warning)

**First request**:
```bash
curl -X POST http://localhost:5000/marketplace/sign-claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SIGNATURE_HERE" \
  -d '{
    "ocxAmount": 10,
    "idempotencyKey": "test-idempotency-001"
  }'
```

**Duplicate request** (within 5 minutes):
```bash
curl -X POST http://localhost:5000/marketplace/sign-claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SIGNATURE_HERE" \
  -d '{
    "ocxAmount": 10,
    "idempotencyKey": "test-idempotency-001"
  }'
```

**Expected Response**:
```json
{
  "message": "Signature already issued (idempotent)",
  "tradeId": 42,
  "warning": "Use previously issued signature"
}
```

**Server Logs**:
```
♻️ Returning existing pending signature for idempotency key: test-idempotency-001
```

### Test 7: Backend Relay Flow (/claim endpoint)

**Expected Result**: ✅ Transaction relayed (HTTP 200)

```bash
curl -X POST http://localhost:5000/claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SIGNATURE_HERE" \
  -d '{
    "amount": "10000000000000000000",
    "userAddress": "0xYourTestWallet"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "txHash": "0xabc123...",
  "tradeId": 43
}
```

**Verification**:
```sql
-- Check trade was confirmed
SELECT status, tx_hash, confirmed_at
FROM trades 
WHERE id = 43;

-- Should show: status='confirmed', tx_hash='0xabc123...', confirmed_at IS NOT NULL
```

### Test 8: Player Not Found

**Expected Result**: ❌ Rejected (HTTP 404 - PLAYER_NOT_FOUND)

```bash
curl -X POST http://localhost:5000/marketplace/sign-claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SIGNATURE_FOR_NON_EXISTENT_WALLET" \
  -d '{
    "ocxAmount": 10
  }'
```

**Expected Response**:
```json
{
  "error": "Player not found",
  "code": "PLAYER_NOT_FOUND"
}
```

## Validation Logic Testing

### Check Max Claimable Calculation

Create a test player with specific balances and verify calculation:

```sql
-- Player with:
-- 50 coins, 100 nickel, 20 cobalt, 10 copper, 5 manganese
UPDATE players 
SET coins = 50,
    nickel = 100,
    cobalt = 20,
    copper = 10,
    manganese = 5
WHERE wallet_address = '0xYourTestWallet';
```

**Expected Max Claimable**:
- Coins: 50 × 1.0 = 50 OCX
- Nickel: 100 × 0.1 = 10 OCX
- Cobalt: 20 × 0.5 = 10 OCX
- Copper: 10 × 1.0 = 10 OCX
- Manganese: 5 × 2.0 = 10 OCX
- **Total: 90 OCX**

**Test**: Request 90 OCX → ✅ Success, Request 91 OCX → ❌ Rejected

## Server Logs to Monitor

When running tests, watch for these log patterns:

### Successful Validation
```
🔍 Validating claim eligibility for 0xYourTestWallet: 50.0 OCX
✅ Created audit record: trade 42
🔐 Generating signature for 0xYourTestWallet: 50.0 OCX (idempotency: claim-1234567890-abc123)
```

### Rejected Claims
```
⚠️ Sign-claim rejected: 0xYourTestWallet requested 999.0 OCX but max is 90.0
```

### Idempotent Responses
```
♻️ Returning existing pending signature for idempotency key: test-idempotency-001
```

### Database Errors (Should NOT happen)
```
❌ {
  scope: "claim-audit-creation",
  message: "Failed to insert trade record",
  wallet: "0xYourTestWallet"
}
```

## Database Verification Queries

### View All Claims for Test Wallet
```sql
SELECT 
  id,
  resource_type,
  resource_amount,
  ocx_amount,
  status,
  idempotency_key,
  tx_hash,
  created_at,
  confirmed_at
FROM trades
WHERE wallet_address = '0xYourTestWallet'
ORDER BY created_at DESC;
```

### Check Pending Claims
```sql
SELECT COUNT(*) as pending_claims
FROM trades
WHERE wallet_address = '0xYourTestWallet'
  AND status = 'pending'
  AND deadline > EXTRACT(EPOCH FROM NOW());
```

### Monitor Resource Deduction (if implemented)
```sql
-- After a confirmed resource trade, check if resources were deducted
SELECT coins, nickel, cobalt, copper, manganese
FROM players
WHERE wallet_address = '0xYourTestWallet';
```

## Troubleshooting

### Issue: All requests return 401 Unauthorized
**Solution**: Verify wallet signature is valid and matches player's wallet_address

### Issue: All requests return 404 Player Not Found
**Solution**: Verify player exists in database with correct wallet_address (case-insensitive match)

### Issue: Valid claim rejected with 403
**Solution**: Check player's actual balance in database, verify resource conversion rates

### Issue: Database errors in logs
**Solution**: Verify Supabase connection, check RLS policies allow service role to insert trades

### Issue: Idempotency not working
**Solution**: Check trades table has `idempotency_key` column, verify index exists

## Clean Up Test Data

```sql
-- Remove test trades
DELETE FROM trades WHERE wallet_address = '0xYourTestWallet';

-- Reset player balances
UPDATE players 
SET coins = 100,
    nickel = 50,
    cobalt = 20,
    copper = 10,
    manganese = 5,
    total_ocx_earned = 0
WHERE wallet_address = '0xYourTestWallet';
```

## Success Criteria

✅ Valid claims within balance generate signatures  
✅ Excessive claims rejected with clear error messages  
✅ Invalid amounts (zero/negative) rejected  
✅ Resource trades validate ownership  
✅ Idempotency prevents duplicate signatures  
✅ All claims logged in trades table  
✅ Server logs show validation events  
✅ No database errors in logs
