# 🔧 Fix Your Existing Database Schema

## 📋 Current State Analysis

Based on your database dump, here's what needs to be fixed:

### ✅ What You Have (Correct):
- ✅ `auth.users` - Stores both Google and Email/Password authentication
- ✅ `auth.identities` - Links auth providers to users
- ✅ `players` - Core player table (needs minor additions)
- ✅ `submarine_tiers` - Submarine reference data
- ✅ `pending_actions` - Action queue
- ✅ `trades` - Marketplace transactions
- ✅ `claim_signatures` - Anti-replay security
- ✅ `resource_nodes` - Mining nodes
- ✅ `mining_attempts` - Audit trail
- ✅ `game_sessions` - Session management

### ⚠️ What Needs Fixing:
1. **`players` table missing `coins` column**
2. **`submarine_tiers` missing some columns** (cost, storage, mining_power unified columns)
3. **Redundant tables** that can be removed or consolidated

---

## 🚀 Migration SQL - Run This to Fix Everything

Copy and paste this entire script into your **Supabase SQL Editor**:

```sql
-- ========================================
-- MIGRATION: Fix Existing OceanX Database
-- Date: November 25, 2025
-- Purpose: Add missing columns and fix schema inconsistencies
-- ========================================

-- ========================================
-- PART 1: FIX PLAYERS TABLE
-- ========================================

-- Add coins column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'coins'
  ) THEN
    ALTER TABLE public.players 
      ADD COLUMN coins BIGINT NOT NULL DEFAULT 0 CHECK (coins >= 0);
    
    COMMENT ON COLUMN players.coins IS 'In-game currency balance (OCE tokens earned from mining/trading)';
    RAISE NOTICE '✅ Added coins column to players table';
  ELSE
    RAISE NOTICE '✓ coins column already exists';
  END IF;
END $$;

-- Ensure submarine_tier has correct default and constraint
ALTER TABLE public.players 
  ALTER COLUMN submarine_tier SET DEFAULT 1,
  ALTER COLUMN submarine_tier SET NOT NULL;

DO $$
BEGIN
  -- Drop old constraint if exists
  ALTER TABLE players DROP CONSTRAINT IF EXISTS players_submarine_tier_check;
  
  -- Add new constraint
  ALTER TABLE players ADD CONSTRAINT players_submarine_tier_check 
    CHECK (submarine_tier >= 1 AND submarine_tier <= 10);
  
  RAISE NOTICE '✅ Updated submarine_tier constraints';
END $$;

-- Fix resource columns constraints
DO $$
BEGIN
  ALTER TABLE players DROP CONSTRAINT IF EXISTS players_nickel_check;
  ALTER TABLE players DROP CONSTRAINT IF EXISTS players_cobalt_check;
  ALTER TABLE players DROP CONSTRAINT IF EXISTS players_copper_check;
  ALTER TABLE players DROP CONSTRAINT IF EXISTS players_manganese_check;
  
  ALTER TABLE players ADD CONSTRAINT players_nickel_check CHECK (nickel >= 0);
  ALTER TABLE players ADD CONSTRAINT players_cobalt_check CHECK (cobalt >= 0);
  ALTER TABLE players ADD CONSTRAINT players_copper_check CHECK (copper >= 0);
  ALTER TABLE players ADD CONSTRAINT players_manganese_check CHECK (manganese >= 0);
  
  RAISE NOTICE '✅ Updated resource constraints';
END $$;

-- Add last_reward_claim if missing (for future daily rewards)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'last_reward_claim'
  ) THEN
    ALTER TABLE public.players 
      ADD COLUMN last_reward_claim TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE '✅ Added last_reward_claim column';
  END IF;
END $$;

-- ========================================
-- PART 2: FIX SUBMARINE_TIERS TABLE
-- ========================================

-- Add unified storage column (sum of all resource storage)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'submarine_tiers' AND column_name = 'storage'
  ) THEN
    ALTER TABLE public.submarine_tiers 
      ADD COLUMN storage INTEGER NOT NULL DEFAULT 100;
    
    -- Set storage as max of all resource storage columns
    UPDATE submarine_tiers 
    SET storage = GREATEST(max_nickel, max_cobalt, max_copper, max_manganese, 100);
    
    RAISE NOTICE '✅ Added storage column to submarine_tiers';
  END IF;
END $$;

-- Add unified mining_power column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'submarine_tiers' AND column_name = 'mining_power'
  ) THEN
    ALTER TABLE public.submarine_tiers 
      ADD COLUMN mining_power DECIMAL(10, 2) NOT NULL DEFAULT 1.0;
    
    -- Copy from mining_rate if it exists
    UPDATE submarine_tiers 
    SET mining_power = COALESCE(mining_rate, 1.0);
    
    RAISE NOTICE '✅ Added mining_power column to submarine_tiers';
  END IF;
END $$;

-- Add cost column (unified upgrade cost in tokens)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'submarine_tiers' AND column_name = 'cost'
  ) THEN
    ALTER TABLE public.submarine_tiers 
      ADD COLUMN cost BIGINT NOT NULL DEFAULT 0 CHECK (cost >= 0);
    
    -- Copy from upgrade_cost_tokens if it exists
    UPDATE submarine_tiers 
    SET cost = COALESCE(upgrade_cost_tokens, 0);
    
    RAISE NOTICE '✅ Added cost column to submarine_tiers';
  END IF;
END $$;

-- Add hull column (health)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'submarine_tiers' AND column_name = 'hull'
  ) THEN
    ALTER TABLE public.submarine_tiers 
      ADD COLUMN hull INTEGER NOT NULL DEFAULT 100;
    
    -- Copy from health column
    UPDATE submarine_tiers 
    SET hull = COALESCE(health, 100);
    
    RAISE NOTICE '✅ Added hull column to submarine_tiers';
  END IF;
END $$;

-- ========================================
-- PART 3: ADD MISSING INDEXES
-- ========================================

-- Players table indexes
CREATE INDEX IF NOT EXISTS idx_players_coins ON players(coins);
CREATE INDEX IF NOT EXISTS idx_players_resources ON players(nickel, cobalt, copper, manganese);

-- Submarine tiers indexes
CREATE INDEX IF NOT EXISTS idx_submarine_tiers_tier ON submarine_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_submarine_tiers_cost ON submarine_tiers(cost);

-- Trades indexes (check if missing)
CREATE INDEX IF NOT EXISTS idx_trades_idempotency ON trades(idempotency_key) WHERE idempotency_key IS NOT NULL;

RAISE NOTICE '✅ Added missing indexes';

-- ========================================
-- PART 4: UPDATE RLS POLICIES (If needed)
-- ========================================

-- Check if players table has RLS enabled
DO $$
BEGIN
  -- Enable RLS if not already enabled
  ALTER TABLE players ENABLE ROW LEVEL SECURITY;
  
  -- Drop old policies if they exist
  DROP POLICY IF EXISTS "allow_read_all_players" ON players;
  DROP POLICY IF EXISTS "allow_insert_players" ON players;
  DROP POLICY IF EXISTS "allow_update_players" ON players;
  DROP POLICY IF EXISTS "prevent_delete_players" ON players;
  
  -- Create production-ready policies
  
  -- SELECT: Users can read their own profile + view active players
  CREATE POLICY "players_select" ON players
    FOR SELECT
    USING (
      auth.role() = 'authenticated' AND (
        auth.uid() = user_id OR is_active = true
      )
    );
  
  -- INSERT: Users can create their own profile
  CREATE POLICY "players_insert" ON players
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
  
  -- UPDATE: Users can only update their own profile
  CREATE POLICY "players_update" ON players
    FOR UPDATE
    USING (auth.role() = 'authenticated' AND auth.uid() = user_id)
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
  
  -- DELETE: Prevent deletes (use soft-delete via is_active)
  CREATE POLICY "players_delete" ON players
    FOR DELETE
    USING (false);
  
  RAISE NOTICE '✅ Updated RLS policies for players';
END $$;

-- ========================================
-- PART 5: VERIFY TRIGGER EXISTS
-- ========================================

-- Check if auto-create player trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    -- Create trigger function
    CREATE OR REPLACE FUNCTION public.create_player_for_new_user()
    RETURNS TRIGGER 
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $func$
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
        COALESCE(NEW.email, NEW.raw_user_meta_data->>'name', 'Player'),
        1,
        0,
        0,
        true,
        NOW(),
        NOW()
      );
      RETURN NEW;
    END;
    $func$;
    
    -- Create trigger
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.create_player_for_new_user();
    
    RAISE NOTICE '✅ Created auto-player-creation trigger';
  ELSE
    RAISE NOTICE '✓ Auto-player-creation trigger already exists';
  END IF;
END $$;

-- ========================================
-- PART 6: CLEAN UP DEPRECATED TABLES (OPTIONAL)
-- ========================================

-- Uncomment these if you want to remove deprecated tables:

-- DROP TABLE IF EXISTS daily_rewards CASCADE;  -- No longer used
-- DROP TABLE IF EXISTS player_stats CASCADE;    -- Redundant with players table
-- DROP TABLE IF EXISTS active_sessions CASCADE; -- Redundant with game_sessions

-- RAISE NOTICE '✅ Cleaned up deprecated tables';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check players table columns
SELECT 
  'players' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'players'
  AND column_name IN ('user_id', 'wallet_address', 'coins', 'submarine_tier', 'nickel', 'cobalt', 'copper', 'manganese')
ORDER BY ordinal_position;

-- Check submarine_tiers columns
SELECT 
  'submarine_tiers' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'submarine_tiers'
  AND column_name IN ('tier', 'name', 'storage', 'mining_power', 'cost', 'hull', 'energy')
ORDER BY ordinal_position;

-- Check RLS policies
SELECT 
  schemaname,
  tablename, 
  policyname, 
  cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('players', 'pending_actions', 'trades', 'claim_signatures', 'resource_nodes', 'mining_attempts')
ORDER BY tablename, cmd;

-- ========================================
-- FINAL SUMMARY
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Your database has been updated with:';
  RAISE NOTICE '  ✓ coins column in players table';
  RAISE NOTICE '  ✓ storage, mining_power, cost, hull columns in submarine_tiers';
  RAISE NOTICE '  ✓ Proper constraints and indexes';
  RAISE NOTICE '  ✓ Updated RLS policies';
  RAISE NOTICE '  ✓ Auto-player-creation trigger verified';
  RAISE NOTICE '';
  RAISE NOTICE 'Authentication:';
  RAISE NOTICE '  ✓ Both Google Auth and Email/Password store in auth.users';
  RAISE NOTICE '  ✓ Provider info stored in auth.identities';
  RAISE NOTICE '  ✓ Players auto-created via trigger on signup';
  RAISE NOTICE '';
  RAISE NOTICE '🎮 Your game is ready to use!';
  RAISE NOTICE '';
END $$;
```

