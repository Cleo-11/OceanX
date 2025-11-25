-- ========================================
-- OceanX - Fresh Database Creation Script
-- ========================================
-- Purpose: Create a brand new database from scratch matching your exact current schema
-- Date: November 25, 2025
-- Instructions: Copy and paste this ENTIRE script into Supabase SQL Editor and run it
-- ========================================

-- ========================================
-- TABLE 1: PLAYERS
-- Core player profiles with authentication and game state
-- ========================================

CREATE TABLE IF NOT EXISTS public.players (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Authentication (Supabase Auth integration)
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Wallet linking (nullable - users can auth before linking wallet)
  wallet_address TEXT UNIQUE,
  
  -- Player identity
  username TEXT,
  
  -- Submarine progression
  submarine_tier INTEGER NOT NULL DEFAULT 1 CHECK (submarine_tier >= 1 AND submarine_tier <= 10),
  
  -- Economy
  coins BIGINT NOT NULL DEFAULT 0 CHECK (coins >= 0),
  
  -- Mined resources
  nickel INTEGER NOT NULL DEFAULT 0 CHECK (nickel >= 0),
  cobalt INTEGER NOT NULL DEFAULT 0 CHECK (cobalt >= 0),
  copper INTEGER NOT NULL DEFAULT 0 CHECK (copper >= 0),
  manganese INTEGER NOT NULL DEFAULT 0 CHECK (manganese >= 0),
  
  -- Statistics
  total_resources_mined BIGINT DEFAULT 0 CHECK (total_resources_mined >= 0),
  total_ocx_earned NUMERIC(78, 0) DEFAULT 0 CHECK (total_ocx_earned >= 0),
  
  -- Activity tracking
  last_reward_claim TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW(),
  last_daily_trade TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_players_user_id ON players(user_id);
CREATE INDEX idx_players_wallet_address ON players(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX idx_players_active ON players(is_active) WHERE is_active = true;
CREATE INDEX idx_players_last_login ON players(last_login);
CREATE INDEX idx_players_submarine_tier ON players(submarine_tier);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_players_updated_at();

-- Auto-create player on user signup
CREATE OR REPLACE FUNCTION create_player_for_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.players (
    user_id, 
    username, 
    submarine_tier, 
    coins,
    total_resources_mined, 
    total_ocx_earned, 
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',  -- Username from signup form
      NEW.raw_user_meta_data->>'full_name', -- Google display name
      SPLIT_PART(NEW.email, '@', 1),       -- Email prefix as fallback
      'Player'                              -- Ultimate fallback
    ),
    1,
    0,
    0,
    0,
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_player_for_new_user();

COMMENT ON TABLE players IS 'Core player profiles linked to Supabase auth with game state and resources';

-- ========================================
-- TABLE 2: SUBMARINE_TIERS
-- Static reference data for submarine tiers 1-10
-- ========================================

CREATE TABLE IF NOT EXISTS public.submarine_tiers (
  id SERIAL PRIMARY KEY,
  tier INTEGER UNIQUE NOT NULL CHECK (tier >= 1 AND tier <= 10),
  
  -- Submarine info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Core stats
  speed DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  storage INTEGER NOT NULL DEFAULT 100,
  mining_power DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  hull INTEGER NOT NULL DEFAULT 100,
  
  -- Resource-specific storage (per-resource limits)
  max_nickel INTEGER,
  max_cobalt INTEGER,
  max_copper INTEGER,
  max_manganese INTEGER,
  
  -- Energy system
  energy INTEGER NOT NULL DEFAULT 100,
  
  -- Depth capability
  depth_limit INTEGER DEFAULT 1000,
  
  -- Upgrade cost (in coins)
  cost BIGINT NOT NULL DEFAULT 0 CHECK (cost >= 0),
  
  -- Visual
  color TEXT DEFAULT '#4A90E2',
  
  -- Special abilities
  special_ability TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default submarine tiers
INSERT INTO submarine_tiers (tier, name, description, speed, storage, mining_power, hull, energy, cost, color, special_ability) VALUES
(1, 'Nautilus Scout', 'Starter submarine with basic capabilities', 1.0, 100, 1.0, 100, 100, 0, '#4A90E2', 'None'),
(2, 'Dolphin Explorer', 'Improved speed and storage', 1.2, 150, 1.2, 120, 120, 500, '#5BA3F5', 'Enhanced Sonar'),
(3, 'Orca Hunter', 'Advanced mining power', 1.4, 200, 1.5, 140, 140, 1500, '#6CB8FF', 'Deep Scan'),
(4, 'Kraken Diver', 'Deep-sea capable with heavy storage', 1.6, 300, 1.8, 160, 160, 3500, '#7EC8FF', 'Pressure Resistant'),
(5, 'Leviathan', 'Elite submarine with superior stats', 1.8, 400, 2.2, 180, 180, 7000, '#90D8FF', 'Resource Magnet'),
(6, 'Poseidon''s Chariot', 'Legendary tier with exceptional mining', 2.0, 500, 2.5, 220, 220, 15000, '#A2E8FF', 'Multi-Node Mining'),
(7, 'Abyssal Titan', 'Ultra-deep explorer', 2.2, 600, 3.0, 260, 260, 30000, '#B4F8FF', 'Abyss Walker'),
(8, 'Oceanic Sovereign', 'Near-maximum capabilities', 2.5, 800, 3.5, 300, 300, 60000, '#C6FFFF', 'Rapid Extraction'),
(9, 'Atlantis Command', 'Top-tier submarine', 2.8, 1000, 4.0, 350, 350, 120000, '#D8FFFF', 'Ancient Technology'),
(10, 'Eternal Depths', 'Ultimate submarine with max stats', 3.0, 1500, 5.0, 400, 400, 250000, '#EAFFFF', 'Master of the Deep')
ON CONFLICT (tier) DO NOTHING;

COMMENT ON TABLE submarine_tiers IS 'Static reference data for submarine tiers with stats and upgrade costs';

-- ========================================
-- TABLE 3: PENDING_ACTIONS
-- Queue for blockchain and deferred actions
-- ========================================

CREATE TABLE IF NOT EXISTS public.pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Action details
  action_type TEXT NOT NULL,
  payload JSONB,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pending_actions_user_id ON pending_actions(user_id);
CREATE INDEX idx_pending_actions_status ON pending_actions(status);
CREATE INDEX idx_pending_actions_action_type ON pending_actions(action_type);
CREATE INDEX idx_pending_actions_created_at ON pending_actions(created_at DESC);

COMMENT ON TABLE pending_actions IS 'Queue for blockchain transactions and deferred game actions';

-- ========================================
-- TABLE 4: TRADES
-- Marketplace transactions (resources -> OCX)
-- ========================================

CREATE TABLE IF NOT EXISTS public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Player reference
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  
  -- Trade details
  resource_type TEXT CHECK (resource_type IN ('nickel', 'cobalt', 'copper', 'manganese') OR resource_type IS NULL),
  resource_amount INTEGER CHECK (resource_amount IS NULL OR resource_amount >= 0),
  ocx_amount TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  
  -- Blockchain data
  tx_hash TEXT UNIQUE,
  nonce TEXT,
  deadline BIGINT,
  block_number BIGINT,
  
  -- Error tracking
  error_message TEXT,
  
  -- Idempotency
  idempotency_key TEXT UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trades_wallet ON trades(wallet_address);
CREATE INDEX idx_trades_player ON trades(player_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_tx_hash ON trades(tx_hash);
CREATE INDEX idx_trades_created_at ON trades(created_at DESC);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_trades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_trades_updated_at();

COMMENT ON TABLE trades IS 'Marketplace trades where players exchange resources for OCX tokens';

-- ========================================
-- TABLE 5: CLAIM_SIGNATURES
-- Anti-replay security for blockchain claims
-- ========================================

CREATE TABLE IF NOT EXISTS public.claim_signatures (
  claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Authorized wallet
  wallet TEXT NOT NULL,
  
  -- Claim amount
  amount NUMERIC(78, 0) NOT NULL CHECK (amount > 0),
  
  -- Signature data
  signature TEXT,
  nonce BIGINT,
  
  -- Expiration
  expires_at BIGINT NOT NULL,
  
  -- Usage tracking
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  
  -- Context
  claim_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_expiration CHECK (expires_at > EXTRACT(EPOCH FROM created_at)),
  CONSTRAINT used_at_requires_used CHECK (
    (used = TRUE AND used_at IS NOT NULL) OR 
    (used = FALSE AND used_at IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_claim_signatures_wallet ON claim_signatures(wallet);
CREATE INDEX idx_claim_signatures_expires_at ON claim_signatures(expires_at);
CREATE INDEX idx_claim_signatures_wallet_unused ON claim_signatures(wallet, used) WHERE used = FALSE;
CREATE UNIQUE INDEX idx_claim_sigs_wallet_nonce_unique ON claim_signatures(wallet, nonce) WHERE nonce IS NOT NULL;

-- Helper functions
CREATE OR REPLACE FUNCTION cleanup_expired_claim_signatures()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM claim_signatures
  WHERE used = FALSE 
    AND expires_at < EXTRACT(EPOCH FROM NOW());
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION expire_old_claim_signatures()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
  current_timestamp_seconds BIGINT;
BEGIN
  current_timestamp_seconds := EXTRACT(EPOCH FROM NOW())::BIGINT;
  
  UPDATE claim_signatures
  SET used = true, used_at = NOW()
  WHERE expires_at < current_timestamp_seconds AND used = false;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_nonce_usage(p_wallet TEXT, p_nonce BIGINT)
RETURNS TABLE (
  claim_id UUID,
  signature TEXT,
  amount NUMERIC,
  expires_at BIGINT,
  used BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT cs.claim_id, cs.signature, cs.amount, cs.expires_at, cs.used
  FROM claim_signatures cs
  WHERE cs.wallet = lower(p_wallet) AND cs.nonce = p_nonce
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE claim_signatures IS 'One-time-use claim signatures to prevent replay attacks';

-- ========================================
-- TABLE 6: RESOURCE_NODES
-- Server-authoritative mining nodes
-- ========================================

CREATE TABLE IF NOT EXISTS public.resource_nodes (
  id BIGSERIAL PRIMARY KEY,
  
  -- Node identification
  node_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  
  -- Resource properties
  resource_type TEXT NOT NULL CHECK (resource_type IN ('nickel', 'cobalt', 'copper', 'manganese')),
  resource_amount INTEGER NOT NULL DEFAULT 1 CHECK (resource_amount > 0),
  
  -- Position
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  position_z DOUBLE PRECISION NOT NULL,
  
  -- State management
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'depleted', 'respawning')),
  claimed_by_wallet TEXT,
  claimed_by_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  depleted_at TIMESTAMPTZ,
  
  -- Respawn logic
  respawn_at TIMESTAMPTZ,
  respawn_delay_seconds INTEGER DEFAULT 300,
  
  -- Node properties
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  difficulty_multiplier DECIMAL(3,2) DEFAULT 1.0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_resource_nodes_session_id ON resource_nodes(session_id);
CREATE INDEX idx_resource_nodes_status ON resource_nodes(status);
CREATE INDEX idx_resource_nodes_claimed_by ON resource_nodes(claimed_by_wallet);
CREATE INDEX idx_resource_nodes_respawn_at ON resource_nodes(respawn_at) WHERE respawn_at IS NOT NULL;
CREATE INDEX idx_resource_nodes_session_status ON resource_nodes(session_id, status);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_resource_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_resource_nodes_updated_at
  BEFORE UPDATE ON resource_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_resource_nodes_updated_at();

-- Auto-respawn function
CREATE OR REPLACE FUNCTION respawn_expired_nodes()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE resource_nodes
  SET 
    status = 'available',
    claimed_by_wallet = NULL,
    claimed_by_player_id = NULL,
    claimed_at = NULL,
    respawn_at = NULL
  WHERE status = 'respawning' 
    AND respawn_at IS NOT NULL 
    AND respawn_at <= NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE resource_nodes IS 'Server-authoritative resource nodes with state management and respawn logic';

-- ========================================
-- TABLE 7: MINING_ATTEMPTS
-- Audit trail and fraud detection
-- ========================================

CREATE TABLE IF NOT EXISTS public.mining_attempts (
  id BIGSERIAL PRIMARY KEY,
  
  -- Idempotency
  attempt_id TEXT NOT NULL UNIQUE,
  
  -- Player info
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  session_id TEXT NOT NULL,
  
  -- Node info
  node_id TEXT NOT NULL,
  resource_node_db_id BIGINT REFERENCES resource_nodes(id) ON DELETE SET NULL,
  
  -- Position validation
  position_x DOUBLE PRECISION,
  position_y DOUBLE PRECISION,
  position_z DOUBLE PRECISION,
  distance_to_node DOUBLE PRECISION,
  
  -- Result
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  resource_type TEXT,
  resource_amount INTEGER,
  
  -- Client tracking
  ip_address TEXT,
  user_agent TEXT,
  client_version TEXT,
  
  -- Timing
  attempt_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_duration_ms INTEGER,
  
  -- Fraud detection
  is_suspicious BOOLEAN DEFAULT false,
  suspicious_reasons TEXT[],
  flagged_for_review BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mining_attempts_wallet ON mining_attempts(wallet_address);
CREATE INDEX idx_mining_attempts_player_id ON mining_attempts(player_id);
CREATE INDEX idx_mining_attempts_node_id ON mining_attempts(node_id);
CREATE INDEX idx_mining_attempts_session ON mining_attempts(session_id);
CREATE INDEX idx_mining_attempts_timestamp ON mining_attempts(attempt_timestamp DESC);
CREATE INDEX idx_mining_attempts_suspicious ON mining_attempts(is_suspicious) WHERE is_suspicious = true;
CREATE INDEX idx_mining_attempts_wallet_time ON mining_attempts(wallet_address, attempt_timestamp DESC);

-- Fraud detection trigger
CREATE OR REPLACE FUNCTION detect_suspicious_mining_patterns()
RETURNS TRIGGER AS $$
DECLARE
  recent_attempts INTEGER;
  suspicious_flags TEXT[] := '{}';
BEGIN
  -- Check rapid succession (>10 attempts in 1 minute)
  SELECT COUNT(*) INTO recent_attempts
  FROM mining_attempts
  WHERE wallet_address = NEW.wallet_address
    AND attempt_timestamp > NOW() - INTERVAL '1 minute';
  
  IF recent_attempts > 10 THEN
    suspicious_flags := array_append(suspicious_flags, 'rapid_succession');
  END IF;
  
  -- Check impossible distance (optional - can add more checks)
  IF NEW.distance_to_node IS NOT NULL AND NEW.distance_to_node > 1000 THEN
    suspicious_flags := array_append(suspicious_flags, 'impossible_distance');
  END IF;
  
  -- Update flags
  IF array_length(suspicious_flags, 1) > 0 THEN
    NEW.is_suspicious := true;
    NEW.suspicious_reasons := suspicious_flags;
    
    IF array_length(suspicious_flags, 1) >= 2 THEN
      NEW.flagged_for_review := true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_detect_suspicious_mining
  BEFORE INSERT ON mining_attempts
  FOR EACH ROW
  EXECUTE FUNCTION detect_suspicious_mining_patterns();

COMMENT ON TABLE mining_attempts IS 'Audit trail for all mining attempts with fraud detection';

-- ========================================
-- TABLE 8: GAME_SESSIONS
-- Multiplayer session tracking
-- ========================================

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session info
  session_id TEXT UNIQUE NOT NULL,
  
  -- Host info
  host_wallet TEXT,
  host_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  
  -- Session properties
  max_players INTEGER DEFAULT 10,
  current_players INTEGER DEFAULT 0,
  
  -- Map/world settings
  world_seed TEXT,
  map_size TEXT DEFAULT 'medium',
  difficulty TEXT DEFAULT 'normal',
  
  -- State
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  
  -- Activity
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_game_sessions_session_id ON game_sessions(session_id);
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_sessions_host ON game_sessions(host_player_id);
CREATE INDEX idx_game_sessions_last_activity ON game_sessions(last_activity);

COMMENT ON TABLE game_sessions IS 'Multiplayer game sessions for tracking active games';

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mining_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- PLAYERS POLICIES
CREATE POLICY players_select ON players
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      auth.uid() = user_id OR is_active = true
    )
  );

CREATE POLICY players_insert ON players
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY players_update ON players
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id)
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY players_delete ON players
  FOR DELETE
  USING (false);

-- PENDING_ACTIONS POLICIES
CREATE POLICY pending_actions_select ON pending_actions
  FOR SELECT
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY pending_actions_insert ON pending_actions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY pending_actions_update ON pending_actions
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id)
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY pending_actions_delete ON pending_actions
  FOR DELETE
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- TRADES POLICIES
CREATE POLICY trades_select ON trades
  FOR SELECT
  USING (auth.role() = 'authenticated' AND auth.uid() = player_id);

CREATE POLICY trades_insert ON trades
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = player_id);

CREATE POLICY trades_update ON trades
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND auth.uid() = player_id)
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = player_id);

CREATE POLICY trades_delete ON trades
  FOR DELETE
  USING (false);

-- RESOURCE_NODES POLICIES
CREATE POLICY resource_nodes_select ON resource_nodes
  FOR SELECT
  USING (auth.role() = 'authenticated' AND status IN ('available', 'respawning'));

-- MINING_ATTEMPTS POLICIES
CREATE POLICY mining_attempts_select ON mining_attempts
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND 
    wallet_address = (SELECT wallet_address FROM players WHERE user_id = auth.uid())
  );

