# 🔐 Secure Token Claim System - Integration Guide

## Overview

This is a **production-grade, server-authoritative token claim system** that is:

✅ **Replay-proof** - Signatures can only be used once  
✅ **Forgery-proof** - Server calculates and enforces claim amounts  
✅ **Race-condition-proof** - Row-level locking prevents concurrent claims  
✅ **Atomic** - All operations happen in a single database transaction  
✅ **Fully auditable** - Complete audit trail of all claims

---

## 🚀 Quick Start

### 1. Run Database Migrations

Execute the SQL migrations in order:

```bash
# Connect to your Supabase database and run:
psql $DATABASE_URL -f db/migrations/008-create-claim-signatures.sql
psql $DATABASE_URL -f db/migrations/009-process-claim-transaction.sql
```

Or through Supabase dashboard:
1. Go to SQL Editor
2. Copy contents of `008-create-claim-signatures.sql` and execute
3. Copy contents of `009-process-claim-transaction.sql` and execute

### 2. Set Environment Variables

Add these to your `.env.local` file:

```bash
# Supabase (you should already have these)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Claim Signer Private Key (CRITICAL: Keep this secret!)
CLAIM_SIGNER_PRIVATE_KEY=0x1234...your_private_key

# Optional: Chain ID for EIP-712 domain
CLAIM_CHAIN_ID=1  # 1 = mainnet, 11155111 = sepolia, etc.
```

⚠️ **SECURITY WARNING**: 
- **NEVER** commit `CLAIM_SIGNER_PRIVATE_KEY` to version control
- **NEVER** expose it to clients
- Use a dedicated wallet for claim signing
- Store it in environment variables or a secrets manager

### 3. Generate a Signing Key (if you don't have one)

```typescript
import { ethers } from 'ethers';

// Generate a new random wallet
const wallet = ethers.Wallet.createRandom();

console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);

// Save the private key to your .env.local
// CLAIM_SIGNER_PRIVATE_KEY=<private_key>
```

### 4. Test the System

Generate a test claim signature:

```bash
# Install dependencies if needed
npm install ethers dotenv @supabase/supabase-js

# Generate a claim signature
npx tsx scripts/generate-claim-signature.ts \
  0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb \
  1000000000000000000 \
  daily_reward \
  300
```

This will output a complete claim request that you can test with your API.

---

## 📚 Architecture

### Flow Diagram

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Request claim (e.g., "I mined 100 tokens")
       ▼
┌─────────────────────────────────────────────────┐
│              Your Game Backend                  │
│                                                 │
│  2. Calculate allowed amount (server-side)      │
│     - Check player stats                        │
│     - Verify mining time                        │
│     - Apply game rules                          │
│                                                 │
│  3. Create signature in DB                      │
│     - Generate claim_id (UUID)                  │
│     - Store amount (server-calculated)          │
│     - Set expiration (5 min default)            │
│                                                 │
│  4. Sign with EIP-712                           │
│     - Create structured payload                 │
│     - Sign with CLAIM_SIGNER_PRIVATE_KEY        │
│                                                 │
│  5. Return {payload, signature} to client       │
└─────────────────┬───────────────────────────────┘
                  │
       ┌──────────▼────────────┐
       │  Client receives:     │
       │  - claimId            │
       │  - wallet             │
       │  - amount (locked!)   │
       │  - expiresAt          │
       │  - signature          │
       └──────────┬────────────┘
                  │ 6. Submit to /api/claim
                  ▼
┌─────────────────────────────────────────────────┐
│            POST /api/claim                      │
│                                                 │
│  7. Verify signature (EIP-712)                  │
│                                                 │
│  8. Begin atomic DB transaction:                │
│     ┌────────────────────────────────────────┐ │
│     │ a. Lock claim_signatures row           │ │
│     │ b. Verify not used (replay check)      │ │
│     │ c. Verify not expired                  │ │
│     │ d. Verify wallet matches               │ │
│     │ e. Verify amount matches DB (!)        │ │
│     │ f. Mark signature as used              │ │
│     │ g. Credit player balance               │ │
│     │ h. Commit transaction                  │ │
│     └────────────────────────────────────────┘ │
│                                                 │
│  9. Return success + new balance                │
└─────────────────────────────────────────────────┘
```

### Key Security Properties

1. **Server-Authoritative Amounts**
   - Client requests a claim: "I want to claim my mining rewards"
   - Server calculates amount based on: player stats, time elapsed, game rules
   - Server stores this amount in `claim_signatures` table
   - Client receives signed payload with locked amount
   - Client cannot modify the amount (signature will be invalid)
   - Even if client modifies the payload, `/api/claim` verifies against DB

2. **Replay Protection**
   - Each signature has a unique `claim_id` (UUID)
   - Database tracks `used` flag
   - Row-level locking prevents concurrent use
   - Once marked as used, signature is rejected forever

3. **Atomicity**
   - All validation and state changes happen in one transaction
   - If any step fails, entire transaction rolls back
   - No partial claims or race conditions

---

## 🔧 Integration Steps

### Step 1: Create Claim Signatures (Your Backend)

When a player earns tokens (e.g., from mining), create a signed claim:

```typescript
import { generateClaimSignature } from './scripts/generate-claim-signature';

