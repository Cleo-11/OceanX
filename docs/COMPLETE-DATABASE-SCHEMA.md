# 🗄️ Complete OceanX Database Schema - Build from Scratch

This guide shows you how to create **all database tables** for the OceanX ocean mining game from scratch in Supabase.

## 📋 Overview

Your game requires **8 core tables**:
1. **players** - Player profiles, submarine tier, resources, wallet linking
2. **submarine_tiers** - Static submarine tier definitions and stats
3. **pending_actions** - Queued blockchain/game actions
4. **trades** - Marketplace transactions (resources → OCX)
5. **claim_signatures** - Anti-replay security for blockchain claims
6. **resource_nodes** - Server-authoritative mining nodes
7. **mining_attempts** - Audit trail and fraud detection
8. **player_sessions** - Multiplayer session tracking (optional)

---

## 🚀 Step-by-Step Setup

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy/paste each section below **in order**
5. Click **Run** after each section

---

## 📊 Table 1: Players (Core Player Data)

This is the **most important table** - stores all player data, authentication, wallet linking, and game progress.

```sql
-- ========================================
-- PLAYERS TABLE - Core player data
-- ========================================

CREATE TABLE IF NOT EXISTS public.players (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Authentication (Supabase Auth integration)
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Wallet linking (nullable - users auth before linking wallet)
  wallet_address TEXT UNIQUE,
  
  -- Player profile
  username TEXT,
  
  -- Submarine progression
  submarine_tier INTEGER NOT NULL DEFAULT 1 CHECK (submarine_tier >= 1 AND submarine_tier <= 10),
  
  -- Economy
  coins BIGINT NOT NULL DEFAULT 0 CHECK (coins >= 0),
  
  -- Resources (mined from ocean floor)
  nickel INTEGER NOT NULL DEFAULT 0 CHECK (nickel >= 0),
  cobalt INTEGER NOT NULL DEFAULT 0 CHECK (cobalt >= 0),
  copper INTEGER NOT NULL DEFAULT 0 CHECK (copper >= 0),
  manganese INTEGER NOT NULL DEFAULT 0 CHECK (manganese >= 0),
  
  -- Statistics
  total_resources_mined BIGINT DEFAULT 0 CHECK (total_resources_mined >= 0),
  total_ocx_earned NUMERIC(78, 0) DEFAULT 0 CHECK (total_ocx_earned >= 0), -- BigInt for blockchain
  
  -- Activity tracking
  last_reward_claim TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW(),
  last_daily_trade TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
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

-- Auto-create player row when user signs up
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
    total_resources_mined, 
    total_ocx_earned, 
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, 'Player'),
    1,
    0,
    0,
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Trigger on auth.users table (auto-creates player row on signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_player_for_new_user();

COMMENT ON TABLE players IS 'Core player data: profiles, submarine tier, resources, wallet linking, and game progress';
```

---

## 🚢 Table 2: Submarine Tiers (Static Reference Data)

Defines all submarine tiers (1-10) with their stats, storage capacity, and upgrade costs.

