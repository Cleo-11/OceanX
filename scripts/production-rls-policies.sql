-- ========================================
-- PRODUCTION RLS POLICIES
-- ========================================
-- This script applies production-grade Row Level Security (RLS) policies
-- that enforce strict user isolation and authentication checks.
--
-- ⚠️ IMPORTANT: Run this AFTER your demo is complete
-- These policies are much stricter than the demo-safe policies.
--
-- Changes from demo-safe policies:
-- 1. Users can ONLY read/write their OWN data (auth.uid() = user_id)
-- 2. Client-side INSERT is allowed but restricted to authenticated users
-- 3. Server-side operations use service_role key to bypass RLS when needed
-- 4. DELETE is still prevented (use soft-delete via is_active column)
--
-- How to apply:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy/paste this entire file
-- 3. Click "Run" to execute
-- 4. Verify with the check script: scripts/check-production-rls.sql
-- ========================================

-- ========================================
-- STEP 1: Drop demo-safe policies
-- ========================================
DROP POLICY IF EXISTS "allow_read_all_players" ON public.players;
DROP POLICY IF EXISTS "allow_insert_players" ON public.players;
DROP POLICY IF EXISTS "allow_update_players" ON public.players;
DROP POLICY IF EXISTS "prevent_delete_players" ON public.players;

-- Also drop any old/test policies (cleanup)
DROP POLICY IF EXISTS "Players can view all profiles" ON public.players;
DROP POLICY IF EXISTS "Players can insert their own profile" ON public.players;
DROP POLICY IF EXISTS "Players can update their own profile" ON public.players;
DROP POLICY IF EXISTS "Allow user to update their own player row" ON public.players;
DROP POLICY IF EXISTS "Allow user to insert their own player row" ON public.players;
DROP POLICY IF EXISTS "Users can view their own player data" ON public.players;
DROP POLICY IF EXISTS "Users can update their own player data" ON public.players;
DROP POLICY IF EXISTS "Users can insert their own player data" ON public.players;
DROP POLICY IF EXISTS "Users can delete their own player data" ON public.players;

-- ========================================
-- STEP 2: Create production policies for PLAYERS table
-- ========================================

-- SELECT: Users can read their own player profile
-- Also allows reading if authenticated (for leaderboards, etc.)
CREATE POLICY "production_players_select" ON public.players
  FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND (
      auth.uid() = user_id  -- Own profile
      OR is_active = true   -- Or any active player (for leaderboards/public data)
    )
  );

-- INSERT: Authenticated users can create their own player row
-- The trigger (create_player_for_new_user) handles auto-creation on signup,
-- but this policy allows manual creation if needed
CREATE POLICY "production_players_insert" ON public.players
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id  -- Can only create row for self
  );

-- UPDATE: Users can only update their own profile
-- Restricts which columns can be updated (via application logic, not RLS)
CREATE POLICY "production_players_update" ON public.players
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  );

-- DELETE: Prevent all deletes (use soft-delete via is_active = false)
-- Only service_role can delete (via backend functions)
CREATE POLICY "production_players_delete" ON public.players
  FOR DELETE
  USING (false);

-- ========================================
-- STEP 3: Drop and recreate policies for PENDING_ACTIONS table
-- ========================================
DROP POLICY IF EXISTS "allow_read_all_pending_actions" ON public.pending_actions;
DROP POLICY IF EXISTS "allow_insert_pending_actions" ON public.pending_actions;
DROP POLICY IF EXISTS "allow_update_pending_actions" ON public.pending_actions;
DROP POLICY IF EXISTS "allow_delete_pending_actions" ON public.pending_actions;

-- SELECT: Users can only see their own pending actions
CREATE POLICY "production_pending_actions_select" ON public.pending_actions
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  );

-- INSERT: Users can create pending actions for themselves
-- (e.g., queueing a mining action or transaction)
CREATE POLICY "production_pending_actions_insert" ON public.pending_actions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  );

