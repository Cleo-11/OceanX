-- ============================================================================
-- CREATE UPGRADE TRANSACTIONS TABLE
-- ============================================================================
-- This table stores blockchain transaction records for submarine upgrades.
-- Used to prevent replay attacks and provide an audit trail.
--
-- Run this in Supabase SQL Editor AFTER applying COMPLETE-RLS-ALL-TABLES.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.upgrade_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL UNIQUE,
  from_tier INTEGER NOT NULL,
  to_tier INTEGER NOT NULL,
  cost_paid TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on tx_hash for fast replay attack checks
CREATE INDEX IF NOT EXISTS idx_upgrade_transactions_tx_hash 
  ON public.upgrade_transactions(tx_hash);

-- Create index on player_id for fast player history lookups
CREATE INDEX IF NOT EXISTS idx_upgrade_transactions_player_id 
  ON public.upgrade_transactions(player_id);

-- Create index on verified_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_upgrade_transactions_verified_at 
  ON public.upgrade_transactions(verified_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.upgrade_transactions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access on upgrade_transactions"
  ON public.upgrade_transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can view their own upgrade history
CREATE POLICY "Users can view their own upgrade history"
  ON public.upgrade_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE players.id = upgrade_transactions.player_id 
      AND players.user_id = auth.uid()
    )
  );

-- Only service role can create upgrade records
CREATE POLICY "Only service role can create upgrade records"
  ON public.upgrade_transactions
  FOR INSERT
  WITH CHECK (false);

-- No one can update upgrade records (immutable audit log)
CREATE POLICY "No one can update upgrade records"
  ON public.upgrade_transactions
  FOR UPDATE
  USING (false);

-- No one can delete upgrade records
CREATE POLICY "No one can delete upgrade records"
  ON public.upgrade_transactions
  FOR DELETE
  USING (false);

COMMENT ON TABLE public.upgrade_transactions IS 'Blockchain transaction audit log for submarine upgrades - prevents replay attacks';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check table was created
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'upgrade_transactions';

-- Check policies were created
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'upgrade_transactions'
ORDER BY policyname;