```sql
-- ========================================
-- SUBMARINE_TIERS TABLE - Static tier definitions
-- ========================================

CREATE TABLE IF NOT EXISTS public.submarine_tiers (
  -- Primary key
  id SERIAL PRIMARY KEY,
  tier INTEGER UNIQUE NOT NULL CHECK (tier >= 1 AND tier <= 10),
  
  -- Submarine info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Stats
  speed DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  storage INTEGER NOT NULL DEFAULT 100, -- Total storage capacity
  mining_power DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  hull INTEGER NOT NULL DEFAULT 100, -- Health/durability
  
  -- Resource-specific storage (optional, for detailed capacity)
  max_nickel INTEGER,
  max_cobalt INTEGER,
  max_copper INTEGER,
  max_manganese INTEGER,
  
  -- Energy
  energy INTEGER NOT NULL DEFAULT 100,
  
  -- Depth capability
  depth_limit INTEGER DEFAULT 1000,
  
  -- Upgrade cost
  cost BIGINT NOT NULL DEFAULT 0 CHECK (cost >= 0),
  
  -- Visual
  color TEXT DEFAULT '#4A90E2',
  
  -- Special abilities
  special_ability TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default submarine tiers (1-10)
INSERT INTO submarine_tiers (tier, name, description, speed, storage, mining_power, hull, energy, cost, color, special_ability) VALUES
(1, 'Nautilus Scout', 'Starter submarine with basic capabilities', 1.0, 100, 1.0, 100, 100, 0, '#4A90E2', 'None'),
(2, 'Dolphin Explorer', 'Improved speed and storage', 1.2, 150, 1.2, 120, 120, 500, '#5BA3F5', 'Enhanced Sonar'),
(3, 'Orca Hunter', 'Advanced mining power', 1.4, 200, 1.5, 140, 140, 1500, '#6CB8FF', 'Deep Scan'),
(4, 'Kraken Diver', 'Deep-sea capable with heavy storage', 1.6, 300, 1.8, 160, 160, 3500, '#7EC8FF', 'Pressure Resistant'),
(5, 'Leviathan', 'Elite submarine with superior stats', 1.8, 400, 2.2, 180, 180, 7000, '#90D8FF', 'Resource Magnet'),
(6, 'Poseidon\'s Chariot', 'Legendary tier with exceptional mining', 2.0, 500, 2.5, 220, 220, 15000, '#A2E8FF', 'Multi-Node Mining'),
(7, 'Abyssal Titan', 'Ultra-deep explorer', 2.2, 600, 3.0, 260, 260, 30000, '#B4F8FF', 'Abyss Walker'),
(8, 'Oceanic Sovereign', 'Near-maximum capabilities', 2.5, 800, 3.5, 300, 300, 60000, '#C6FFFF', 'Rapid Extraction'),
(9, 'Atlantis Command', 'Top-tier submarine', 2.8, 1000, 4.0, 350, 350, 120000, '#D8FFFF', 'Ancient Technology'),
(10, 'Eternal Depths', 'Ultimate submarine with max stats', 3.0, 1500, 5.0, 400, 400, 250000, '#EAFFFF', 'Master of the Deep')
ON CONFLICT (tier) DO NOTHING;

COMMENT ON TABLE submarine_tiers IS 'Static reference data for all submarine tiers (1-10) with stats and upgrade costs';
```

---

## ⏳ Table 3: Pending Actions (Blockchain Queue)

Tracks queued actions that need blockchain confirmation or deferred processing.

```sql
-- ========================================
-- PENDING_ACTIONS TABLE - Action queue
-- ========================================

CREATE TABLE IF NOT EXISTS public.pending_actions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Action details
  action_type TEXT NOT NULL, -- 'upgrade', 'claim', 'trade', etc.
  payload JSONB, -- Action-specific data
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Error tracking
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

COMMENT ON TABLE pending_actions IS 'Queue for deferred/blockchain actions like upgrades, claims, and trades';
```

---

## 💰 Table 4: Trades (Marketplace Transactions)

Tracks all marketplace trades where players exchange resources for OCX tokens.

```sql
-- ========================================
-- TRADES TABLE - Marketplace transactions
-- ========================================

CREATE TABLE IF NOT EXISTS public.trades (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Player reference
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  
  -- Trade details
  resource_type TEXT CHECK (resource_type IN ('nickel', 'cobalt', 'copper', 'manganese') OR resource_type IS NULL),
  resource_amount INTEGER CHECK (resource_amount IS NULL OR resource_amount >= 0),
  ocx_amount TEXT NOT NULL, -- BigInt as string
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  
  -- Blockchain data
  tx_hash TEXT UNIQUE,
  nonce TEXT,
  deadline BIGINT, -- Unix timestamp
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
```

---

## 🔐 Table 5: Claim Signatures (Anti-Replay Security)

Prevents replay attacks by tracking one-time-use claim signatures.

