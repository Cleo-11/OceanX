# 🛡️ Secure Claim System - Security Audit Checklist

## Pre-Deployment Checklist

Use this checklist to verify your claim system is production-ready.

---

## 🔐 Private Key Security

- [ ] **Generated dedicated signing key** (not reused from other systems)
- [ ] **Private key stored in environment variables** (not in code)
- [ ] **Private key NOT committed to git** (check `.gitignore`)
- [ ] **Different keys for dev/staging/prod**
- [ ] **Private key backed up securely** (encrypted, offline storage)
- [ ] **Access to private key restricted** (only authorized personnel)
- [ ] **Private key rotation plan in place** (quarterly recommended)
- [ ] **Using hardware wallet or KMS in production** (recommended)

### Verification Commands

```bash
# Check if private key is in git history
git log --all --full-history --source -- **/.env* | grep CLAIM_SIGNER

# Should return empty. If it returns results, key was committed!

# Check .gitignore
grep -E '\.env|\.env\.local' .gitignore

# Should include .env.local and .env
```

---

## 🏗️ Database Security

- [ ] **Migrations executed successfully**
  - [ ] `008-create-claim-signatures.sql`
  - [ ] `009-process-claim-transaction.sql`
- [ ] **Row Level Security (RLS) enabled**
- [ ] **RLS policies created for service role**
- [ ] **Indexes created for performance**
- [ ] **Constraints active** (CHECK, FOREIGN KEY)
- [ ] **Functions created with SECURITY DEFINER**
- [ ] **Regular backups configured**
- [ ] **Connection pooling configured**

### Verification Queries

```sql
-- Check table exists
SELECT EXISTS (
  SELECT FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename = 'claim_signatures'
);

-- Check RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'claim_signatures';

-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'claim_signatures';

-- Check function exists
SELECT proname 
FROM pg_proc 
WHERE proname = 'process_claim_transaction';
```

---

## 🔒 API Security

- [ ] **Endpoint uses HTTPS in production**
- [ ] **CORS configured correctly**
- [ ] **Rate limiting implemented**
- [ ] **Request size limits configured**
- [ ] **Input validation on all fields**
- [ ] **Error messages don't leak sensitive info**
- [ ] **Logging excludes private keys/signatures**
- [ ] **Using service role key (not anon key) for DB access**

### Test Commands

```bash
# Test rate limiting
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/claim \
    -H "Content-Type: application/json" \
    -d '{"payload": {}, "signature": "0x"}' &
done

# Should see some requests fail with 429 Too Many Requests

# Test invalid input handling
curl -X POST http://localhost:3000/api/claim \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}'

# Should return 400 Bad Request, not 500 Internal Server Error
```

---

## 🎯 Signature Verification

- [ ] **EIP-712 domain configured correctly**
- [ ] **Chain ID matches deployment network**
- [ ] **Type definitions match payload structure**
- [ ] **Signature verification happens server-side**
- [ ] **Clock drift tolerance configured** (30 seconds recommended)
- [ ] **Expiration time enforced**
- [ ] **Wallet address checksumming handled**
- [ ] **Amount tampering detected**

### Test Cases

```typescript
// Test 1: Valid signature accepted
const validClaim = await generateTestClaim();
const result = await submitClaim(validClaim);
assert(result.success === true);

// Test 2: Tampered amount rejected
const tamperedClaim = await generateTestClaim();
tamperedClaim.payload.amount = '999999999999999';
const result2 = await submitClaim(tamperedClaim);
assert(result2.code === 'INVALID_SIGNATURE');

// Test 3: Expired signature rejected
const expiredClaim = await generateTestClaim({ expiresInSeconds: -100 });
const result3 = await submitClaim(expiredClaim);
assert(result3.code === 'SIGNATURE_EXPIRED');

// Test 4: Wrong wallet rejected
const wrongWalletClaim = await generateTestClaim();
wrongWalletClaim.payload.wallet = '0x' + '0'.repeat(40);
const result4 = await submitClaim(wrongWalletClaim);
assert(result4.code === 'INVALID_SIGNATURE');
```

---

## 🚫 Replay Attack Prevention

- [ ] **Claim ID is UUID (not sequential)**
- [ ] **Used flag tracked in database**
- [ ] **Row-level locking implemented** (`SELECT FOR UPDATE`)
- [ ] **Used timestamp recorded for audit**
- [ ] **Transaction is atomic** (all or nothing)
- [ ] **Concurrent requests handled** (lock timeout configured)
- [ ] **Cleanup job for expired claims scheduled**

### Test Cases

```typescript
// Test replay attack
const claim = await generateTestClaim();

// First claim succeeds
const first = await submitClaim(claim);
assert(first.success === true);

// Second claim with same signature fails
const second = await submitClaim(claim);
assert(second.success === false);
assert(second.code === 'CLAIM_ALREADY_USED');

// Test concurrent claims (race condition)
const claim2 = await generateTestClaim();
const promises = [
  submitClaim(claim2),
  submitClaim(claim2),
  submitClaim(claim2),
];
const results = await Promise.all(promises);

// Only one should succeed
const successes = results.filter(r => r.success).length;
assert(successes === 1);
```

---

## 💰 Amount Verification

- [ ] **Server calculates allowed amount** (not client)
- [ ] **Client cannot influence amount calculation**
- [ ] **Amount stored in database before signing**
- [ ] **Amount verification in transaction** (database vs payload)
- [ ] **Maximum amount limits enforced** (prevent overflow)
- [ ] **BigInt/Decimal handling correct** (no floating point)
- [ ] **Amount calculation logic audited**
- [ ] **Amount calculation is deterministic**

### Security Tests

