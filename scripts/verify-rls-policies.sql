-- ============================================================================
-- RLS VERIFICATION SCRIPT
-- ============================================================================
-- This script verifies that Row Level Security (RLS) is enabled on all
-- critical tables and that policies are correctly configured.
-- 
-- Run this in Supabase SQL Editor after applying migrations.
-- ============================================================================

-- ============================================================================
-- STEP 1: Check if RLS is enabled on all tables
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity = TRUE THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'players',
    'leaderboard',
    'mining_attempts',
    'pending_actions',
    'resource_events',
    'resource_nodes',
    'submarine_tiers',
    'upgrade_transactions'
  )
ORDER BY tablename;

-- Expected output: All tables should show "✅ ENABLED"
-- ❌ If any show "DISABLED", RLS is not protecting that table!

-- ============================================================================
-- STEP 2: List all RLS policies and their conditions
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'players',
    'leaderboard',
    'mining_attempts',
    'pending_actions',
    'resource_events',
    'resource_nodes',
    'submarine_tiers',
    'upgrade_transactions'
  )
ORDER BY tablename, policyname;

-- ============================================================================
-- STEP 3: Check for dangerous "wide-open" policies
-- ============================================================================

-- This finds policies that allow ALL users to do ANYTHING
SELECT 
  tablename,
  policyname,
  cmd,
  'DANGEROUS: Policy allows unrestricted access!' as warning
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual = 'true'::text 
    OR with_check = 'true'::text
  )
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE') -- Read-only "true" is okay
ORDER BY tablename;

-- Expected: ZERO results (no dangerous policies)
-- ❌ If this returns rows, those policies are security vulnerabilities!

-- ============================================================================
-- STEP 4: Verify service role bypass (must exist)
-- ============================================================================

SELECT 
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND 'service_role' = ANY(roles)
ORDER BY tablename;

-- Expected: Each table should have a "Service role has full access" policy
-- This allows server-side operations to bypass RLS

-- ============================================================================
-- STEP 5: Test RLS enforcement (must run as authenticated user, not admin)
-- ============================================================================

-- WARNING: This test WILL FAIL if run with service_role key!
-- You must run it with an anon key or as an authenticated user.

-- Test 1: Try to read another player's data
-- This should return ZERO rows (your user_id is not in the DB yet)
SELECT count(*) as other_players_visible
FROM players
WHERE user_id != auth.uid();

-- Expected: 0 (you can't see other players' data)

-- Test 2: Try to insert a fake mining attempt
-- This should be BLOCKED by RLS (only service_role can insert)
-- UNCOMMENT to test (will error):
-- INSERT INTO mining_attempts (wallet_address, node_id, success, resources_gained)
-- VALUES ('0x1234567890123456789012345678901234567890', 'fake-node', true, 100);

-- ============================================================================
-- STEP 6: Summary
-- ============================================================================

SELECT 
  'RLS VERIFICATION COMPLETE' as status,
  CASE 
    WHEN (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = FALSE AND tablename IN ('players', 'leaderboard', 'mining_attempts', 'pending_actions', 'resource_events', 'upgrade_transactions')) = 0
    THEN '✅ All critical tables have RLS enabled'
    ELSE '❌ Some tables missing RLS protection!'
  END as rls_enabled,
  CASE 
    WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND (qual = 'true'::text OR with_check = 'true'::text) AND cmd IN ('INSERT', 'UPDATE', 'DELETE')) = 0
    THEN '✅ No dangerous wide-open policies'
    ELSE '❌ DANGEROUS: Some policies allow unrestricted access!'
  END as policy_safety,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') as total_policies;

-- ============================================================================
-- REMEDIATION (if issues found)
-- ============================================================================
-- If RLS is disabled on any table:
--   ALTER TABLE public.TABLE_NAME ENABLE ROW LEVEL SECURITY;
--
-- If dangerous policies exist:
--   Run: db/migrations/COMPLETE-RLS-ALL-TABLES.sql
--   This will drop broken policies and recreate secure ones.
-- ============================================================================