```sql
-- ========================================
-- CLAIM_SIGNATURES TABLE - Security for blockchain claims
-- ========================================

CREATE TABLE IF NOT EXISTS public.claim_signatures (
  -- Primary key
  claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Authorized wallet
  wallet TEXT NOT NULL,
  
  -- Claim amount (server-calculated)
  amount NUMERIC(78, 0) NOT NULL CHECK (amount > 0),
  
  -- Signature data
  signature TEXT,
  nonce BIGINT,
  
  -- Expiration
  expires_at BIGINT NOT NULL, -- Unix timestamp
  
  -- Usage tracking
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  
  -- Context
  claim_type TEXT, -- 'daily_reward', 'mining_payout', etc.
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

-- Cleanup function for expired claims
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

-- Auto-expire old signatures
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

-- Check nonce usage
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

COMMENT ON TABLE claim_signatures IS 'One-time-use claim signatures to prevent replay attacks on blockchain';
```

---

## ⛏️ Table 6: Resource Nodes (Server-Authoritative Mining)

Tracks all resource nodes in game sessions with state management.

```sql
-- ========================================
-- RESOURCE_NODES TABLE - Mining nodes
-- ========================================

CREATE TABLE IF NOT EXISTS public.resource_nodes (
  -- Primary key
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
  
  -- State
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'depleted', 'respawning')),
  claimed_by_wallet TEXT,
  claimed_by_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  depleted_at TIMESTAMPTZ,
  
  -- Respawn
  respawn_at TIMESTAMPTZ,
  respawn_delay_seconds INTEGER DEFAULT 300, -- 5 minutes
  
  -- Metadata
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

-- Auto-respawn expired nodes
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

COMMENT ON TABLE resource_nodes IS 'Server-authoritative resource nodes for mining with state management and respawn logic';
```

---

## 📊 Table 7: Mining Attempts (Audit Trail & Fraud Detection)

Tracks every mining attempt for security monitoring and anti-cheat.

```sql
-- ========================================
-- MINING_ATTEMPTS TABLE - Audit trail & fraud detection
-- ========================================

CREATE TABLE IF NOT EXISTS public.mining_attempts (
  -- Primary key
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
  
  -- Anti-abuse tracking
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

COMMENT ON TABLE mining_attempts IS 'Audit trail for all mining attempts with fraud detection and security monitoring';
```

---

## 👥 Table 8: Player Sessions (Optional - Multiplayer Tracking)

Tracks active player sessions for multiplayer functionality.

```sql
-- ========================================
-- PLAYER_SESSIONS TABLE - Multiplayer session tracking (OPTIONAL)
-- ========================================

CREATE TABLE IF NOT EXISTS public.player_sessions (
  -- Primary key
  id SERIAL PRIMARY KEY,
  
  -- Player reference
  wallet_address TEXT UNIQUE NOT NULL,
  
  -- Session info
  session_id TEXT,
  
  -- Activity tracking
  last_login TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_player_sessions_wallet ON player_sessions(wallet_address);
CREATE INDEX idx_player_sessions_active ON player_sessions(is_active);

COMMENT ON TABLE player_sessions IS 'Active player sessions for multiplayer game state management';
```

---

## 🔒 Row Level Security (RLS) Policies

Enable security policies to protect user data.

