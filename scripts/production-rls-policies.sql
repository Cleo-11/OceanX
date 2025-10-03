-- ============================================
-- PRODUCTION-READY RLS POLICIES (Use AFTER demo)
-- ============================================

-- This approach uses Supabase service role key on backend
-- for secure player operations

-- Step 1: Enable RLS but make it strict
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop permissive demo policies
DROP POLICY IF EXISTS "allow_insert_players" ON players;
DROP POLICY IF EXISTS "allow_update_players" ON players;

-- Step 3: Create production policies

-- Allow public read (needed for multiplayer visibility)
CREATE POLICY "public_read_players" ON players
  FOR SELECT
  USING (true);

-- Only allow INSERT/UPDATE via service role key (backend)
-- This means your backend code must use SUPABASE_SERVICE_ROLE_KEY
CREATE POLICY "service_role_insert_players" ON players
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);  -- Block all client-side inserts

CREATE POLICY "service_role_update_players" ON players
  FOR UPDATE
  TO authenticated, anon
  USING (false)  -- Block all client-side updates
  WITH CHECK (false);

-- Prevent all deletes
CREATE POLICY "prevent_delete_players" ON players
  FOR DELETE
  USING (false);

-- ============================================
-- BACKEND CODE CHANGES NEEDED
-- ============================================

-- In server/index.js, replace:
--   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
-- With:
--   const supabaseAdmin = createClient(
--     SUPABASE_URL, 
--     SUPABASE_SERVICE_ROLE_KEY  // Use service role key for backend
--   );

-- Then use supabaseAdmin for all INSERT/UPDATE operations:
--   await supabaseAdmin.from('players').insert({...})
--   await supabaseAdmin.from('players').update({...})

-- ============================================
-- ENVIRONMENT VARIABLE NEEDED
-- ============================================
-- Add to Render environment variables:
-- SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (get from Supabase dashboard)

COMMENT ON TABLE players IS 'Production RLS - only backend can write, everyone can read';
