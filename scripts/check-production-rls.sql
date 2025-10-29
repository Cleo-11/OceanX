-- ========================================
-- CHECK PRODUCTION RLS POLICIES
-- ========================================
-- This script verifies that production RLS policies are correctly applied
-- and provides diagnostic information.
--
-- How to use:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy/paste this entire file
-- 3. Click "Run" to execute
-- 4. Review the output to ensure policies match expectations
-- ========================================

-- ========================================
-- CHECK 1: Verify RLS is enabled
-- ========================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('players', 'pending_actions')
ORDER BY tablename;

-- Expected: RLS Enabled = true for both tables

-- ========================================
-- CHECK 2: List all policies with details
-- ========================================
SELECT 
  schemaname,
  tablename, 
  policyname, 
  cmd,
  permissive,
  roles,
  qual as "USING expression",
  with_check as "WITH CHECK expression"
FROM pg_policies
WHERE tablename IN ('players', 'pending_actions')
ORDER BY tablename, cmd;

-- ========================================
-- CHECK 3: Count policies per table
-- ========================================
SELECT 
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ' ORDER BY cmd) as policy_names
FROM pg_policies
WHERE tablename IN ('players', 'pending_actions')
GROUP BY tablename
ORDER BY tablename;

-- Expected:
-- players: 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- pending_actions: 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- ========================================
-- CHECK 4: Verify production policy names
-- ========================================
WITH expected_policies AS (
  SELECT unnest(ARRAY[
    'production_players_select',
    'production_players_insert',
    'production_players_update',
    'production_players_delete',
    'production_pending_actions_select',
    'production_pending_actions_insert',
    'production_pending_actions_update',
    'production_pending_actions_delete'
  ]) as expected_name
),
actual_policies AS (
  SELECT policyname as actual_name
  FROM pg_policies
  WHERE tablename IN ('players', 'pending_actions')
)
SELECT 
  COALESCE(e.expected_name, a.actual_name) as policy_name,
  CASE 
    WHEN e.expected_name IS NULL THEN '❌ Unexpected policy found'
    WHEN a.actual_name IS NULL THEN '⚠️ Expected policy missing'
    ELSE '✅ Policy exists'
  END as status
FROM expected_policies e
FULL OUTER JOIN actual_policies a ON e.expected_name = a.actual_name
ORDER BY policy_name;

-- ========================================
-- CHECK 5: Look for old demo policies (should not exist)
-- ========================================
SELECT 
  tablename,
  policyname,
  '⚠️ OLD DEMO POLICY - SHOULD BE DROPPED' as warning
FROM pg_policies
WHERE tablename IN ('players', 'pending_actions')
  AND policyname IN (
    'allow_read_all_players',
    'allow_insert_players',
    'allow_update_players',
    'prevent_delete_players',
    'allow_read_all_pending_actions',
    'allow_insert_pending_actions',
    'allow_update_pending_actions',
    'allow_delete_pending_actions'
  );

-- Expected: No rows (all demo policies should be dropped)

-- ========================================
-- CHECK 6: Summary report
-- ========================================
SELECT 
  '=== PRODUCTION RLS STATUS ===' as report_section,
  '' as detail
UNION ALL
SELECT 
  'Tables with RLS enabled',
  COUNT(*)::text
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('players', 'pending_actions')
  AND rowsecurity = true
UNION ALL
SELECT 
  'Production policies applied',
  COUNT(*)::text
FROM pg_policies
WHERE tablename IN ('players', 'pending_actions')
  AND policyname LIKE 'production_%'
UNION ALL
SELECT 
  'Demo policies remaining',
  COUNT(*)::text
FROM pg_policies
WHERE tablename IN ('players', 'pending_actions')
  AND policyname LIKE 'allow_%';

-- ========================================
-- INTERPRETATION GUIDE
-- ========================================
-- ✅ GOOD STATE:
-- - RLS Enabled = true for both tables
-- - 8 total policies (4 for players, 4 for pending_actions)
-- - All policy names start with "production_"
-- - No policies starting with "allow_" or old names
--
-- ⚠️ WARNING STATE:
-- - Missing some production policies
-- - Demo policies still exist
-- - RLS not enabled on one or both tables
--
-- ❌ BAD STATE:
-- - RLS disabled
-- - No policies exist
-- - Only demo policies exist (not secure)
-- ========================================
