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

## ⚠️ AFTER DEMO (Production Hardening)

The current fix is **demo-safe** but **not production-ready**. After your demo:

### Step 1: Apply Production RLS Policies

Run the production policies script in Supabase SQL Editor:

```bash
# File location: scripts/production-rls-policies.sql
```

This will:
- Drop demo-safe policies (allow all reads/writes)
- Create strict policies using `auth.uid()` checks
- Enforce user isolation (users can only access their own data)
- Apply policies to both `players` and `pending_actions` tables

### Step 2: Verify Production Policies

Run the verification script to confirm policies are correctly applied:

```bash
# File location: scripts/check-production-rls.sql
```

Expected output:
- 8 total policies (4 for players, 4 for pending_actions)
- All policies named `production_*`
- No demo policies (`allow_*`) remaining
- RLS enabled on both tables

### Step 3: Migrate Backend to Server-Side Writes

For privileged operations (awarding rewards, admin actions), use the service role key:

1. **Create admin Supabase client** (server-only):
   ```typescript
   // lib/supabase-admin.ts
   import { createClient } from '@supabase/supabase-js';
   
   export const supabaseAdmin = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side only!
   );
   ```

2. **Move sensitive logic to API routes**:
   - Mining rewards → `/api/mining/claim-rewards`
   - Submarine upgrades → `/api/submarine/upgrade`
   - Player updates → Backend validates, then writes

3. **See full examples**: `docs/BACKEND-SERVER-SIDE-PATTERNS.md`

### Step 4: Update Environment Variables

Ensure your `.env.local` includes:

```bash
# Server-side only (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Client-side (safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 5: Test Production Security

1. Sign in as User A
2. Try to read User B's data (should fail)
3. Try to update User B's data (should fail)
4. Verify User A can only read/write their own data

See `scripts/check-production-rls.sql` for detailed verification queries.

## 📚 Additional Resources

- `scripts/production-rls-policies.sql` - Production RLS policies
- `scripts/check-production-rls.sql` - Verification script
- `docs/BACKEND-SERVER-SIDE-PATTERNS.md` - API route examples

## 🆘 IF YOU GET STUCK

**Error: "permission denied for table players"**
→ RLS is enabled but no policies exist. Re-run the CREATE POLICY statements.

**Error: "new row violates row-level security"**
→ Policies are too restrictive. Make sure you ran DROP + CREATE (not just CREATE).

**Error: "policy already exists"**
→ Run the DROP POLICY statements first to clean up duplicates.

---

**STATUS**: 🔴 CRITICAL - Fix this before deploying!
