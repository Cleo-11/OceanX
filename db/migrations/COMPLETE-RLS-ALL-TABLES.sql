-- ============================================================================
-- COMPLETE RLS SETUP FOR NEW DATABASE
-- ============================================================================
-- This migration applies RLS to ALL tables in your new database.
-- Run this ONCE in Supabase SQL Editor after creating a fresh database.
--
-- Tables covered:
-- 1. players
-- 2. claim_signatures
-- 3. game_sessions
-- 4. mining_attempts
-- 5. pending_actions
-- 6. resource_nodes
-- 7. submarine_tiers
-- 8. trades
-- ============================================================================

-- ============================================================================
-- 1. PLAYERS TABLE
-- ============================================================================

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access on players"
  ON public.players
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can view their own player data
CREATE POLICY "Users can view their own player data"
  ON public.players
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own player data
CREATE POLICY "Users can update their own player data"
  ON public.players
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users cannot delete player records
CREATE POLICY "Users cannot delete player records"
  ON public.players
  FOR DELETE
  USING (false);

-- Users cannot create player records (only service_role can)
CREATE POLICY "Only service role can create players"
  ON public.players
  FOR INSERT
  WITH CHECK (false);

COMMENT ON TABLE public.players IS 'Player accounts with RLS enabled';

-- ============================================================================
-- 2. CLAIM SIGNATURES TABLE
-- ============================================================================

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

-- Only service role can modify claim signatures
CREATE POLICY "Only service role can create claim signatures"
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

COMMENT ON TABLE public.claim_signatures IS 'Server-signed claim signatures with strict RLS';

-- ============================================================================
-- 3. GAME SESSIONS TABLE
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

COMMENT ON TABLE public.game_sessions IS 'Multiplayer game sessions with host-based access control';

-- ============================================================================
-- 4. MINING ATTEMPTS TABLE
-- ============================================================================

ALTER TABLE public.mining_attempts ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access on mining_attempts"
  ON public.mining_attempts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can view their own mining attempts
CREATE POLICY "Users can view their own mining attempts"
  ON public.mining_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE players.wallet_address = mining_attempts.wallet_address 
      AND players.user_id = auth.uid()
    )
  );

-- Only service role can create mining attempts (server-authoritative)
CREATE POLICY "Only service role can create mining attempts"
  ON public.mining_attempts
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Only service role can update mining attempts"
  ON public.mining_attempts
  FOR UPDATE
  USING (false);

CREATE POLICY "Only service role can delete mining attempts"
  ON public.mining_attempts
  FOR DELETE
  USING (false);

COMMENT ON TABLE public.mining_attempts IS 'Anti-cheat mining logs with server-only writes';

-- ============================================================================
-- 5. PENDING ACTIONS TABLE
-- ============================================================================

ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access on pending_actions"
  ON public.pending_actions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can view their own pending actions
CREATE POLICY "Users can view their own pending actions"
  ON public.pending_actions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own pending actions
CREATE POLICY "Users can create their own pending actions"
  ON public.pending_actions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending actions
CREATE POLICY "Users can update their own pending actions"
  ON public.pending_actions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own pending actions
CREATE POLICY "Users can delete their own pending actions"
  ON public.pending_actions
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.pending_actions IS 'User action queue with full CRUD for own actions';

-- ============================================================================
-- 6. RESOURCE NODES TABLE
-- ============================================================================

ALTER TABLE public.resource_nodes ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access on resource_nodes"
  ON public.resource_nodes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Everyone can view resource nodes (public game data)
CREATE POLICY "Anyone can view resource nodes"
  ON public.resource_nodes
  FOR SELECT
  USING (true);

-- Only service role can modify resource nodes
CREATE POLICY "Only service role can create resource nodes"
  ON public.resource_nodes
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Only service role can update resource nodes"
  ON public.resource_nodes
  FOR UPDATE
  USING (false);

CREATE POLICY "Only service role can delete resource nodes"
  ON public.resource_nodes
  FOR DELETE
  USING (false);

COMMENT ON TABLE public.resource_nodes IS 'World state - public read, server-only write';

-- ============================================================================
-- 7. SUBMARINE TIERS TABLE
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
CREATE POLICY "Only service role can create submarine tiers"
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

COMMENT ON TABLE public.submarine_tiers IS 'Reference data - public read, server-only write';

-- ============================================================================
-- 8. TRADES TABLE
-- ============================================================================

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access on trades"
  ON public.trades
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can view their own trades
CREATE POLICY "Users can view their own trades"
  ON public.trades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE players.wallet_address = trades.wallet_address
      AND players.user_id = auth.uid()
    )
  );

-- Only service role can modify trades (prevents manipulation)
CREATE POLICY "Only service role can create trades"
  ON public.trades
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Only service role can update trades"
  ON public.trades
  FOR UPDATE
  USING (false);

CREATE POLICY "Only service role can delete trades"
  ON public.trades
  FOR DELETE
  USING (false);

COMMENT ON TABLE public.trades IS 'Marketplace transactions - server-only writes';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Display RLS status for all tables
DO $$
DECLARE
  rec RECORD;
  total_tables INTEGER := 0;
  total_enabled INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== RLS STATUS SUMMARY ===';
  RAISE NOTICE '';
  
  FOR rec IN 
    SELECT schemaname, tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('players', 'claim_signatures', 'game_sessions', 
                      'mining_attempts', 'pending_actions', 'resource_nodes', 
                      'submarine_tiers', 'trades')
    ORDER BY tablename
  LOOP
    total_tables := total_tables + 1;
    IF rec.rowsecurity THEN
      total_enabled := total_enabled + 1;
      RAISE NOTICE '✅ %.% - RLS Enabled: %', rec.schemaname, rec.tablename, rec.rowsecurity;
    ELSE
      RAISE NOTICE '❌ %.% - RLS Enabled: %', rec.schemaname, rec.tablename, rec.rowsecurity;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== SUMMARY ===';
  RAISE NOTICE 'Total tables: %', total_tables;
  RAISE NOTICE 'RLS enabled: %', total_enabled;
  
  IF total_enabled = total_tables THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SUCCESS! All % tables are now protected by RLS!', total_tables;
    RAISE NOTICE '';
  ELSE
    RAISE WARNING 'Only % out of % tables have RLS enabled!', total_enabled, total_tables;
  END IF;
END $$;

-- Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('players', 'claim_signatures', 'game_sessions', 
                  'mining_attempts', 'pending_actions', 'resource_nodes', 
                  'submarine_tiers', 'trades')
GROUP BY tablename
ORDER BY tablename;
