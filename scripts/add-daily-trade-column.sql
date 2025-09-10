-- Add last_daily_trade column to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS last_daily_trade TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_players_last_daily_trade 
ON players(last_daily_trade);

-- Add comment for documentation
COMMENT ON COLUMN players.last_daily_trade IS 'Timestamp of the last daily resource trade';