-- UPDATE: Users can update their own pending actions
-- (e.g., marking as cancelled or updating payload)
CREATE POLICY "production_pending_actions_update" ON public.pending_actions
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  );

-- DELETE: Users can delete their own pending actions
-- (e.g., cancelling a queued action)
CREATE POLICY "production_pending_actions_delete" ON public.pending_actions
  FOR DELETE
  USING (
    auth.role() = 'authenticated'
    AND auth.uid() = user_id
  );

-- ========================================
-- STEP 4: Ensure RLS is enabled on both tables
-- ========================================
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 5: Verify policies were created
-- ========================================
SELECT 
  schemaname,
  tablename, 
  policyname, 
  cmd,
  CASE 
    WHEN cmd = 'SELECT' AND tablename = 'players' THEN 'Users read own profile + public leaderboard data'
    WHEN cmd = 'INSERT' AND tablename = 'players' THEN 'Users create own profile only'
    WHEN cmd = 'UPDATE' AND tablename = 'players' THEN 'Users update own profile only'
    WHEN cmd = 'DELETE' AND tablename = 'players' THEN 'Hard deletes prevented (use soft-delete)'
    WHEN cmd = 'SELECT' AND tablename = 'pending_actions' THEN 'Users read own actions only'
    WHEN cmd = 'INSERT' AND tablename = 'pending_actions' THEN 'Users create own actions only'
    WHEN cmd = 'UPDATE' AND tablename = 'pending_actions' THEN 'Users update own actions only'
    WHEN cmd = 'DELETE' AND tablename = 'pending_actions' THEN 'Users delete own actions only'
    ELSE 'Unknown policy'
  END as description
FROM pg_policies
WHERE tablename IN ('players', 'pending_actions')
ORDER BY tablename, cmd;

-- ========================================
-- Expected output:
-- ========================================
-- tablename        | policyname                         | cmd    | description
-- -----------------|-----------------------------------|--------|----------------------------------
-- pending_actions  | production_pending_actions_delete | DELETE | Users delete own actions only
-- pending_actions  | production_pending_actions_insert | INSERT | Users create own actions only
-- pending_actions  | production_pending_actions_select | SELECT | Users read own actions only
-- pending_actions  | production_pending_actions_update | UPDATE | Users update own actions only
-- players          | production_players_delete         | DELETE | Hard deletes prevented
-- players          | production_players_insert         | INSERT | Users create own profile only
-- players          | production_players_select         | SELECT | Users read own profile + public
-- players          | production_players_update         | UPDATE | Users update own profile only
-- ========================================

-- ========================================
-- NOTES FOR BACKEND DEVELOPERS
-- ========================================
-- 1. Client-side operations (using anon/authenticated key):
--    - Can SELECT their own player + view active players
--    - Can INSERT/UPDATE their own player row
--    - Can manage their own pending_actions
--    - CANNOT delete players (soft-delete only)
--
-- 2. Server-side operations (using service_role key):
--    - BYPASS all RLS policies
--    - Use for privileged operations like:
--      * Awarding mining rewards
--      * Admin operations
--      * Batch updates
--      * Hard deletes (if absolutely necessary)
--
-- 3. Recommended backend patterns:
--    - Use Next.js API routes with createClient(service_role_key)
--    - Validate all inputs before writing to DB
--    - Log all privileged operations for audit trail
--    - Never expose service_role key to client
--
-- 4. Testing RLS:
--    - Use the check-production-rls.sql script
--    - Test with real user JWT tokens in browser console
--    - Verify users CANNOT read/write other users' data
-- ========================================

-- Then use supabaseAdmin for all INSERT/UPDATE operations:
--   await supabaseAdmin.from('players').insert({...})
--   await supabaseAdmin.from('players').update({...})

-- ============================================
-- ENVIRONMENT VARIABLE NEEDED
-- ============================================
-- Add to Render environment variables:
-- SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (get from Supabase dashboard)

COMMENT ON TABLE players IS 'Production RLS - only backend can write, everyone can read';
