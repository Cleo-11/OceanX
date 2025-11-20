-- Migration 008: Add Row Level Security (RLS) to players table
-- This migration addresses the critical vulnerability DB-001 from the audit report.

-- Step 1: Enable Row Level Security on the players table
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policies for the players table

-- Policy 1: Allow service_role to perform any action.
-- This is crucial for the backend server to manage player data.
CREATE POLICY "Service role has full access on players"
  ON public.players
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy 2: Allow authenticated users to read their own player data.
-- This uses the `auth.uid()` function to match against the `user_id` column.
CREATE POLICY "Users can view their own player data"
  ON public.players
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 3: Allow authenticated users to update their own player data.
-- This prevents a user from changing another user's information.
CREATE POLICY "Users can update their own player data"
  ON public.players
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Prevent users from deleting player records.
-- Deletes should be handled by specific admin procedures or backend logic.
-- We can enforce this by creating a restrictive DELETE policy.
-- Note: If no DELETE policy is present, deletes are denied by default when RLS is enabled.
-- Adding an explicit policy makes the intention clear.
CREATE POLICY "Users cannot delete player records"
  ON public.players
  FOR DELETE
  USING (false); -- This condition is never met, effectively blocking deletes for non-service roles.

COMMENT ON TABLE public.players IS 'Stores player-specific data, now with RLS enabled.';
COMMENT ON POLICY "Users can view their own player data" ON public.players IS 'Ensures a player can only read their own record.';
COMMENT ON POLICY "Users can update their own player data" ON public.players IS 'Ensures a player can only update their own record.';
