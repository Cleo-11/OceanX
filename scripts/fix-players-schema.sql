-- Updated players table schema to match application code
-- This script should be run to fix the database schema mismatch

-- First, backup existing data if needed
-- CREATE TABLE players_backup AS SELECT * FROM players;

-- Add missing columns to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS username VARCHAR(255),
ADD COLUMN IF NOT EXISTS total_resources_mined INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_ocx_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Make wallet_address nullable since we now link via user_id
ALTER TABLE players ALTER COLUMN wallet_address DROP NOT NULL;

-- Update unique constraints
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_wallet_address_key;
ALTER TABLE players ADD CONSTRAINT players_user_id_unique UNIQUE(user_id);
ALTER TABLE players ADD CONSTRAINT players_wallet_address_unique UNIQUE(wallet_address) WHERE wallet_address IS NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_wallet_address ON players(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_last_login ON players(last_login);

-- Enable RLS (Row Level Security)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own player data" ON players;
CREATE POLICY "Users can view their own player data" ON players
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own player data" ON players;
CREATE POLICY "Users can update their own player data" ON players
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own player data" ON players;
CREATE POLICY "Users can insert their own player data" ON players
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update existing records if needed (optional)
-- UPDATE players SET user_id = auth.uid() WHERE user_id IS NULL AND auth.uid() IS NOT NULL;

COMMENT ON TABLE players IS 'Player profiles linked to authenticated users via user_id and optionally linked to wallet addresses';
COMMENT ON COLUMN players.user_id IS 'Link to auth.users - primary identifier for player account';
COMMENT ON COLUMN players.wallet_address IS 'Web3 wallet address - optional, used for blockchain interactions';