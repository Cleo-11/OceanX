# Production RLS Migration Guide

## Quick Reference

This guide walks you through migrating from demo-safe RLS policies to production-ready security.

## ⏱️ Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Demo (Current)** | - | Permissive policies allow all reads/writes |
| **Production Prep** | 30 min | Apply strict RLS, migrate backend logic |
| **Production** | - | Secure user isolation enforced |

## 🎯 Current State (Demo-Safe)

**Policies Applied:**
- `allow_read_all_players` - Anyone can read all player data
- `allow_insert_players` - Anyone can insert player rows
- `allow_update_players` - Anyone can update player rows
- `prevent_delete_players` - Hard deletes blocked

**Risk:**
⚠️ Any user can modify other users' data (NOT SECURE for production)

## 🔒 Target State (Production)

**Policies Applied:**
- `production_players_select` - Users can read own profile + public leaderboards
- `production_players_insert` - Users can only create own profile
- `production_players_update` - Users can only update own profile
- `production_players_delete` - Hard deletes prevented (soft-delete only)

**Security:**
✅ Strict user isolation via `auth.uid()` checks
✅ Server-side writes for privileged operations
✅ Client cannot modify other users' data

## 📋 Migration Checklist

### Phase 1: Preparation (Before Running SQL)

- [ ] **Backup current data**
  ```sql
  -- Export players table
  COPY (SELECT * FROM players) TO '/tmp/players_backup.csv' CSV HEADER;
  ```

- [ ] **Review current policies**
  ```bash
  # Run in Supabase SQL Editor
  # File: scripts/check-production-rls.sql (CHECK 2)
  ```

- [ ] **Identify client-side DB writes**
  ```bash
  # Search codebase for direct Supabase client writes
  grep -r "supabase.from('players').update" app/
  grep -r "supabase.from('players').insert" app/
  ```

### Phase 2: Apply Production Policies (5 minutes)

- [ ] **Step 1: Open Supabase Dashboard**
  - Navigate to: https://app.supabase.com/
  - Select your project
  - Click **SQL Editor**

- [ ] **Step 2: Run production RLS script**
  - Open: `scripts/production-rls-policies.sql`
  - Copy entire file
  - Paste in SQL Editor
  - Click **Run**
  - Verify no errors in output

- [ ] **Step 3: Verify policies applied**
  - Open: `scripts/check-production-rls.sql`
  - Copy and run in SQL Editor
  - Confirm output shows:
    - ✅ RLS Enabled = true (both tables)
    - ✅ 8 production policies exist
    - ✅ 0 demo policies remain

### Phase 3: Backend Migration (20 minutes)

- [ ] **Step 1: Create admin Supabase client**
  ```typescript
  // lib/supabase-admin.ts
  import { createClient } from '@supabase/supabase-js';
  
  export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  ```

- [ ] **Step 2: Add service role key to environment**
  ```bash
  # .env.local
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  ```
  
  - Get from: Supabase Dashboard → Settings → API → service_role key

- [ ] **Step 3: Create API routes for privileged operations**
  - Mining rewards: `app/api/mining/claim-rewards/route.ts`
  - Submarine upgrades: `app/api/submarine/upgrade/route.ts`
  - See examples: `docs/BACKEND-SERVER-SIDE-PATTERNS.md`

- [ ] **Step 4: Update client components**
  - Replace direct DB writes with API calls
  - Example:
    ```typescript
    // Before (client-side write)
    await supabase.from('players').update({ ... });
    
    // After (API call)
    await fetch('/api/players/update', {
      method: 'POST',
      body: JSON.stringify({ ... })
    });
    ```

### Phase 4: Testing (10 minutes)

- [ ] **Test 1: User isolation**
  ```typescript
  // Sign in as User A
  const { data: userA } = await supabase.auth.getUser();
  
  // Try to read User B's data (should fail or return empty)
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', 'user-b-id');
  
  // Expected: error or empty array
  ```

- [ ] **Test 2: Own data access**
  ```typescript
  // Read own profile (should succeed)
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userA.id);
  
  // Expected: data with own profile
  ```

- [ ] **Test 3: Server-side operations**
  ```bash
  # Test API route
  curl -X POST http://localhost:3000/api/mining/claim-rewards \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"resources_mined": 100}'
  
  # Expected: { "success": true, "player": {...} }
  ```

- [ ] **Test 4: Leaderboard (public read)**
  ```typescript
  // Should still work (reading active players)
  const { data } = await supabase
    .from('players')
    .select('username, total_resources_mined, submarine_tier')
    .eq('is_active', true)
    .order('total_resources_mined', { ascending: false })
    .limit(10);
  
  // Expected: Top 10 players
  ```

### Phase 5: Deployment

- [ ] **Commit changes**
  ```bash
  git add .
  git commit -m "feat: Apply production RLS policies and backend security"
  git push
  ```

- [ ] **Deploy to production**
  - Vercel/Netlify will auto-deploy
  - Ensure environment variables are set in hosting dashboard

- [ ] **Re-run verification in production**
  - Run `scripts/check-production-rls.sql` in production Supabase project

## 🆘 Rollback Plan (If Issues Arise)

If production policies cause issues:

### Quick Rollback to Demo Policies

```sql
-- Drop production policies
DROP POLICY IF EXISTS "production_players_select" ON public.players;
DROP POLICY IF EXISTS "production_players_insert" ON public.players;
DROP POLICY IF EXISTS "production_players_update" ON public.players;
DROP POLICY IF EXISTS "production_players_delete" ON public.players;

-- Re-apply demo policies
CREATE POLICY "allow_read_all_players" ON public.players
  FOR SELECT USING (true);

CREATE POLICY "allow_insert_players" ON public.players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_update_players" ON public.players
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "prevent_delete_players" ON public.players
  FOR DELETE USING (false);
```

## 📊 Verification Queries

### Check current policy state
```sql
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('players', 'pending_actions')
ORDER BY tablename, cmd;
```

### Check RLS is enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('players', 'pending_actions');
```

### Count policies
```sql
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('players', 'pending_actions')
GROUP BY tablename;
```

## 📚 Related Documentation

- `SUPABASE-RLS-FIX.md` - Initial demo-safe fix
- `scripts/production-rls-policies.sql` - Production policies SQL
- `scripts/check-production-rls.sql` - Verification script
- `docs/BACKEND-SERVER-SIDE-PATTERNS.md` - API route examples

## 🔑 Key Takeaways

✅ **Demo policies** allow rapid prototyping but are NOT secure
✅ **Production policies** enforce strict user isolation via `auth.uid()`
✅ **Service role key** bypasses RLS for privileged backend operations
✅ **Client-side writes** should be minimal (mostly reads)
✅ **Backend API routes** handle all sensitive data mutations

## ⚡ Quick Commands

```bash
# Check policies in Supabase
cat scripts/check-production-rls.sql | pbcopy  # Copy to clipboard

# Search for client-side writes
grep -rn "supabase.from('players')" app/ components/

# Test API route locally
npm run dev
curl http://localhost:3000/api/health
```