```typescript
// Test: Client cannot request arbitrary amount
const maliciousClaim = await generateTestClaim();

// Try to modify amount after signature
const originalAmount = maliciousClaim.payload.amount;
maliciousClaim.payload.amount = '999999999999999999999';

const result = await submitClaim(maliciousClaim);
assert(result.code === 'INVALID_SIGNATURE');

// Test: Even with valid signature, DB amount must match
// This would require compromising the signing key,
// but the database check is an additional layer
```

---

## 📊 Monitoring & Alerting

- [ ] **Success/failure metrics tracked**
- [ ] **Alert on high failure rate** (> 10% in 5 min)
- [ ] **Alert on unusually large amounts**
- [ ] **Alert on database errors**
- [ ] **Alert on repeated claims from same wallet** (> 10/min)
- [ ] **Audit logs retained** (90 days minimum)
- [ ] **Dashboard for claim statistics**
- [ ] **Automated anomaly detection** (optional)

### Monitoring Queries

```sql
-- Claims in last hour
SELECT 
  COUNT(*) as total_claims,
  COUNT(CASE WHEN used THEN 1 END) as successful_claims,
  SUM(amount::NUMERIC) as total_amount
FROM claim_signatures
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Top claimers (potential abuse)
SELECT 
  wallet,
  COUNT(*) as claim_count,
  SUM(amount::NUMERIC) as total_claimed
FROM claim_signatures
WHERE used = TRUE
  AND used_at > NOW() - INTERVAL '1 hour'
GROUP BY wallet
ORDER BY claim_count DESC
LIMIT 10;

-- Failure rate
SELECT 
  COUNT(*) FILTER (WHERE used = FALSE AND expires_at < EXTRACT(EPOCH FROM NOW())) * 100.0 / COUNT(*) as failure_rate_pct
FROM claim_signatures
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## 🧪 Testing

- [ ] **Unit tests for signature verification**
- [ ] **Unit tests for amount calculation**
- [ ] **Integration tests for full claim flow**
- [ ] **Test replay attack prevention**
- [ ] **Test race condition handling**
- [ ] **Test expired signature handling**
- [ ] **Test invalid signature handling**
- [ ] **Test amount tampering detection**
- [ ] **Load testing completed** (1000+ claims/min)
- [ ] **Penetration testing completed** (recommended)

### Test Coverage Goals

- **Signature verification:** 100%
- **Claim endpoint:** 100%
- **Database transaction:** 100%
- **Amount calculation:** 100%
- **Error handling:** 100%

---

## 🚀 Deployment

- [ ] **Tested on staging environment**
- [ ] **Database migrations tested on staging**
- [ ] **Rollback plan documented**
- [ ] **Environment variables set in production**
- [ ] **Signing key rotated from dev/staging**
- [ ] **HTTPS enforced**
- [ ] **Monitoring enabled**
- [ ] **Backup verification successful**
- [ ] **Team trained on incident response**
- [ ] **Documentation updated**

### Pre-Deployment Commands

```bash
# Verify environment variables
env | grep -E 'CLAIM_|SUPABASE_'

# Test claim generation
npx tsx scripts/generate-claim-signature.ts \
  0xYourTestWallet \
  1000000000000000000 \
  test \
  300

# Test claim submission (should succeed)
curl -X POST https://your-prod-domain.com/api/claim \
  -H "Content-Type: application/json" \
  -d @test-claim.json

# Verify database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM claim_signatures;"
```

---

## 📋 Ongoing Maintenance

- [ ] **Weekly: Review claim statistics**
- [ ] **Weekly: Check for anomalies**
- [ ] **Monthly: Review failed claims**
- [ ] **Monthly: Cleanup expired signatures**
- [ ] **Quarterly: Security audit**
- [ ] **Quarterly: Rotate signing key**
- [ ] **Annually: Penetration testing**

### Maintenance Scripts

```bash
# Cleanup expired claims (run weekly)
psql $DATABASE_URL -c "SELECT cleanup_expired_claim_signatures();"

# Review suspicious activity (run daily)
psql $DATABASE_URL -f scripts/check-suspicious-claims.sql

# Generate weekly report
psql $DATABASE_URL -f scripts/generate-claim-report.sql > reports/claims-$(date +%Y-%m-%d).txt
```

---

## ✅ Sign-Off

**Security Review Completed By:**

- [ ] Backend Developer: _________________ Date: _______
- [ ] Security Engineer: _________________ Date: _______
- [ ] DevOps Engineer: ___________________ Date: _______
- [ ] Project Manager: ___________________ Date: _______

**Production Deployment Approved:**

Signature: _________________ Date: _______

---

## 🆘 Incident Response

If you suspect a security breach:

1. **Immediately disable the claim endpoint** (set rate limit to 0)
2. **Review recent claims** in database
3. **Check for duplicate claim IDs** (should never happen)
4. **Verify all claim amounts** against expected values
5. **Review server logs** for suspicious patterns
6. **Contact security team**
7. **Document incident** for post-mortem
8. **Rotate signing key** if compromised
9. **Notify affected users** if necessary
10. **Update security measures** based on findings

### Emergency Commands

```bash
# Disable claims (set in environment)
export CLAIM_RATE_LIMIT_MAX=0

# Check for duplicate claim IDs (should return 0)
psql $DATABASE_URL -c "
  SELECT claim_id, COUNT(*) 
  FROM claim_signatures 
  GROUP BY claim_id 
  HAVING COUNT(*) > 1;
"

# Review recent high-value claims
psql $DATABASE_URL -c "
  SELECT * FROM claim_signatures 
  WHERE amount::NUMERIC > 1000000000000000000000 
  AND created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC;
"
```

---

**This system is designed to be paranoid about security. If something seems suspicious, investigate immediately.**

**Remember: Prevention is cheaper than remediation. 🛡️**
