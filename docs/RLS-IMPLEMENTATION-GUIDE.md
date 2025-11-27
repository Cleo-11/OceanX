# Row Level Security (RLS) Implementation Guide

## 🚨 CRITICAL SECURITY FIX

**Without RLS policies, your `NEXT_PUBLIC_SUPABASE_ANON_KEY` exposes your ENTIRE database to anyone.**

This guide walks you through implementing comprehensive RLS policies to secure your database before beta launch.

---

## Step 1: Apply the Migration in Supabase

### Option A: Using Supabase Dashboard (Recommended for Testing)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste Migration**
   - Open `db/migrations/010-comprehensive-rls-policies.sql`
   - Copy entire contents
   - Paste into Supabase SQL editor

4. **Run the Migration**
   - Click "Run" or press `Ctrl+Enter`
   - Check for success message
   - Look for "RLS Status Summary" in output

### Option B: Using Supabase CLI (Production)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
supabase db push

# OR apply specific migration file
supabase db execute -f db/migrations/010-comprehensive-rls-policies.sql
```

---

## Step 2: Verify RLS is Enabled

### Check RLS Status in Supabase Dashboard

1. Go to **Table Editor**
2. For each table, click the table name
3. Click **"..."** menu → **"View Policies"**
4. You should see policies listed:

**Tables that should have RLS:**
- ✅ `players` (already done in migration 008)
- ✅ `claim_signatures`
- ✅ `game_sessions` (multiplayer lobbies)
- ✅ `mining_attempts` (anti-cheat logs)
- ✅ `pending_actions`
- ✅ `resource_nodes` (world state)
- ✅ `submarine_tiers` (reference data)
- ✅ `trades` (marketplace)

### SQL Verification

Run this in Supabase SQL Editor to verify:

```sql
-- Check which tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Count policies per table
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

Expected output:
- `players`: 4 policies (from migration 008)
- `claim_signatures`: 5 policies
- `game_sessions`: 5 policies
- `pending_actions`: 5 policies
- `resource_nodes`: 5 policies
- `submarine_tiers`: 5 policies
- `mining_attempts`: 5 policies
- `trades`: 5 policies

---

## Step 3: Test RLS Policies

### Test 1: Verify Anonymous Users Can't Access Data

**In Supabase SQL Editor:**

```sql
-- Simulate anonymous user with no auth
SET ROLE anon;

-- Should return 0 rows (users can't see other players)
SELECT * FROM players;

-- Should return 0 rows or error
SELECT * FROM claim_signatures;

-- Reset
RESET ROLE;
```

✅ **Expected:** Queries return no data or "permission denied"  
❌ **Problem:** If you see data, RLS is not working!

### Test 2: Verify Authenticated Users See Only Their Data

```sql
-- Simulate authenticated user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'test-user-uuid-here';

-- Should only return this user's data
SELECT * FROM players WHERE user_id = current_setting('request.jwt.claim.sub');

-- Should only return their claim signatures
SELECT * FROM claim_signatures cs
JOIN players p ON p.wallet = cs.wallet
WHERE p.user_id = current_setting('request.jwt.claim.sub');

-- Reset
RESET ROLE;
```

### Test 3: Verify Service Role Has Full Access

```sql
-- In your Node.js backend with service_role key:
const { data, error } = await supabaseAdmin
  .from('players')
  .select('*');

console.log('Service role can see all players:', data.length);
```

✅ **Expected:** Service role sees all rows  
❌ **Problem:** If error, check service_role policy

---

## Step 4: Update Your Application Code

### ✅ No Code Changes Required!

Your existing code should work because:

1. **Frontend uses anon key** → RLS restricts to user's own data
2. **Backend uses service_role** → Full access (bypasses RLS)
3. **Policies match your auth pattern** → `auth.uid() = user_id`

### Verify Your Supabase Client Setup

**Frontend (Client Component):**
```typescript
// Should use anon key (already configured)
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // ✅ Anon key
)
```

**Backend (API Routes):**
```typescript
// Should use service_role key (already configured)
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ✅ Service role
  { auth: { persistSession: false } }
)
```

---

## Step 5: Common Issues & Troubleshooting

### Issue: "permission denied for table X"

**Cause:** User trying to access data they don't own

**Solution:** Check if your query filters by `user_id`:

```typescript
// ❌ BAD: No filter, RLS blocks everything
const { data } = await supabase.from('players').select('*');

// ✅ GOOD: Filter by authenticated user
const { data } = await supabase
  .from('players')
  .select('*')
  .eq('user_id', user.id);
```

### Issue: "new row violates row-level security policy"

**Cause:** Trying to insert with wrong `user_id`

**Solution:** Make sure `user_id` matches `auth.uid()`:

```typescript
// ✅ GOOD: user_id matches authenticated user
const { data } = await supabase
  .from('pending_actions')
  .insert({
    user_id: user.id, // Must match auth.uid()
    action_type: 'upgrade',
    // ...
  });
```

### Issue: Backend API routes failing

**Cause:** Using anon key instead of service_role

**Solution:** Use `supabaseAdmin` with service_role key:

```typescript
// app/api/some-route/route.ts
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // ✅ Service role bypasses RLS
);
```

---

## Step 6: Verify in Production

### After Deployment, Test These Scenarios:

1. **Unauthenticated user visits site**
   - Should not be able to query database directly
   - Should only see public data (resource nodes)

2. **User logs in**
   - Can see their own `players` record
   - Can see their own `claim_signatures`
   - Cannot see other users' data

3. **API routes still work**
   - Claim endpoint can write to database
   - Purchase endpoint can verify transactions
   - Pending actions endpoint can create records

### Monitor for RLS Errors

Check your logs for these errors:

```
"new row violates row-level security policy"
"permission denied for table"
"insufficient privilege"
```

If you see these, it means:
- ✅ **Good:** RLS is working and blocking unauthorized access
- ⚠️ **Action needed:** Update your query to include proper filters

---

## Security Checklist

Before going to beta, verify:

- [ ] All tables have `ENABLE ROW LEVEL SECURITY`
- [ ] Service role policy exists on all tables (`auth.role() = 'service_role'`)
- [ ] User SELECT policies filter by `auth.uid() = user_id`
- [ ] Critical tables (claim_signatures, trades) block user INSERT/UPDATE/DELETE
- [ ] Public data (resource_nodes) allows SELECT for all
- [ ] No `USING (true)` policies except for public read-only data
- [ ] Tested with anon key (should see only own data)
- [ ] Tested with service_role (should see all data)
- [ ] Production logs show no RLS errors

---

## Next Steps After RLS is Deployed

Once RLS is confirmed working, move to next HIGH priority fixes:

1. ✅ **RLS Policies** (this guide)
2. ⏭️ **Remove TESTING_MODE_BYPASS_AUTH** from `app/api/hangar/pending/route.ts`
3. ⏭️ **Fix Replay Attack Cache** in `app/api/hangar/purchase/route.ts`
4. ⏭️ **Fix SIWE Authentication** in `lib/web3auth.ts`

See `BETA_READINESS_AUDIT.md` for complete list.

---

## Questions?

If you encounter issues:

1. Check Supabase logs in Dashboard → Logs → Database
2. Review policy definitions in Table Editor → View Policies
3. Test queries manually in SQL Editor
4. Verify environment variables (SUPABASE_SERVICE_ROLE_KEY)

**Remember:** RLS protects against malicious users accessing data they shouldn't see. It's essential for production!