-- GAME_SESSIONS POLICIES
CREATE POLICY game_sessions_select ON game_sessions
  FOR SELECT
  USING (auth.role() = 'authenticated' AND status = 'active');

-- SERVICE ROLE FULL ACCESS (for backend operations)
CREATE POLICY service_role_players ON players FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_pending_actions ON pending_actions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_trades ON trades FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_claim_signatures ON claim_signatures FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_resource_nodes ON resource_nodes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_mining_attempts ON mining_attempts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_game_sessions ON game_sessions FOR ALL USING (auth.role() = 'service_role');

-- ========================================
-- VERIFICATION QUERIES
-- Run these after the script to verify everything is correct
-- ========================================

-- Check all tables exist
SELECT 'Tables Created:' AS status, COUNT(*) AS count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('players', 'submarine_tiers', 'pending_actions', 'trades', 'claim_signatures', 'resource_nodes', 'mining_attempts', 'game_sessions');

-- Check RLS is enabled
SELECT 'RLS Enabled:' AS status, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('players', 'pending_actions', 'trades', 'claim_signatures', 'resource_nodes', 'mining_attempts', 'game_sessions');

-- Check trigger exists
SELECT 'Triggers:' AS status, tgname, tgrelid::regclass::text AS table_name
FROM pg_trigger
WHERE tgname ILIKE '%player%' OR tgname ILIKE '%auth%';

-- Check submarine tiers inserted
SELECT 'Submarine Tiers:' AS status, COUNT(*) AS tier_count FROM submarine_tiers;

-- Check players table columns
SELECT 'Players Columns:' AS status, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'players' 
  AND column_name IN ('id', 'user_id', 'wallet_address', 'coins', 'submarine_tier', 'nickel', 'cobalt', 'copper', 'manganese')
ORDER BY ordinal_position;

-- ========================================
-- SUCCESS!
-- ========================================
-- Your fresh OceanX database is ready!
-- Next steps:
-- 1. Configure environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.)
-- 2. Test user signup (should auto-create player row)
-- 3. Deploy backend and start playing!
-- ========================================
