-- Create player_sessions table
CREATE TABLE IF NOT EXISTS player_sessions (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  player_count INTEGER DEFAULT 0,
  max_players INTEGER DEFAULT 20,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player_stats table (optional for caching)
CREATE TABLE IF NOT EXISTS player_stats (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  submarine_tier INTEGER DEFAULT 1,
  total_resources_mined INTEGER DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_sessions_wallet ON player_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_player_sessions_active ON player_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_player_stats_wallet ON player_stats(wallet_address);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your security needs)
CREATE POLICY "Players can view their own sessions" ON player_sessions
  FOR SELECT USING (true);

CREATE POLICY "Players can update their own sessions" ON player_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Players can insert their own sessions" ON player_sessions
  FOR INSERT WITH CHECK (true);
