-- Migration 010: Comprehensive Row Level Security (RLS) Policies
-- This migration secures all critical tables to prevent unauthorized access
-- 
-- CRITICAL: Without these policies, the NEXT_PUBLIC_SUPABASE_ANON_KEY 
-- would allow anyone to read/write/delete ALL data in these tables.
--
-- Tables covered:
-- - claim_signatures (server-signed claims)
-- - game_sessions (multiplayer sessions)
-- - mining_attempts (anti-cheat logs)
-- - pending_actions (user queued actions)
-- - resource_nodes (world state)
-- - submarine_tiers (reference data)
-- - trades (marketplace transactions)
--
-- Note: players table already has RLS (migration 008)

-- ============================================================================
-- CLAIM SIGNATURES TABLE
-- ============================================================================

-- Enable RLS
ALTER TABLE public.claim_signatures ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access on claim_signatures"
  ON public.claim_signatures
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can view their own claim signatures (by matching wallet address)
CREATE POLICY "Users can view their own claim signatures"
  ON public.claim_signatures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE players.wallet_address = claim_signatures.wallet 
      AND players.user_id = auth.uid()
    )
  );

-- Prevent all INSERT, UPDATE, DELETE from users (only service_role can modify)
-- This is critical because claim signatures must only be created by the server
CREATE POLICY "Only service role can modify claim signatures"
  ON public.claim_signatures
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Only service role can update claim signatures"
  ON public.claim_signatures
  FOR UPDATE
  USING (false);

CREATE POLICY "Only service role can delete claim signatures"
  ON public.claim_signatures
  FOR DELETE
  USING (false);

COMMENT ON TABLE public.claim_signatures IS 'Stores server-signed claim signatures with strict RLS';

-- ============================================================================
-- GAME SESSIONS TABLE
-- ============================================================================

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access on game_sessions"
  ON public.game_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anyone can view active game sessions (for multiplayer lobby)
CREATE POLICY "Anyone can view active game sessions"
  ON public.game_sessions
  FOR SELECT
  USING (status = 'active');

-- Users can create their own game sessions
CREATE POLICY "Users can create their own game sessions"
  ON public.game_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE players.id = game_sessions.host_player_id 
      AND players.user_id = auth.uid()
    )
  );

-- Only host can update their session
CREATE POLICY "Hosts can update their own sessions"
  ON public.game_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE players.id = game_sessions.host_player_id 
      AND players.user_id = auth.uid()
    )
  );

-- Only host can delete their session
CREATE POLICY "Hosts can delete their own sessions"
  ON public.game_sessions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE players.id = game_sessions.host_player_id 
      AND players.user_id = auth.uid()
    )
  );

-- ============================================================================
-- UPGRADE TRANSACTIONS TABLE (if exists)
-- ============================================================================

-- Check if table exists and enable RLS
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'upgrade_transactions') THEN
    ALTER TABLE public.upgrade_transactions ENABLE ROW LEVEL SECURITY;
    
    -- Service role has full access
    EXECUTE 'CREATE POLICY "Service role has full access on upgrade_transactions"
      ON public.upgrade_transactions
      FOR ALL
      USING (auth.role() = ''service_role'')
      WITH CHECK (auth.role() = ''service_role'')';
    
    -- Users can view their own upgrade history
    EXECUTE 'CREATE POLICY "Users can view their own upgrade history"
      ON public.upgrade_transactions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.players 
          WHERE players.id = upgrade_transactions.player_id 
          AND players.user_id = auth.uid()
        )
      )';
    
    -- Only service role can insert upgrade records
    EXECUTE 'CREATE POLICY "Only service role can create upgrade records"
      ON public.upgrade_transactions
      FOR INSERT
      WITH CHECK (false)';
    
    -- Prevent updates and deletes
    EXECUTE 'CREATE POLICY "No one can update upgrade records"
      ON public.upgrade_transactions
      FOR UPDATE
      USING (false)';
    
    EXECUTE 'CREATE POLICY "No one can delete upgrade records"
      ON public.upgrade_transactions
      FOR DELETE
      USING (false)';
  END IF;
END $$;

-- ============================================================================
-- PENDING ACTIONS TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_actions') THEN
    ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;
    
    -- Service role has full access
    EXECUTE 'CREATE POLICY "Service role has full access on pending_actions"
      ON public.pending_actions
      FOR ALL
      USING (auth.role() = ''service_role'')
      WITH CHECK (auth.role() = ''service_role'')';
    
    -- Users can view their own pending actions
    EXECUTE 'CREATE POLICY "Users can view their own pending actions"
      ON public.pending_actions
      FOR SELECT
      USING (auth.uid() = user_id)';
    
    -- Users can create their own pending actions
    EXECUTE 'CREATE POLICY "Users can create their own pending actions"
      ON public.pending_actions
      FOR INSERT
      WITH CHECK (auth.uid() = user_id)';
    
    -- Users can update their own pending actions
    EXECUTE 'CREATE POLICY "Users can update their own pending actions"
      ON public.pending_actions
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)';
    
    -- Users can delete their own pending actions
    EXECUTE 'CREATE POLICY "Users can delete their own pending actions"
      ON public.pending_actions
      FOR DELETE
      USING (auth.uid() = user_id)';
  END IF;
END $$;