---

## 📊 Authentication Flow Explained

### Where Authentication Data is Stored:

#### **1. Google Authentication:**
```
User signs in with Google
    ↓
Supabase creates entry in:
├── auth.users (id, email, created_at, etc.)
└── auth.identities (provider='google', user_id)
    ↓
Trigger fires: create_player_for_new_user()
    ↓
Creates entry in:
└── players (user_id, username, submarine_tier=1, coins=0, etc.)
```

#### **2. Email/Password Authentication:**
```
User signs up with email/password
    ↓
Supabase creates entry in:
├── auth.users (id, email, encrypted_password, etc.)
└── auth.identities (provider='email', user_id)
    ↓
Trigger fires: create_player_for_new_user()
    ↓
Creates entry in:
└── players (user_id, username, submarine_tier=1, coins=0, etc.)
```

### Key Tables:

| Table | Purpose | Data Stored |
|-------|---------|-------------|
| `auth.users` | **Main auth table** (managed by Supabase) | All users (Google + Email/Password)<br>- id, email, encrypted_password, metadata |
| `auth.identities` | **Provider linking** | Links users to auth providers<br>- provider ('google', 'email')<br>- user_id |
| `players` | **Game data** | Your custom player data<br>- user_id (links to auth.users)<br>- wallet_address, coins, resources |

