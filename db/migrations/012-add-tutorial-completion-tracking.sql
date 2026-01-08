-- Add has_completed_tutorial column to players table
-- This tracks whether a player has completed the initial tutorial/guide

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS has_completed_tutorial BOOLEAN DEFAULT false;

-- Update existing players to have completed the tutorial (since they're already playing)
-- New players will default to false and see the tutorial
UPDATE players 
SET has_completed_tutorial = true 
WHERE has_completed_tutorial IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN players.has_completed_tutorial IS 'Tracks whether the player has completed the scuba diver tutorial guide';
