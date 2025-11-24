-- ========================================
-- ADD RLS POLICIES TO TRADES TABLE
-- ========================================
-- This script adds Row Level Security policies to the trades table
-- Run this if you created the trades table before RLS policies were added
--
-- How to apply:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy/paste this entire file
-- 3. Click "Run" to execute
-- ========================================

-- Enable RLS on trades table (safe to run multiple times)
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (allows re-running this script)
DROP POLICY IF EXISTS "service_role_all_trades" ON trades;
DROP POLICY IF EXISTS "trades_select" ON trades;
DROP POLICY IF EXISTS "trades_insert" ON trades;
DROP POLICY IF EXISTS "trades_update" ON trades;
DROP POLICY IF EXISTS "trades_delete" ON trades;

-- ========================================
-- CREATE POLICIES
-- ========================================

-- Policy 1: Service role has full access (for backend operations)
CREATE POLICY "service_role_all_trades" ON trades
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy 2: Users can read their own trades
CREATE POLICY "trades_select" ON trades
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND auth.uid() = player_id
  );

-- Policy 3: Users can insert their own trades
-- (backend typically creates via service_role, but allows client-side creation)
CREATE POLICY "trades_insert" ON trades
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = player_id
  );

-- Policy 4: Users can update their own trades
-- (e.g., updating tx_hash after submission, or cancelling pending trades)
CREATE POLICY "trades_update" ON trades
  FOR UPDATE
  USING (
    auth.role() = 'authenticated'
    AND auth.uid() = player_id
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = player_id
  );

-- Policy 5: Prevent users from deleting trades (audit trail)
-- Only service_role can delete (for cleanup/admin purposes)
CREATE POLICY "trades_delete" ON trades
  FOR DELETE
  USING (false);

-- ========================================
-- ADD DOCUMENTATION
-- ========================================

COMMENT ON POLICY "trades_select" ON trades IS 'Users can only view their own trade history';
COMMENT ON POLICY "trades_insert" ON trades IS 'Users can only create trades for themselves';
COMMENT ON POLICY "trades_update" ON trades IS 'Users can only update their own trades (e.g., tx_hash, status)';
COMMENT ON POLICY "trades_delete" ON trades IS 'Deletes prevented for audit trail; only service_role can delete via backend';

-- ========================================
-- VERIFICATION
-- ========================================

SELECT 
  schemaname,
  tablename, 
  policyname, 
  cmd
FROM pg_policies
WHERE tablename = 'trades'
ORDER BY policyname;

-- Expected output: 5 policies
-- - service_role_all_trades (ALL)
-- - trades_select (SELECT)
-- - trades_insert (INSERT)
-- - trades_update (UPDATE)
-- - trades_delete (DELETE)
