-- Ensure players table tracks off-chain currency balances
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS coins BIGINT NOT NULL DEFAULT 0;

-- Backfill any existing NULLs to maintain data integrity
UPDATE players
SET coins = 0
WHERE coins IS NULL;
