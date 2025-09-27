-- TARGETED Migration for Existing OceanX Database
-- This script only makes necessary changes to your existing database
-- Run this in your Supabase SQL editor

-- =============================================================================
-- 1. FIX PLAYERS TABLE FOR AUTHENTICATION
-- =============================================================================

-- Make wallet_address nullable (critical for auth flow)
-- Users can authenticate without connecting wallet initially
ALTER TABLE players ALTER COLUMN wallet_address DROP NOT NULL;

-- Add unique constraint on user_id (required for authentication)
ALTER TABLE players ADD CONSTRAINT players_user_id_unique UNIQUE(user_id);

-- Ensure wallet_address is unique when not null
-- Drop existing constraint if it exists, then add conditional unique constraint
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_wallet_address_key;
ALTER TABLE players ADD CONSTRAINT players_wallet_address_unique 
  UNIQUE(wallet_address) WHERE wallet_address IS NOT NULL;

-- =============================================================================
-- 2. ADD MISSING INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for authentication lookups
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_wallet_lookup ON players(wallet_address) 
  WHERE wallet_address IS NOT NULL;

-- Index for active players
CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active) 
  WHERE is_active = true;

-- Index for login tracking
CREATE INDEX IF NOT EXISTS idx_players_last_login ON players(last_login);

-- =============================================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on critical tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own player data" ON players;
DROP POLICY IF EXISTS "Users can update their own player data" ON players;
DROP POLICY IF EXISTS "Users can insert their own player data" ON players;

-- Create authentication-based RLS policies
CREATE POLICY "Users can view their own player data" ON players
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own player data" ON players
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own player data" ON players
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Optional: Allow users to delete their own data
CREATE POLICY "Users can delete their own player data" ON players
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 4. CREATE HELPER FUNCTIONS FOR AUTHENTICATION
-- =============================================================================

-- Function to safely link wallet to authenticated user
CREATE OR REPLACE FUNCTION link_wallet_to_user(
  p_user_id UUID,
  p_wallet_address TEXT,
  p_username TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Update existing player or insert new one
  INSERT INTO players (user_id, wallet_address, username, is_active, last_login)
  VALUES (p_user_id, p_wallet_address, p_username, true, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    wallet_address = EXCLUDED.wallet_address,
    username = COALESCE(EXCLUDED.username, players.username),
    is_active = true,
    last_login = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update player last login
CREATE OR REPLACE FUNCTION update_player_login(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE players 
  SET last_login = NOW(), is_active = true, updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. VERIFY CHANGES
-- =============================================================================

DO $$
DECLARE
    rec RECORD;
    constraint_exists BOOLEAN;
BEGIN
    RAISE NOTICE '=== VERIFYING MIGRATION ===';
    
    -- Check wallet_address is now nullable
    SELECT is_nullable INTO rec FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'wallet_address';
    
    RAISE NOTICE 'wallet_address nullable: %', rec.is_nullable;
    
    -- Check if user_id unique constraint exists
    SELECT EXISTS(
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'players' 
        AND constraint_name = 'players_user_id_unique'
    ) INTO constraint_exists;
    
    RAISE NOTICE 'user_id unique constraint: %', constraint_exists;
    
    -- Check RLS status
    SELECT rowsecurity INTO rec FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.tablename = 'players';
    
    RAISE NOTICE 'RLS enabled: %', rec.rowsecurity;
    
    RAISE NOTICE '=== MIGRATION COMPLETE ===';
    RAISE NOTICE 'Your existing data is preserved!';
    RAISE NOTICE 'Authentication system is now compatible!';
END $$;