-- ============================================================================
-- RESOURCE NODES TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resource_nodes') THEN
    ALTER TABLE public.resource_nodes ENABLE ROW LEVEL SECURITY;
    
    -- Service role has full access
    EXECUTE 'CREATE POLICY "Service role has full access on resource_nodes"
      ON public.resource_nodes
      FOR ALL
      USING (auth.role() = ''service_role'')
      WITH CHECK (auth.role() = ''service_role'')';
    
    -- Everyone can view resource nodes (they''re public game data)
    EXECUTE 'CREATE POLICY "Anyone can view resource nodes"
      ON public.resource_nodes
      FOR SELECT
      USING (true)';
    
    -- Only service role can modify resource nodes
    EXECUTE 'CREATE POLICY "Only service role can modify resource nodes"
      ON public.resource_nodes
      FOR INSERT
      WITH CHECK (false)';
    
    EXECUTE 'CREATE POLICY "Only service role can update resource nodes"
      ON public.resource_nodes
      FOR UPDATE
      USING (false)';
    
    EXECUTE 'CREATE POLICY "Only service role can delete resource nodes"
      ON public.resource_nodes
      FOR DELETE
      USING (false)';
  END IF;
END $$;

-- ============================================================================
-- SUBMARINE TIERS TABLE (Reference Data)
-- ============================================================================

ALTER TABLE public.submarine_tiers ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access on submarine_tiers"
  ON public.submarine_tiers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Everyone can view submarine tiers (public reference data)
CREATE POLICY "Anyone can view submarine tiers"
  ON public.submarine_tiers
  FOR SELECT
  USING (true);

-- Only service role can modify submarine tiers
CREATE POLICY "Only service role can modify submarine tiers"
  ON public.submarine_tiers
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Only service role can update submarine tiers"
  ON public.submarine_tiers
  FOR UPDATE
  USING (false);

CREATE POLICY "Only service role can delete submarine tiers"
  ON public.submarine_tiers
  FOR DELETE
  USING (false);

-- ============================================================================
-- MINING ATTEMPTS TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mining_attempts') THEN
    ALTER TABLE public.mining_attempts ENABLE ROW LEVEL SECURITY;
    
    -- Service role has full access
    EXECUTE 'CREATE POLICY "Service role has full access on mining_attempts"
      ON public.mining_attempts
      FOR ALL
      USING (auth.role() = ''service_role'')
      WITH CHECK (auth.role() = ''service_role'')';
    
    -- Users can view their own mining attempts
    EXECUTE 'CREATE POLICY "Users can view their own mining attempts"
      ON public.mining_attempts
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.players 
          WHERE players.wallet_address = mining_attempts.wallet_address 
          AND players.user_id = auth.uid()
        )
      )';
    
    -- Only service role can create mining attempts (server-authoritative)
    EXECUTE 'CREATE POLICY "Only service role can create mining attempts"
      ON public.mining_attempts
      FOR INSERT
      WITH CHECK (false)';
    
    -- Prevent updates and deletes
    EXECUTE 'CREATE POLICY "No one can update mining attempts"
      ON public.mining_attempts
      FOR UPDATE
      USING (false)';
    
    EXECUTE 'CREATE POLICY "No one can delete mining attempts"
      ON public.mining_attempts
      FOR DELETE
      USING (false)';
  END IF;
END $$;

-- ============================================================================
-- TRADES TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trades') THEN
    ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
    
    -- Service role has full access
    EXECUTE 'CREATE POLICY "Service role has full access on trades"
      ON public.trades
      FOR ALL
      USING (auth.role() = ''service_role'')
      WITH CHECK (auth.role() = ''service_role'')';
    
    -- Users can view their own trades
    EXECUTE 'CREATE POLICY "Users can view their own trades"
      ON public.trades
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.players 
          WHERE players.wallet_address = trades.wallet_address
          AND players.user_id = auth.uid()
        )
      )';
    
    -- Only service role can modify trades (prevents manipulation)
    EXECUTE 'CREATE POLICY "Only service role can create trades"
      ON public.trades
      FOR INSERT
      WITH CHECK (false)';
    
    EXECUTE 'CREATE POLICY "Only service role can update trades"
      ON public.trades
      FOR UPDATE
      USING (false)';
    
    EXECUTE 'CREATE POLICY "Only service role can delete trades"
      ON public.trades
      FOR DELETE
      USING (false)';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION & SUMMARY
-- ============================================================================

-- Display enabled RLS status for all tables
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== RLS Status Summary ===';
  FOR rec IN 
    SELECT schemaname, tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('players', 'claim_signatures', 'game_sessions', 'pending_actions', 
                      'resource_nodes', 'submarine_tiers', 'mining_attempts', 'trades')
    ORDER BY tablename
  LOOP
    RAISE NOTICE 'Table: %.% - RLS Enabled: %', rec.schemaname, rec.tablename, rec.rowsecurity;
  END LOOP;
END $$;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================

-- After running this migration:
-- 
-- 1. TEST with anon key to verify users can only access their own data
-- 2. TEST with service_role key to verify backend APIs still work
-- 3. Monitor for any "permission denied" errors in production
-- 4. If you add new tables, remember to add RLS policies!
-- 
-- Tables with RLS enabled:
-- - players (migration 008)
-- - claim_signatures (server-signed rewards)
-- - game_sessions (multiplayer lobbies)
-- - mining_attempts (anti-cheat logs)
-- - pending_actions (user action queue)
-- - resource_nodes (world state - public read)
-- - submarine_tiers (reference data - public read)
-- - trades (marketplace transactions)
--
-- To test RLS policies:
-- 
--   -- Test as anonymous user (should fail):
--   SET ROLE anon;
--   SELECT * FROM players;  -- Should return 0 rows or error
--   
--   -- Test as authenticated user:
--   SET ROLE authenticated;
--   SELECT set_config('request.jwt.claim.sub', 'test-user-id', true);
--   SELECT * FROM players WHERE user_id = 'test-user-id';  -- Should work
--   
--   -- Reset:
--   RESET ROLE;
