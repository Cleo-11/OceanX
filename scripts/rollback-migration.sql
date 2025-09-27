-- ROLLBACK SCRIPT for OceanX Database Migration
-- This script undoes all changes made by production-database-setup.sql
-- Run this in your Supabase SQL editor if you need to revert changes

-- =============================================================================
-- ROLLBACK CONFIRMATION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '⚠️  ROLLBACK SCRIPT STARTING';
    RAISE NOTICE 'This will undo the authentication migration changes';
    RAISE NOTICE 'Your data will remain safe, only constraints will change';
    RAISE NOTICE '==========================================';
END $$;

-- =============================================================================
-- 1. REMOVE RLS POLICIES
-- =============================================================================

-- Disable RLS and drop policies
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own player data" ON players;
DROP POLICY IF EXISTS "Users can update their own player data" ON players;
DROP POLICY IF EXISTS "Users can insert their own player data" ON players;
DROP POLICY IF EXISTS "Users can delete their own player data" ON players;

RAISE NOTICE '✅ RLS policies removed';

-- =============================================================================
-- 2. REMOVE CONSTRAINTS
-- =============================================================================

-- Remove the unique constraint on user_id
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_user_id_unique;

-- Remove the conditional unique constraint on wallet_address
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_wallet_address_unique;

RAISE NOTICE '✅ Unique constraints removed';

-- =============================================================================
-- 3. RESTORE ORIGINAL WALLET_ADDRESS CONSTRAINT
-- =============================================================================

-- Check if there are any NULL wallet addresses before making it NOT NULL
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM players WHERE wallet_address IS NULL;
    
    IF null_count > 0 THEN
        RAISE NOTICE '⚠️  Found % players with NULL wallet_address', null_count;
        RAISE NOTICE 'Cannot make wallet_address NOT NULL with existing NULL values';
        RAISE NOTICE 'Options:';
        RAISE NOTICE '1. Delete players with NULL wallet_address:';
        RAISE NOTICE '   DELETE FROM players WHERE wallet_address IS NULL;';
        RAISE NOTICE '2. Set temporary wallet addresses:';
        RAISE NOTICE '   UPDATE players SET wallet_address = ''temp_'' || id WHERE wallet_address IS NULL;';
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  ROLLBACK STOPPED - Manual action required';
    ELSE
        -- Safe to make NOT NULL
        ALTER TABLE players ALTER COLUMN wallet_address SET NOT NULL;
        
        -- Restore original unique constraint
        ALTER TABLE players ADD CONSTRAINT players_wallet_address_key UNIQUE(wallet_address);
        
        RAISE NOTICE '✅ wallet_address restored to NOT NULL with unique constraint';
    END IF;
END $$;

-- =============================================================================
-- 4. REMOVE INDEXES (Optional - these don't hurt performance)
-- =============================================================================

-- Remove authentication-specific indexes (optional)
-- These indexes actually help performance, so you may want to keep them
-- Uncomment the lines below if you want to remove them:

-- DROP INDEX IF EXISTS idx_players_user_id;
-- DROP INDEX IF EXISTS idx_players_wallet_lookup;
-- DROP INDEX IF EXISTS idx_players_active;
-- DROP INDEX IF EXISTS idx_players_last_login;

RAISE NOTICE '✅ Indexes kept (they improve performance)';

-- =============================================================================
-- 5. REMOVE HELPER FUNCTIONS
-- =============================================================================

DROP FUNCTION IF EXISTS link_wallet_to_user(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_player_login(UUID);

RAISE NOTICE '✅ Helper functions removed';

-- =============================================================================
-- 6. VERIFICATION
-- =============================================================================

DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== ROLLBACK VERIFICATION ===';
    
    -- Check wallet_address constraint
    SELECT is_nullable INTO rec FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'wallet_address';
    
    RAISE NOTICE 'wallet_address nullable: %', rec.is_nullable;
    
    -- Check RLS status
    SELECT rowsecurity INTO rec FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.tablename = 'players';
    
    RAISE NOTICE 'RLS enabled: %', rec.rowsecurity;
    
    RAISE NOTICE '=== ROLLBACK COMPLETE ===';
    RAISE NOTICE 'Database restored to previous state';
END $$;