-- Migration 005: Create resource_nodes table for server-authoritative mining
-- Tracks all resource nodes in game sessions with state management

-- Create resource_nodes table
CREATE TABLE IF NOT EXISTS public.resource_nodes (
  id BIGSERIAL PRIMARY KEY,
  
  -- Node identification
  node_id TEXT NOT NULL UNIQUE, -- Format: "node-{sessionId}-{x}-{y}-{z}-{timestamp}"
  session_id TEXT NOT NULL,
  
  -- Resource properties
  resource_type TEXT NOT NULL CHECK (resource_type IN ('nickel', 'cobalt', 'copper', 'manganese')),
  resource_amount INTEGER NOT NULL DEFAULT 1 CHECK (resource_amount > 0),
  
  -- Position (for range validation)
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  position_z DOUBLE PRECISION NOT NULL,
  
  -- Node state
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'depleted', 'respawning')),
  claimed_by_wallet TEXT, -- Wallet address of player who claimed it
  claimed_by_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  depleted_at TIMESTAMPTZ,
  
  -- Respawn logic
  respawn_at TIMESTAMPTZ, -- When node becomes available again
  respawn_delay_seconds INTEGER DEFAULT 300, -- 5 minutes default
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Rarity/difficulty (for future use)
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  difficulty_multiplier DECIMAL(3,2) DEFAULT 1.0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_resource_nodes_session_id ON public.resource_nodes(session_id);
CREATE INDEX IF NOT EXISTS idx_resource_nodes_status ON public.resource_nodes(status);
CREATE INDEX IF NOT EXISTS idx_resource_nodes_claimed_by ON public.resource_nodes(claimed_by_wallet);
CREATE INDEX IF NOT EXISTS idx_resource_nodes_respawn_at ON public.resource_nodes(respawn_at) WHERE respawn_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resource_nodes_position ON public.resource_nodes(position_x, position_y, position_z);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_resource_nodes_session_status ON public.resource_nodes(session_id, status);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_resource_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_resource_nodes_updated_at
  BEFORE UPDATE ON public.resource_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_resource_nodes_updated_at();

-- Auto-respawn expired nodes (run periodically via cron or app logic)
CREATE OR REPLACE FUNCTION respawn_expired_nodes()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.resource_nodes
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

-- Grant permissions (adjust based on your RLS policies)
ALTER TABLE public.resource_nodes ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY service_role_all_resource_nodes ON public.resource_nodes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to read available nodes
CREATE POLICY read_available_nodes ON public.resource_nodes
  FOR SELECT
  USING (auth.role() = 'authenticated' AND status IN ('available', 'respawning'));

COMMENT ON TABLE public.resource_nodes IS 'Server-authoritative resource nodes for mining system';
COMMENT ON COLUMN public.resource_nodes.node_id IS 'Unique identifier for this specific node instance';
COMMENT ON COLUMN public.resource_nodes.status IS 'Current state: available, claimed, depleted, respawning';
COMMENT ON COLUMN public.resource_nodes.respawn_at IS 'Timestamp when node will become available again';
