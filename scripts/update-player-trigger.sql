-- ========================================
-- UPDATE EXISTING DATABASE TRIGGER
-- ========================================
-- Purpose: Update the create_player_for_new_user() trigger to support username from signup form
-- Run this if you already have a database and just need to update the trigger
-- ========================================

-- Drop and recreate the trigger function with username support
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
      NEW.raw_user_meta_data->>'username',  -- Username from signup form (PRIORITY 1)
      NEW.raw_user_meta_data->>'full_name', -- Google display name (PRIORITY 2)
      SPLIT_PART(NEW.email, '@', 1),       -- Email prefix as fallback (PRIORITY 3)
      'Player'                              -- Ultimate fallback (PRIORITY 4)
    ),
    1,                   -- Default submarine tier
    0,                   -- Starting coins
    0,                   -- Total resources mined
    0,                   -- Total OCX earned
    true,                -- Is active
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Verify the trigger is attached
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    -- Recreate trigger if missing
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_player_for_new_user();
    
    RAISE NOTICE '✅ Trigger created: on_auth_user_created';
  ELSE
    RAISE NOTICE '✅ Trigger already exists: on_auth_user_created';
  END IF;
END $$;

-- ========================================
-- VERIFICATION
-- ========================================

-- Test the updated trigger with a sample user metadata structure
-- This shows what usernames would be extracted
SELECT 
  'Form Username' AS source,
  COALESCE(
    '{"username": "CaptainNemo"}'::jsonb->>'username',
    NULL,
    'fallback'
  ) AS extracted_username
UNION ALL
SELECT 
  'Google Name',
  COALESCE(
    NULL,
    '{"full_name": "John Doe"}'::jsonb->>'full_name',
    'fallback'
  )
UNION ALL
SELECT 
  'Email Prefix',
  COALESCE(
    NULL,
    NULL,
    SPLIT_PART('test@example.com', '@', 1)
  )
UNION ALL
SELECT 
  'Ultimate Fallback',
  COALESCE(
    NULL,
    NULL,
    NULL,
    'Player'
  );

-- Expected output:
-- source              | extracted_username
-- -------------------|-------------------
-- Form Username      | CaptainNemo
-- Google Name        | John Doe
-- Email Prefix       | test
-- Ultimate Fallback  | Player

RAISE NOTICE '✅ Trigger update complete! Test by creating a new user.';
