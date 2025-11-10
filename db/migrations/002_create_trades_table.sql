-- Migration: Create trades table for marketplace claim tracking
-- Date: 2025-11-06
-- Description: Tracks pending, confirmed, and failed trades where players exchange resources for OCX

CREATE TABLE IF NOT EXISTS trades (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Player reference
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  
  -- Trade details
  resource_type TEXT, -- 'nickel', 'cobalt', 'copper', 'manganese', or null for direct claims
  resource_amount INTEGER CHECK (resource_amount IS NULL OR resource_amount >= 0),
  ocx_amount TEXT NOT NULL, -- Stored as string to handle BigInt values
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
  
  -- Blockchain data
  tx_hash TEXT UNIQUE, -- Transaction hash (populated after client submits)
  nonce TEXT, -- On-chain nonce used for this claim
  deadline BIGINT, -- Unix timestamp when signature expires
  block_number BIGINT, -- Block number where tx was confirmed
  
  -- Error tracking
  error_message TEXT, -- Error details if status = 'failed'
  
  -- Idempotency
  idempotency_key TEXT UNIQUE, -- Optional client-provided key to prevent duplicates
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_trades_wallet ON trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trades_player ON trades(player_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_tx_hash ON trades(tx_hash);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_idempotency_key ON trades(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Auto-update updated_at timestamp
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

-- Add resource columns to players table if not already present
-- (These may already exist from previous migrations)

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='players' AND column_name='nickel') THEN
    ALTER TABLE players ADD COLUMN nickel INTEGER DEFAULT 0 CHECK (nickel >= 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='players' AND column_name='cobalt') THEN
    ALTER TABLE players ADD COLUMN cobalt INTEGER DEFAULT 0 CHECK (cobalt >= 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='players' AND column_name='copper') THEN
    ALTER TABLE players ADD COLUMN copper INTEGER DEFAULT 0 CHECK (copper >= 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='players' AND column_name='manganese') THEN
    ALTER TABLE players ADD COLUMN manganese INTEGER DEFAULT 0 CHECK (manganese >= 0);
  END IF;
END $$;

-- Add comment documentation
COMMENT ON TABLE trades IS 'Tracks marketplace trades where players exchange resources for OCX tokens via blockchain claims';
COMMENT ON COLUMN trades.status IS 'pending: signature generated but tx not confirmed | confirmed: tx confirmed and DB updated | failed: tx failed or DB update failed';
COMMENT ON COLUMN trades.nonce IS 'On-chain nonce from OCXToken contract used for this claim (prevents replay)';
COMMENT ON COLUMN trades.deadline IS 'Unix timestamp when the EIP-712 signature expires';
COMMENT ON COLUMN trades.idempotency_key IS 'Client-provided key to prevent duplicate trade processing on retries';
