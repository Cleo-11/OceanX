-- Migration 004: Fix players table schema to use user_id as primary identifier
-- This migration adds user_id column, makes wallet_address nullable, and creates auto-player-creation trigger

-- Step 1: Add user_id column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.players 
      ADD COLUMN user_id UUID;
    
    RAISE NOTICE 'Added user_id column to players table';
  ELSE
    RAISE NOTICE 'user_id column already exists in players table';
  END IF;
END$$;

-- Step 2: Make wallet_address nullable (users created before wallet link)
DO $$
BEGIN
  ALTER TABLE public.players 
    ALTER COLUMN wallet_address DROP NOT NULL;
  RAISE NOTICE 'Made wallet_address nullable';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'wallet_address already nullable or column does not exist';
END$$;

-- Step 3: Add unique constraint on user_id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_user_id_key'
  ) THEN
    ALTER TABLE public.players 
      ADD CONSTRAINT players_user_id_key UNIQUE (user_id);
    RAISE NOTICE 'Added unique constraint on user_id';
  ELSE
    RAISE NOTICE 'Unique constraint on user_id already exists';
  END IF;
END$$;

-- Step 4: Add foreign key to auth.users (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_user_id_fkey'
  ) THEN
    ALTER TABLE public.players 
      ADD CONSTRAINT players_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key constraint to auth.users';
  ELSE
    RAISE NOTICE 'Foreign key constraint to auth.users already exists';
  END IF;
END$$;

-- Step 5: Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

-- Step 6: Add missing columns if they don't exist
DO $$
BEGIN
  -- Add username column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.players ADD COLUMN username TEXT;
  END IF;

  -- Add total_resources_mined column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'total_resources_mined'
  ) THEN
    ALTER TABLE public.players ADD COLUMN total_resources_mined BIGINT DEFAULT 0;
  END IF;

  -- Add total_ocx_earned column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'total_ocx_earned'
  ) THEN
    ALTER TABLE public.players ADD COLUMN total_ocx_earned BIGINT DEFAULT 0;
  END IF;

  -- Add is_active column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.players ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  RAISE NOTICE 'Verified all required columns exist';
END$$;

-- Step 7: Create trigger function to auto-create player rows for new auth users
CREATE OR REPLACE FUNCTION public.create_player_for_new_user()
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
    last_login, 
    is_active
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name', 
      SPLIT_PART(NEW.email, '@', 1),
      'Captain'
    ),
    1,
    0,
    0,
    NOW(),
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Step 8: Create trigger (drop first if exists to ensure clean state)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_player_for_new_user();

-- Step 9: Backfill user_id for existing players (if any exist without user_id)
-- This is a best-effort backfill; you may need to manually fix orphaned rows
DO $$
BEGIN
  -- If there are players without user_id but with wallet_address, 
  -- you'll need to manually map them or delete/recreate
  RAISE NOTICE 'Migration complete. Check for any players without user_id and handle manually if needed.';
END$$;