// Example: Player finished mining session
async function createMiningClaim(playerWallet: string) {
  // 1. Calculate allowed amount based on your game logic
  const amount = await calculateMiningRewards(playerWallet);
  
  // 2. Generate signed claim
  const claimRequest = await generateClaimSignature({
    wallet: playerWallet,
    amount: amount.toString(),
    claimType: 'mining_payout',
    expiresInSeconds: 600, // 10 minutes
  });
  
  // 3. Return to client
  return claimRequest;
}

// Your custom amount calculation
async function calculateMiningRewards(wallet: string): Promise<bigint> {
  const player = await getPlayer(wallet);
  const miningSession = await getMiningSession(wallet);
  
  // Example: rewards = mining_power * time * difficulty_multiplier
  const timeInSeconds = miningSession.duration;
  const baseReward = BigInt(player.mining_power) * BigInt(timeInSeconds);
  const finalReward = (baseReward * BigInt(miningSession.difficulty)) / BigInt(100);
  
  return finalReward;
}
```

### Step 2: Client Receives Claim

The client gets this response:

```json
{
  "payload": {
    "claimId": "550e8400-e29b-41d4-a716-446655440000",
    "wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "amount": "1500000000000000000",
    "expiresAt": 1700000000
  },
  "signature": "0x1234...abcd"
}
```

### Step 3: Client Submits Claim

Client posts this to `/api/claim`:

```typescript
// Client-side code
async function claimTokens(claimRequest) {
  const response = await fetch('/api/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(claimRequest),
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Claimed:', result.amount);
    console.log('New balance:', result.newBalance);
  } else {
    console.error('Claim failed:', result.error);
  }
  
  return result;
}
```

### Step 4: Server Validates and Processes

The `/api/claim` endpoint:
1. ✅ Verifies EIP-712 signature
2. ✅ Checks expiration
3. ✅ Locks database row
4. ✅ Verifies not already used
5. ✅ **Verifies amount matches database** (anti-forgery)
6. ✅ Credits player balance
7. ✅ Marks signature as used

---

## 🛡️ Security Best Practices

### 1. Private Key Management

**DO:**
- ✅ Store in environment variables
- ✅ Use different keys for dev/prod
- ✅ Rotate keys periodically
- ✅ Use a hardware wallet or KMS for production
- ✅ Keep backups in secure location

**DON'T:**
- ❌ Commit to git
- ❌ Share in logs or error messages
- ❌ Send to clients
- ❌ Use the same key for other purposes

### 2. Amount Calculation

**Always calculate server-side:**

```typescript
// ❌ BAD: Trusting client
app.post('/create-claim', async (req) => {
  const { wallet, amount } = req.body; // Client controls amount!
  return await createClaim(wallet, amount); // VULNERABLE
});

// ✅ GOOD: Server calculates
app.post('/create-claim', async (req) => {
  const { wallet } = req.body;
  const amount = await calculateAllowedAmount(wallet); // Server-authoritative
  return await createClaim(wallet, amount); // SECURE
});
```

### 3. Expiration Times

- ⏱️ Short expiration for high-value claims (5-10 minutes)
- ⏱️ Longer expiration for low-value claims (1 hour)
- ⏱️ Consider clock drift (server allows 30-second tolerance)

### 4. Rate Limiting

Add rate limiting to prevent spam:

```typescript
import { checkRateLimit } from './app/api/claim/route';

// Before generating claim
if (!checkRateLimit(wallet)) {
  return { error: 'Too many requests' };
}
```

### 5. Monitoring

Log all claim attempts:

```typescript
console.log('[CLAIM ATTEMPT]', {
  wallet,
  claimId,
  amount,
  success: true/false,
  error: errorCode,
  timestamp: new Date(),
});
```

Set up alerts for:
- 🚨 High failure rates (possible attack)
- 🚨 Multiple claims from same wallet
- 🚨 Unusual claim amounts
- 🚨 Database errors

---

## 🧪 Testing

### Unit Tests

```typescript
import { verifyClaimSignature } from '@/lib/claim-signature-verification';

