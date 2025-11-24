# 🔐 Secure Claim System - Quick Reference

## 🚀 Setup (5 minutes)

```bash
# 1. Run migrations
psql $DATABASE_URL -f db/migrations/008-create-claim-signatures.sql
psql $DATABASE_URL -f db/migrations/009-process-claim-transaction.sql

# 2. Generate signing key
node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"

# 3. Add to .env.local
echo "CLAIM_SIGNER_PRIVATE_KEY=0x..." >> .env.local

# 4. Test
npx tsx scripts/generate-claim-signature.ts 0xYourWallet 1000000000000000000
```

---

## 📝 Usage

### Backend: Create Claim

```typescript
import { generateClaimSignature } from './scripts/generate-claim-signature';

// When player earns tokens
const amount = await calculatePlayerReward(wallet); // YOUR logic
const claim = await generateClaimSignature({
  wallet: playerWallet,
  amount: amount.toString(),
  claimType: 'mining_payout',
  expiresInSeconds: 300,
});

// Send to client
return { success: true, claim };
```

### Client: Submit Claim

```typescript
// Client receives claim and submits
const response = await fetch('/api/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(claim),
});

const result = await response.json();
if (result.success) {
  console.log('Claimed:', result.amount);
}
```

---

## 🛡️ Security Checks

```typescript
// ✅ CORRECT: Server calculates amount
const amount = calculateReward(player); // Server logic
const claim = signClaim(wallet, amount);

// ❌ WRONG: Client provides amount
const claim = signClaim(wallet, request.amount); // VULNERABLE!
```

---

## 🔍 Testing

```bash
# Test valid claim
curl -X POST http://localhost:3000/api/claim -d @valid-claim.json

# Test replay (should fail)
curl -X POST http://localhost:3000/api/claim -d @same-claim.json

# Test tampered amount (should fail)
# Edit amount in claim.json and retry
```

---

## 📊 Monitoring

```sql
-- Check claim stats (last hour)
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE used) as claimed,
  SUM(amount::NUMERIC) as total_amount
FROM claim_signatures
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Find suspicious activity
SELECT wallet, COUNT(*) as claims
FROM claim_signatures
WHERE used = TRUE
  AND used_at > NOW() - INTERVAL '1 hour'
GROUP BY wallet
HAVING COUNT(*) > 10;
```

---

## 🚨 Common Errors

| Error Code | Meaning | Fix |
|------------|---------|-----|
| `INVALID_SIGNATURE` | Signature verification failed | Check signer key, payload not modified |
| `CLAIM_ALREADY_USED` | Signature reused (replay) | Generate new claim |
| `SIGNATURE_EXPIRED` | Claim expired | Generate fresh claim |
| `AMOUNT_MISMATCH` | Amount doesn't match DB | Check calculation logic |
| `CLAIM_NOT_FOUND` | Claim ID not in database | Ensure claim was created |

---

## 🔧 Maintenance

```bash
# Daily: Cleanup expired claims
psql $DATABASE_URL -c "SELECT cleanup_expired_claim_signatures();"

# Weekly: Review stats
psql $DATABASE_URL -f scripts/claim-report.sql

# Monthly: Security audit
# See docs/SECURITY-AUDIT-CHECKLIST.md
```

---

## 📚 Full Documentation

- **Integration Guide:** `docs/SECURE-CLAIM-INTEGRATION.md`
- **Security Checklist:** `docs/SECURITY-AUDIT-CHECKLIST.md`
- **Examples:** `docs/examples/secure-claim-examples.ts`
- **Summary:** `docs/SECURE-CLAIM-SYSTEM-SUMMARY.md`

---

## ⚡ Key Points

1. **Server calculates amounts** - Never trust client
2. **Signatures work once** - Database enforces this
3. **Everything is atomic** - All or nothing
4. **Keep private key secret** - Never commit to git
5. **Monitor for anomalies** - Set up alerts

---

## 🎯 Attack Prevention Matrix

| Attack | How Prevented |
|--------|--------------|
| Replay | Database tracks used signatures |
| Forgery | EIP-712 signature verification |
| Amount tampering | Server calculates + DB verifies |
| Race conditions | Row-level locking |
| Expired signatures | Timestamp validation |

---

**Ready to deploy? Check `docs/SECURITY-AUDIT-CHECKLIST.md` first! 🚀**