```sql
-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mining_attempts ENABLE ROW LEVEL SECURITY;

-- ============================
-- PLAYERS POLICIES
-- ============================

-- Users can read their own profile + view active players (leaderboards)
CREATE POLICY players_select ON players
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND (
      auth.uid() = user_id OR is_active = true
    )
  );

-- Users can insert their own profile
CREATE POLICY players_insert ON players
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY players_update ON players
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND auth.uid() = user_id)
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- Prevent deletes (use soft-delete via is_active)
CREATE POLICY players_delete ON players
  FOR DELETE
  USING (false);

-- ============================
-- PENDING_ACTIONS POLICIES
-- ============================

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

-- ============================
-- TRADES POLICIES
-- ============================

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
  USING (false); -- Prevent deletes for audit trail

-- ============================
-- RESOURCE_NODES POLICIES
-- ============================

-- Users can read available/respawning nodes
CREATE POLICY resource_nodes_select ON resource_nodes
  FOR SELECT
  USING (auth.role() = 'authenticated' AND status IN ('available', 'respawning'));

-- ============================
-- MINING_ATTEMPTS POLICIES
-- ============================

-- Users can only see their own attempts
CREATE POLICY mining_attempts_select ON mining_attempts
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND 
    wallet_address = (SELECT wallet_address FROM players WHERE user_id = auth.uid())
  );

-- ============================
-- SERVICE ROLE FULL ACCESS
-- ============================

-- Backend (service_role) has full access to all tables
CREATE POLICY service_role_players ON players FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_pending_actions ON pending_actions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_trades ON trades FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_claim_signatures ON claim_signatures FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_resource_nodes ON resource_nodes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY service_role_mining_attempts ON mining_attempts FOR ALL USING (auth.role() = 'service_role');
```

---

## ✅ Verification

After running all SQL above, verify your schema:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('players', 'submarine_tiers', 'pending_actions', 'trades', 'claim_signatures', 'resource_nodes', 'mining_attempts')
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('players', 'pending_actions', 'trades', 'claim_signatures', 'resource_nodes', 'mining_attempts');

-- Count policies
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

---

## 🎯 Expected Results

You should see:
- ✅ **8 tables** created (7 core + 1 optional)
- ✅ **RLS enabled** on 6 tables
- ✅ **Multiple policies** per table
- ✅ **Auto-triggers** for timestamps and player creation
- ✅ **Indexes** for performance
- ✅ **Check constraints** for data validation

---

## 📝 Key Features

### Authentication Flow
1. User signs up → `auth.users` row created
2. **Trigger auto-creates** `players` row with `user_id`
3. User can play immediately (no wallet required)
4. User links wallet later → `wallet_address` populated

### Security
- **RLS policies** enforce user isolation
- **Anti-replay** via `claim_signatures` nonce tracking
- **Fraud detection** via `mining_attempts` monitoring
- **Server-authoritative** resource nodes prevent cheating

### Data Relationships
```
auth.users (Supabase Auth)
    ↓ (trigger creates)
players
    ↓ (references)
├── pending_actions (user_id)
├── trades (player_id)
├── mining_attempts (player_id)
└── resource_nodes (claimed_by_player_id)

claim_signatures (standalone, wallet-based)
submarine_tiers (static reference data)
```

---

## 🚀 Next Steps

After creating the database:

1. **Test Authentication**
   - Sign up a test user
   - Verify `players` row is auto-created
   - Check `user_id` is populated

2. **Test Wallet Linking**
   - Link a wallet to the test user
   - Verify `wallet_address` is updated

3. **Deploy Backend**
   - Configure environment variables (Supabase URL, keys)
   - Test API endpoints
   - Verify RLS policies work

4. **Play the Game!**
   - Start mining
   - Upgrade submarines
   - Trade resources for OCX

---

## 🔧 Maintenance

### Periodic Cleanup (Run daily/weekly)

```sql
-- Clean up expired claim signatures
SELECT cleanup_expired_claim_signatures();

-- Respawn expired resource nodes
SELECT respawn_expired_nodes();

-- Archive old mining attempts (optional)
DELETE FROM mining_attempts 
WHERE created_at < NOW() - INTERVAL '30 days' 
  AND is_suspicious = false;
```

---

## 📚 Documentation

For more details, see:
- `docs/DATABASE-MIGRATION-GUIDE.md` - Migration from old schema
- `docs/SUPABASE-RLS-FIX.md` - RLS troubleshooting
- `db/migrations/` - Individual migration files
- `scripts/production-database-setup.sql` - Production fixes

---

**🎉 Your database is now complete and ready for production!**