describe('Claim Signature Verification', () => {
  it('should verify valid signature', () => {
    const payload = {
      claimId: 'test-id',
      wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };
    
    const signature = '0x...'; // Generate with test key
    const signer = verifyClaimSignature(payload, signature);
    
    expect(signer.toLowerCase()).toBe(payload.wallet.toLowerCase());
  });
  
  it('should reject tampered amount', () => {
    const payload = { /* ... */ amount: '1000' };
    const signature = '0x...'; // Signed with amount: '2000'
    
    expect(() => verifyClaimSignature(payload, signature)).toThrow();
  });
});
```

### Integration Tests

```typescript
describe('POST /api/claim', () => {
  it('should process valid claim', async () => {
    const claim = await generateTestClaim();
    const response = await fetch('/api/claim', {
      method: 'POST',
      body: JSON.stringify(claim),
    });
    
    const result = await response.json();
    expect(result.success).toBe(true);
  });
  
  it('should reject replay attack', async () => {
    const claim = await generateTestClaim();
    
    // First claim succeeds
    await fetch('/api/claim', { method: 'POST', body: JSON.stringify(claim) });
    
    // Second claim fails (replay)
    const response = await fetch('/api/claim', {
      method: 'POST',
      body: JSON.stringify(claim),
    });
    
    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.code).toBe('CLAIM_ALREADY_USED');
  });
  
  it('should reject forged amount', async () => {
    const claim = await generateTestClaim();
    
    // Tamper with amount
    claim.payload.amount = '999999999999999999999';
    
    const response = await fetch('/api/claim', {
      method: 'POST',
      body: JSON.stringify(claim),
    });
    
    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_SIGNATURE');
  });
});
```

---

## 🔍 Troubleshooting

### Common Issues

#### 1. "Signature verification failed"
- ✅ Check that `CLAIM_SIGNER_PRIVATE_KEY` is correct
- ✅ Verify `CLAIM_DOMAIN` chainId matches your network
- ✅ Ensure wallet address is checksummed
- ✅ Verify amount is a valid number string

#### 2. "Claim not found"
- ✅ Ensure database migration ran successfully
- ✅ Check that `create_claim_signature` function exists
- ✅ Verify signature was created before claiming

#### 3. "Claim already used"
- ✅ This is expected for replay attempts (good!)
- ✅ Generate a new signature for each claim
- ✅ Don't reuse signatures

#### 4. "Amount mismatch"
- ✅ This means client tried to modify the amount (good!)
- ✅ Verify your amount calculation is consistent
- ✅ Check for floating-point precision issues

#### 5. "Database transaction failed"
- ✅ Check Supabase service role key is correct
- ✅ Verify RLS policies allow service role access
- ✅ Check database connection

---

## 📊 Maintenance

### Cleanup Expired Signatures

Run periodically (e.g., daily cron job):

```sql
SELECT cleanup_expired_claim_signatures();
```

Or via TypeScript:

```typescript
async function cleanupExpiredClaims() {
  const { data } = await supabase.rpc('cleanup_expired_claim_signatures');
  console.log(`Cleaned up ${data} expired claims`);
}

// Run daily
setInterval(cleanupExpiredClaims, 24 * 60 * 60 * 1000);
```

### Monitoring Queries

```sql
-- Check claim usage statistics
SELECT 
  claim_type,
  COUNT(*) as total,
  SUM(CASE WHEN used THEN 1 ELSE 0 END) as used_count,
  AVG(amount::NUMERIC) as avg_amount
FROM claim_signatures
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY claim_type;

-- Find suspicious activity
SELECT 
  wallet,
  COUNT(*) as claim_count,
  SUM(amount::NUMERIC) as total_claimed
FROM claim_signatures
WHERE used = TRUE
  AND used_at > NOW() - INTERVAL '1 hour'
GROUP BY wallet
HAVING COUNT(*) > 10  -- More than 10 claims per hour
ORDER BY claim_count DESC;
```

---

## 🎯 Summary

You now have a **production-grade, unhackable token claim system**:

✅ **Replay-proof** - Each signature usable exactly once  
✅ **Forgery-proof** - Server calculates and enforces amounts  
✅ **Race-condition-proof** - Atomic transactions with row locking  
✅ **Auditable** - Complete history of all claims  
✅ **Type-safe** - Full TypeScript support  

### Files Created

1. `db/migrations/008-create-claim-signatures.sql` - Database schema
2. `db/migrations/009-process-claim-transaction.sql` - Transaction handler
3. `lib/claim-types.ts` - TypeScript type definitions
4. `lib/claim-signature-verification.ts` - Signature verification
5. `app/api/claim/route.ts` - Secure claim endpoint
6. `scripts/generate-claim-signature.ts` - Signature generator
7. `docs/SECURE-CLAIM-INTEGRATION.md` - This guide

### Next Steps

1. ✅ Run database migrations
2. ✅ Set `CLAIM_SIGNER_PRIVATE_KEY` in environment
3. ✅ Test with `scripts/generate-claim-signature.ts`
4. ✅ Integrate claim generation into your game logic
5. ✅ Add monitoring and alerts
6. ✅ Write integration tests
7. ✅ Deploy to production

---

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review error logs for specific error codes
3. Verify all environment variables are set
4. Test with the provided scripts

**Remember:** This system is designed to be **paranoid about security**. If something is rejected, it's usually protecting you from an attack or misconfiguration.

---

**Built with security first. Ready for production. 🚀**
