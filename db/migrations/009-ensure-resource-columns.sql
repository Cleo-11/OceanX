-- ============================================================================
-- ENSURE RESOURCE COLUMNS EXIST ON PLAYERS TABLE
-- ============================================================================
-- This migration ensures that the players table has all required resource
-- tracking columns. Run this if you're experiencing issues with resource
-- saving in the game.
-- ============================================================================

DO $$ 
BEGIN
  -- Add nickel column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'players' 
    AND column_name = 'nickel'
  ) THEN
    ALTER TABLE public.players ADD COLUMN nickel INTEGER DEFAULT 0 CHECK (nickel >= 0);
    RAISE NOTICE 'Added nickel column to players table';
  ELSE
    RAISE NOTICE 'nickel column already exists';
  END IF;
  
  -- Add cobalt column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'players' 
    AND column_name = 'cobalt'
  ) THEN
    ALTER TABLE public.players ADD COLUMN cobalt INTEGER DEFAULT 0 CHECK (cobalt >= 0);
    RAISE NOTICE 'Added cobalt column to players table';
  ELSE
    RAISE NOTICE 'cobalt column already exists';
  END IF;
  
  -- Add copper column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'players' 
    AND column_name = 'copper'
  ) THEN
    ALTER TABLE public.players ADD COLUMN copper INTEGER DEFAULT 0 CHECK (copper >= 0);
    RAISE NOTICE 'Added copper column to players table';
  ELSE
    RAISE NOTICE 'copper column already exists';
  END IF;
  
  -- Add manganese column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'players' 
    AND column_name = 'manganese'
  ) THEN
    ALTER TABLE public.players ADD COLUMN manganese INTEGER DEFAULT 0 CHECK (manganese >= 0);
    RAISE NOTICE 'Added manganese column to players table';
  ELSE
    RAISE NOTICE 'manganese column already exists';
  END IF;
  
  -- Add comments for documentation
  COMMENT ON COLUMN public.players.nickel IS 'Amount of nickel resources currently held by the player';
  COMMENT ON COLUMN public.players.cobalt IS 'Amount of cobalt resources currently held by the player';
  COMMENT ON COLUMN public.players.copper IS 'Amount of copper resources currently held by the player';
  COMMENT ON COLUMN public.players.manganese IS 'Amount of manganese resources currently held by the player';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check all resource columns exist
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'players'
  AND column_name IN ('nickel', 'cobalt', 'copper', 'manganese')
ORDER BY column_name;

-- Show sample data
SELECT 
  id,
  username,
  nickel,
  cobalt,
  copper,
  manganese,
  total_resources_mined
FROM public.players
LIMIT 5;
