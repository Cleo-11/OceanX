# 🔐 OCEANX CRITICAL SECURITY GUIDE - SIGNATURE REPLAY & NONCE VALIDATION

**Date:** November 23, 2025  
**Priority:** 🔥 CRITICAL - Must implement before production  
**Architecture:** Wallet-based auth (EIP-712 signatures)

---

## 🎯 Why CSRF Protection Was WRONG for OceanX

### Your Architecture:
```
┌──────────┐         ┌──────────┐         ┌──────────┐
│ Frontend │────────>│ Backend  │────────>│ Supabase │
│          │  Auth:  │          │         │          │
│  Wallet  │ Headers │  Wallet  │         │   RLS    │
└──────────┘         └──────────┘         └──────────┘
     │                     │
     │  EIP-712 Sig        │  No cookies
     │                     │  No sessions
     └─────────────────────┘
```

**Authentication Method:**
- ✅ Wallet signatures in request headers
- ✅ EIP-712 typed data signing
- ❌ **NO cookie-based sessions**
- ❌ **NO server-side session storage**

**Result:**
- **CSRF protection is IRRELEVANT** - CSRF attacks require cookies/sessions
- **Focus must be on signature security** - Your actual attack surface

---

## 🚨 THE REAL THREATS TO OCEANX

### 1. 🔴 Signature Replay Attacks (CRITICAL)

**What It Is:**
Attacker captures a valid signature and reuses it multiple times.

**Attack Flow:**
```javascript
// 1. Legitimate user claims tokens
POST /player/claim
Headers: { Authorization: "Bearer eyJ..." }
Body: { wallet: "0xUser", amount: 100 }

→ Backend generates signature: 
   sign({ wallet: "0xUser", amount: 100, nonce: 5 })

// 2. Attacker intercepts the request (network sniff, XSS, etc.)

// 3. Attacker replays 1000 times
for (let i = 0; i < 1000; i++) {
  fetch('/player/claim', {
    method: 'POST',
    headers: { Authorization: "Bearer eyJ..." }, // ← Reused token
    body: JSON.stringify({ wallet: "0xUser", amount: 100 })
  });
}

// 4. Backend keeps generating signatures (no nonce check!)
→ 1000 valid signatures with same nonce
→ Only first blockchain claim works, but attacker has 999 extra signatures
→ Attacker sells them or uses for other exploits
```

**Why Your Current Code is Vulnerable:**
```javascript
// server/index.js - /player/claim endpoint
app.post("/player/claim", requireClaimAuth, async (req, res) => {
  const { wallet, amount } = req.body;
  
  // ❌ NO NONCE VALIDATION
  // ❌ NO CHECK if this nonce was already signed
  // ❌ Backend blindly generates signature
  
  const nonce = await contract.nonces(wallet); // Gets current nonce
  const signature = await signClaim(wallet, amount, nonce);
  
  // Attacker can call this endpoint 1000x and get 1000 signatures
  res.json({ signature, nonce });
});
```

---

### 2. 🔴 Client-Side Authoritative Data (CRITICAL)

**What It Is:**
Client sends mining results and server trusts them without validation.

**Attack Flow:**
```javascript
// Attacker modifies frontend code
socket.emit('mine-node', {
  nodeId: 123,
  resources: {
    gold: 999999,      // ← Client claims 999,999 gold (real max: 100)
    platinum: 50000,   // ← Fake platinum on common node
    legendary: 10      // ← Legendary items that shouldn't spawn
  }
});

// Server accepts without validation
io.on('mine-node', (data) => {
  await saveResources(data.resources); // ❌ TRUSTS CLIENT
});
```

**Impact:**
- Unlimited token inflation
- Economy collapse
- Game becomes unplayable for honest users

---

### 3. 🔴 Missing Server-Side Nonce Tracking

**What It Is:**
Backend doesn't track which nonces have been used to generate signatures.

**The Problem:**
```javascript
// Current flow:
1. User requests claim → Backend gets nonce from contract: nonce = 5
2. Backend signs claim with nonce 5
3. User submits to blockchain → nonce increments to 6
4. Attacker requests same claim AGAIN
5. Backend gets nonce from contract: nonce = 6 (now incremented)
6. Backend signs AGAIN with nonce 6
7. Repeat infinitely...

// Attacker accumulates unlimited signatures
```

**What's Missing:**
- Database table to track pending/signed nonces
- Check if nonce was already used before signing
- Expiration mechanism for unused signatures

---

## ✅ COMPREHENSIVE FIX - NONCE VALIDATION SYSTEM

### Step 1: Database Schema

Create table to track all claim signatures:

```sql
-- migrations/003_claim_nonce_tracking.sql
CREATE TABLE claim_signatures (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  nonce BIGINT NOT NULL,
  amount NUMERIC(78, 0) NOT NULL,
  signature TEXT,
  status TEXT NOT NULL, -- 'pending', 'signed', 'claimed', 'expired', 'revoked'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  signed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  
  -- Ensure one signature per wallet+nonce combination
  UNIQUE(wallet_address, nonce)
);

-- Indexes for performance
CREATE INDEX idx_claim_sigs_wallet ON claim_signatures(wallet_address);
CREATE INDEX idx_claim_sigs_status ON claim_signatures(status);
CREATE INDEX idx_claim_sigs_expires ON claim_signatures(expires_at) WHERE status IN ('pending', 'signed');

-- RLS policies
ALTER TABLE claim_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims"
  ON claim_signatures FOR SELECT
  USING (wallet_address = lower(auth.jwt()->>'wallet'));

CREATE POLICY "Backend can manage all claims"
  ON claim_signatures FOR ALL
  USING (auth.role() = 'service_role');
```

### Step 2: Backend Nonce Validation Logic

```javascript
// server/lib/nonceManager.js
const { createClient } = require('@supabase/supabase-js');

class NonceManager {
  constructor(supabase, contract) {
    this.supabase = supabase;
    this.contract = contract;
  }

  /**
   * Get current nonce from smart contract
   */
  async getCurrentNonce(walletAddress) {
    try {
      const nonce = await this.contract.nonces(walletAddress);
      return nonce.toString();
    } catch (error) {
      console.error('Failed to get nonce from contract:', error);
      throw new Error('Failed to fetch nonce from blockchain');
    }
  }

  /**
   * Check if a nonce has already been used for signing
   * Returns existing signature if found
   */
  async checkNonceUsage(walletAddress, nonce) {
    const { data, error } = await this.supabase
      .from('claim_signatures')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('nonce', nonce)
      .in('status', ['pending', 'signed'])
      .maybeSingle();

    if (error) {
      console.error('Error checking nonce usage:', error);
      throw error;
    }

    return data; // Returns existing claim or null
  }

  /**
   * Reserve a nonce for signing (prevents concurrent use)
   */
  async reserveNonce(walletAddress, nonce, amount) {
    const { data, error } = await this.supabase
      .from('claim_signatures')
      .insert({
        wallet_address: walletAddress.toLowerCase(),
        nonce: nonce,
        amount: amount.toString(),
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation = nonce already reserved
      if (error.code === '23505') {
        throw new Error('Nonce already in use. Please try again.');
      }
      throw error;
    }

    return data;
  }

  /**
   * Store signature after successful signing
   */
  async storeSignature(walletAddress, nonce, signature) {
    const { error } = await this.supabase
      .from('claim_signatures')
      .update({
        signature: signature,
        status: 'signed',
        signed_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('nonce', nonce);

    if (error) {
      console.error('Error storing signature:', error);
      throw error;
    }
  }

  /**
   * Mark nonce as claimed (called after blockchain confirmation)
   */
  async markAsClaimed(walletAddress, nonce) {
    const { error } = await this.supabase
      .from('claim_signatures')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('nonce', nonce);

    if (error) {
      console.error('Error marking as claimed:', error);
    }
  }

  /**
   * Cleanup expired signatures (run periodically)
   */
  async cleanupExpired() {
    const { data, error } = await this.supabase
      .from('claim_signatures')
      .update({ status: 'expired' })
      .lt('expires_at', new Date().toISOString())
      .in('status', ['pending', 'signed'])
      .select();

    if (!error && data) {
      console.log(`🧹 Cleaned up ${data.length} expired signatures`);
    }
  }
}

module.exports = NonceManager;
```

### Step 3: Updated Claim Endpoint

```javascript
// server/index.js
const NonceManager = require('./lib/nonceManager');

// Initialize nonce manager
const nonceManager = new NonceManager(supabase, contract);

// Run cleanup every 5 minutes
setInterval(() => {
  nonceManager.cleanupExpired().catch(console.error);
}, 5 * 60 * 1000);

// SECURE claim endpoint
app.post("/player/claim", claimLimiter, requireClaimAuth, async (req, res) => {
  try {
    const { wallet, amount } = req.body;
    const walletLower = wallet.toLowerCase();

    // 1. Get current nonce from blockchain
    const currentNonce = await nonceManager.getCurrentNonce(walletLower);

    // 2. Check if nonce already has a signature
    const existingClaim = await nonceManager.checkNonceUsage(walletLower, currentNonce);
    
    if (existingClaim) {
      // Nonce already used - return existing signature instead of creating new one
      console.warn(`⚠️ Nonce ${currentNonce} already signed for ${walletLower}`);
      
      return res.json({
        success: true,
        signature: existingClaim.signature,
        nonce: existingClaim.nonce,
        amount: existingClaim.amount,
        message: 'Using existing signature for this nonce',
      });
    }

    // 3. Validate amount (server-side check)
    const maxClaimAmount = await getMaxClaimAmount(walletLower); // From game logic
    if (amount > maxClaimAmount) {
      return res.status(400).json({
        success: false,
        error: `Cannot claim more than ${maxClaimAmount} tokens`,
      });
    }

    // 4. Reserve nonce (prevents concurrent signing)
    await nonceManager.reserveNonce(walletLower, currentNonce, amount);

    // 5. Generate EIP-712 signature
    const domain = {
      name: "OceanX",
      version: "1",
      chainId: process.env.CHAIN_ID || 11155111,
      verifyingContract: process.env.CONTRACT_ADDRESS,
    };

    const types = {
      Claim: [
        { name: "wallet", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };

    const value = {
      wallet: walletLower,
      amount: amount.toString(),
      nonce: currentNonce.toString(),
    };

    const signer = new ethers.Wallet(process.env.PRIVATE_KEY);
    const signature = await signer.signTypedData(domain, types, value);

    // 6. Store signature in database
    await nonceManager.storeSignature(walletLower, currentNonce, signature);

    // 7. Log for monitoring
    console.log(`✅ Signed claim for ${walletLower}: ${amount} tokens (nonce: ${currentNonce})`);

    // 8. Return signature to client
    res.json({
      success: true,
      signature,
      nonce: currentNonce,
      amount: amount.toString(),
    });

  } catch (error) {
    console.error('❌ Claim signing error:', error);
    
    // Don't leak internal details
    res.status(500).json({
      success: false,
      error: 'Failed to process claim. Please try again.',
    });
  }
});
```

