-- Create the players table for OceanX game
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    submarine_tier INTEGER NOT NULL DEFAULT 1,
    coins BIGINT NOT NULL DEFAULT 0,
    last_reward_claim TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster wallet address lookups
CREATE INDEX IF NOT EXISTS idx_players_wallet_address ON players(wallet_address);

-- Create index for reward claims
CREATE INDEX IF NOT EXISTS idx_players_last_reward_claim ON players(last_reward_claim);

-- Insert a test player (optional)
INSERT INTO players (wallet_address, submarine_tier, coins) 
VALUES ('0x0000000000000000000000000000000000000000', 0, 0) 
ON CONFLICT (wallet_address) DO NOTHING;