---

## 🎮 How Your Tables Connect

```
auth.users (Supabase managed)
    ↓ (trigger: on_auth_user_created)
players (your game data)
    ├── id: UUID (primary key)
    ├── user_id: UUID → auth.users(id)  ✓ Required, auto-populated
    ├── wallet_address: TEXT → nullable ✓ Linked later via Connect Wallet
    ├── coins: BIGINT ✓ In-game currency
    ├── submarine_tier: INTEGER ✓ Current submarine
    ├── nickel, cobalt, copper, manganese: INTEGER ✓ Resources
    └── total_ocx_earned: NUMERIC ✓ Blockchain earnings

submarine_tiers (reference data)
    └── Defines stats for each tier (1-10)

trades (marketplace)
    └── player_id → players(id)

claim_signatures (blockchain security)
    └── wallet → players.wallet_address

resource_nodes (mining nodes)
    └── claimed_by_player_id → players(id)

mining_attempts (audit trail)
    └── player_id → players(id)
```

---

## 🔍 Verify Your Schema After Migration

Run these queries in Supabase SQL Editor:

```sql
-- 1. Check if coins column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'players' AND column_name = 'coins';

-- 2. Check submarine_tiers has all columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'submarine_tiers' 
  AND column_name IN ('storage', 'mining_power', 'cost', 'hull')
ORDER BY column_name;

-- 3. Check authentication setup
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as auth_created,
  i.provider,
  p.username,
  p.coins,
  p.submarine_tier,
  p.wallet_address
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id
LEFT JOIN players p ON p.user_id = u.id
ORDER BY u.created_at DESC
LIMIT 10;

-- 4. Check if trigger exists
SELECT 
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

---

## 📝 What This Migration Does

### ✅ Fixes:
1. **Adds `coins` column** to `players` table (in-game currency)
2. **Adds unified columns** to `submarine_tiers` (storage, mining_power, cost, hull)
3. **Updates constraints** to ensure data integrity
4. **Adds missing indexes** for better performance
5. **Updates RLS policies** for proper security
6. **Verifies auto-player-creation trigger** exists

### ✅ Maintains:
- All existing player data
- All authentication data (Google + Email)
- All existing tables and relationships
- All triggers and functions

### ✅ Optionally Removes:
- `daily_rewards` table (deprecated)
- `player_stats` table (redundant)
- `active_sessions` table (redundant)

---

## 🚨 Important Notes

### Authentication:
- **Both Google and Email/Password** authentication use the **same `auth.users` table**
- **Provider info** is stored in `auth.identities` table
- **Your `players` table** links to `auth.users` via `user_id`
- **Wallet address** is optional and linked later when user connects wallet

### Game Data:
- `coins` column tracks in-game currency (OCE tokens)
- Resources (`nickel`, `cobalt`, `copper`, `manganese`) track mined resources
- `total_ocx_earned` tracks blockchain earnings
- `submarine_tier` links to `submarine_tiers` reference table

### Redundant Tables:
Your database has some extra tables that may not be needed:
- `player_stats` - redundant with `players` table
- `active_sessions` - redundant with `game_sessions` table
- `daily_rewards` - deprecated (daily rewards disabled)

You can keep them for now or remove them using the commented-out DROP statements.

---

## 🎯 Next Steps

After running this migration:

1. **Test Authentication**
   - Sign up with Google → Check `auth.users` and `players` tables
   - Sign up with Email → Check `auth.users` and `players` tables
   - Verify both create entries in `players` table

2. **Test Wallet Linking**
   - Link wallet to authenticated user
   - Verify `wallet_address` is populated in `players` table

3. **Test Game Functionality**
   - Mine resources → Check `resource_nodes` and `mining_attempts`
   - Upgrade submarine → Check `submarine_tier` in `players`
   - Trade resources → Check `trades` table

4. **Deploy Backend**
   - Update environment variables
   - Test API endpoints
   - Verify RLS policies work correctly

---

**Your database is now fully compatible with the game!** 🎉