### Step 4: Webhook to Mark Claims as Used

```javascript
// Listen for blockchain events to mark claims as used
app.post("/webhook/claim-processed", async (req, res) => {
  try {
    const { wallet, nonce } = req.body;
    
    // Verify webhook signature (add your verification logic)
    
    await nonceManager.markAsClaimed(wallet, nonce);
    
    console.log(`✅ Marked claim as processed: ${wallet}, nonce ${nonce}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
});
```

---

## 🧪 Testing the Nonce System

### Test 1: Replay Protection
```bash
# Try to claim twice with same nonce
curl -X POST http://localhost:5000/player/claim \
  -H "Authorization: Bearer TOKEN" \
  -d '{"wallet":"0xUser","amount":100}'

# First call: ✅ Returns new signature
# Second call: ✅ Returns SAME signature (not a new one)
# Result: ✅ Replay attack prevented
```

### Test 2: Concurrent Requests
```bash
# Send 10 simultaneous requests
for i in {1..10}; do
  curl -X POST http://localhost:5000/player/claim \
    -H "Authorization: Bearer TOKEN" \
    -d '{"wallet":"0xUser","amount":100}' &
done
wait

# Expected: Only ONE signature created, others get 409 conflict
```

### Test 3: Expired Signature Cleanup
```javascript
// Wait 1 hour, then trigger cleanup
await nonceManager.cleanupExpired();

// Check database - expired signatures should have status='expired'
```

---

## 📊 Security Comparison

### ❌ Before (Vulnerable):
```
User Request → Backend gets nonce → Signs → Returns signature
     ↓              ↓                  ↓            ↓
Attacker can replay request 1000x
Backend signs 1000 different nonces (1, 2, 3, ...)
Attacker accumulates 1000 valid signatures
```

### ✅ After (Secure):
```
User Request → Check DB for existing signature
                      ↓
               Nonce already used?
                      ↓
              YES → Return existing signature
              NO  → Reserve nonce → Sign → Store → Return
                           ↓
                  Concurrent requests blocked by UNIQUE constraint
                  Replay requests get same signature (not new)
```

---

## 🎯 Implementation Checklist

- [ ] Create `claim_signatures` table in database
- [ ] Implement `NonceManager` class
- [ ] Update `/player/claim` endpoint with nonce validation
- [ ] Update `/marketplace/sign-claim` endpoint
- [ ] Add cleanup job for expired signatures
- [ ] Add webhook for marking claims as processed
- [ ] Test replay attack scenarios
- [ ] Test concurrent request handling
- [ ] Monitor signature generation in production logs

---

## 🚀 Next Steps After Nonce System

1. **Server-Side Mining Validation**
   - Calculate mining results on server (not client)
   - Use server-controlled RNG for drops
   - Validate against max possible yields

2. **Rate Limiting Enhancements**
   - Add per-wallet claim limits (not just IP)
   - Implement exponential backoff for failed attempts

3. **Monitoring & Alerts**
   - Alert on multiple signatures for same nonce
   - Alert on unusually high claim amounts
   - Track signature generation rate

---

## 💡 Why This Matters More Than CSRF

**CSRF Protection:**
- Only relevant for cookie-based auth
- Your app uses wallet signatures (no cookies)
- Impact: N/A for your architecture

**Nonce Validation:**
- Critical for signature-based auth (your architecture)
- Prevents unlimited token theft
- Impact: $50,000+ potential loss if not implemented

**Bottom Line:**
Focus on threats **specific to your architecture**, not generic web vulnerabilities that don't apply.
