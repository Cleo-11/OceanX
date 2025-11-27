# 🚨 APPLY RLS POLICIES NOW - Quick Start

## ⚠️ CRITICAL: Your Database is Currently Unprotected

Your `NEXT_PUBLIC_SUPABASE_ANON_KEY` is exposed in the browser. Without RLS, **anyone can read/modify your entire database**.

---

## 🚀 Quick 3-Step Fix (5 minutes)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your AbyssX project
3. Click **"SQL Editor"** in left sidebar
4. Click **"New Query"**

### Step 2: Run the Migration
1. Open `db/migrations/010-comprehensive-rls-policies.sql` in VS Code
2. Press `Ctrl+A` to select all
3. Press `Ctrl+C` to copy
4. Paste into Supabase SQL Editor
5. Click **"Run"** (or press `Ctrl+Enter`)

### Step 3: Verify Success
Look for this output at the bottom:
```
=== RLS Status Summary ===
NOTICE: Table: public.claim_signatures - RLS Enabled: true
NOTICE: Table: public.game_sessions - RLS Enabled: true
NOTICE: Table: public.mining_attempts - RLS Enabled: true
NOTICE: Table: public.pending_actions - RLS Enabled: true
NOTICE: Table: public.players - RLS Enabled: true
NOTICE: Table: public.resource_nodes - RLS Enabled: true
NOTICE: Table: public.submarine_tiers - RLS Enabled: true
NOTICE: Table: public.trades - RLS Enabled: true
```

✅ If you see all `true` values, **you're protected!**

---

## 📊 What Tables Are Now Protected?

| Table | Protection | Why It Matters |
|-------|-----------|----------------|
| `players` | Users see only their own data | Prevents wallet/balance theft |
| `claim_signatures` | Read own, server-only writes | Prevents reward manipulation |
| `game_sessions` | Public read, host-only write | Prevents session hijacking |
| `mining_attempts` | Read own, server-only writes | Prevents cheat data tampering |
| `pending_actions` | Full CRUD own data | Prevents action queue manipulation |
| `resource_nodes` | Public read, server-only write | Prevents world state tampering |
| `submarine_tiers` | Public read, server-only write | Prevents price manipulation |
| `trades` | Read own, server-only writes | Prevents marketplace fraud |

---

## 🧪 Test It Works

### Test 1: Verify RLS is ON
```sql
-- Run in Supabase SQL Editor
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('players', 'claim_signatures', 'game_sessions', 
                  'mining_attempts', 'pending_actions', 'resource_nodes', 
                  'submarine_tiers', 'trades')
ORDER BY tablename;
```

**Expected:** All 8 tables show `rowsecurity = true`

### Test 2: Check Your Backend Still Works
```bash
# In your project directory
pnpm dev
```

Then test:
1. Connect wallet
2. Mine some resources
3. Claim rewards
4. View profile

✅ If everything works normally, **RLS is configured correctly!**

---

## 🆘 Troubleshooting

### Issue: "permission denied for table X"

**Cause:** Your query doesn't filter by `user_id` or `wallet_address`

**Fix:** Always filter user-specific queries:
```typescript
// ❌ BAD: No filter
const { data } = await supabase.from('players').select('*');

// ✅ GOOD: Filter by user
const { data } = await supabase
  .from('players')
  .select('*')
  .eq('user_id', user.id);
```

### Issue: Backend API routes failing

**Cause:** Using `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`

**Fix:** Backend should use admin client:
```typescript
// app/api/*/route.ts
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ✅ Service role bypasses RLS
);
```

### Issue: Can't see public data (resource_nodes, submarine_tiers)

**Cause:** These tables allow public read, should work for everyone

**Verification:**
```sql
-- Should work even when not logged in
SELECT * FROM submarine_tiers;
SELECT * FROM resource_nodes;
```

---

## ✅ Success Checklist

After running the migration, verify:

- [ ] SQL Editor shows "RLS Status Summary" with 8 tables = `true`
- [ ] Frontend still loads normally (`pnpm dev`)
- [ ] Can connect wallet
- [ ] Can mine resources
- [ ] Can claim rewards
- [ ] Profile page shows your data
- [ ] No errors in browser console
- [ ] No errors in terminal

---

## 📚 Next Steps

Once RLS is deployed, move to the next HIGH priority fix:

**See:** `BETA_READINESS_AUDIT.md` → Section 5 → HIGH Priority Items

**Remaining blockers:**
1. ✅ RLS Policies (YOU JUST FIXED THIS!)
2. ⏭️ Remove `TESTING_MODE_BYPASS_AUTH` from `pending/route.ts`
3. ⏭️ Fix replay attack cache in `purchase/route.ts`
4. ⏭️ Fix SIWE authentication in `lib/web3auth.ts`

---

## 📖 Full Documentation

For detailed explanation of each policy, see:
- `docs/RLS-IMPLEMENTATION-GUIDE.md` - Complete deployment guide
- `db/migrations/010-comprehensive-rls-policies.sql` - SQL with comments

---

**⏱️ Time to complete:** 5 minutes  
**Impact:** Fixes #1 CRITICAL security vulnerability  
**Beta Readiness Score:** +10 points (30/100 → 40/100 in Security)
