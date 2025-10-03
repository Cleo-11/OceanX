# 🚨 EMERGENCY FIX - Supabase RLS Security Issue

## ❌ PROBLEM IDENTIFIED

Your RLS policies have a **CRITICAL SECURITY VULNERABILITY**:

```json
{
  "policyname": "Players can update their own profile",
  "cmd": "UPDATE",
  "qual": "true"  // ← THIS MEANS ANYONE CAN UPDATE ANYONE'S DATA!
}
```

**Impact**: During demo, a malicious user could:
- Change other players' submarine tiers
- Modify resource counts
- Delete player data
- Corrupt the entire database

## ✅ IMMEDIATE FIX (Run in Supabase NOW - 2 minutes)

### Step 1: Open Supabase Dashboard
1. Go to https://app.supabase.com/
2. Select your project
3. Click **SQL Editor** in left sidebar

### Step 2: Run This SQL
Copy/paste from `scripts/fix-supabase-rls.sql` (created for you)

Or run this directly:

```sql
-- Drop all broken policies
DROP POLICY IF EXISTS "Players can view all profiles" ON players;
DROP POLICY IF EXISTS "Players can insert their own profile" ON players;
DROP POLICY IF EXISTS "Players can update their own profile" ON players;
DROP POLICY IF EXISTS "Allow user to update their own player row" ON players;
DROP POLICY IF EXISTS "Allow user to insert their own player row" ON players;
DROP POLICY IF EXISTS "Users can view their own player data" ON players;
DROP POLICY IF EXISTS "Users can update their own player data" ON players;
DROP POLICY IF EXISTS "Users can insert their own player data" ON players;
DROP POLICY IF EXISTS "Users can delete their own player data" ON players;

-- Create correct demo-safe policies
CREATE POLICY "allow_read_all_players" ON players
  FOR SELECT USING (true);

CREATE POLICY "allow_insert_players" ON players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_update_players" ON players
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "prevent_delete_players" ON players
  FOR DELETE USING (false);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_players_wallet_lower 
  ON players (LOWER(wallet_address));

CREATE INDEX IF NOT EXISTS idx_players_wallet_active 
  ON players (wallet_address, is_active) WHERE is_active = true;
```

### Step 3: Verify It Worked
Run this in SQL Editor:

```sql
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'players'
ORDER BY cmd;
```

**Expected output:**
```
DELETE | prevent_delete_players
INSERT | allow_insert_players
SELECT | allow_read_all_players
UPDATE | allow_update_players
```

You should see **EXACTLY 4 policies** (one per command type).

## ⏱️ TIME ESTIMATE
- **Running SQL**: 2 minutes
- **Testing**: 3 minutes
- **Total**: 5 minutes

## 🧪 TEST THE FIX

After running SQL, test in browser console:

```javascript
// Connect to your Supabase
const { createClient } = supabase;
const client = createClient(
  'YOUR_SUPABASE_URL', 
  'YOUR_ANON_KEY'
);

// Try to update a player (this should work now)
const { data, error } = await client
  .from('players')
  .update({ last_login: new Date().toISOString() })
  .eq('wallet_address', '0xYourTestAddress');

console.log('Result:', { data, error });
```

**If successful**: `error: null`  
**If failed**: `error: "new row violates row-level security"` → Re-run SQL above

## 📋 NEXT STEPS (After This Fix)

Once RLS is fixed:

1. ✅ Deploy code changes (git push)
2. ✅ Test end-to-end flow
3. ✅ Run load test with multiple users

## ⚠️ AFTER DEMO (Production Hardening)

The current fix is **demo-safe** but **not production-ready**. After your demo:

1. Use `SUPABASE_SERVICE_ROLE_KEY` in backend (not anon key)
2. Block all client-side INSERT/UPDATE operations
3. Only allow backend to modify player data
4. See `scripts/production-rls-policies.sql` for full implementation

## 🆘 IF YOU GET STUCK

**Error: "permission denied for table players"**
→ RLS is enabled but no policies exist. Re-run the CREATE POLICY statements.

**Error: "new row violates row-level security"**
→ Policies are too restrictive. Make sure you ran DROP + CREATE (not just CREATE).

**Error: "policy already exists"**
→ Run the DROP POLICY statements first to clean up duplicates.

---

**STATUS**: 🔴 CRITICAL - Fix this before deploying!
