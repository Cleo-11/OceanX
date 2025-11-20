-- Migration 006: Create mining_attempts table for idempotency, fraud detection, and audit trail
-- Tracks every mining attempt with full context for security monitoring

CREATE TABLE IF NOT EXISTS public.mining_attempts (
  id BIGSERIAL PRIMARY KEY,
  
  -- Attempt identification (idempotency)
  attempt_id TEXT NOT NULL UNIQUE, -- Format: "attempt-{wallet}-{nodeId}-{timestamp}-{random}"
  
  -- Player info
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  wallet_address TEXT NOT NULL,
  session_id TEXT NOT NULL,
  
  -- Node info
  node_id TEXT NOT NULL, -- References resource_nodes.node_id
  resource_node_db_id BIGINT REFERENCES public.resource_nodes(id) ON DELETE SET NULL,
  
  -- Attempt details
  position_x DOUBLE PRECISION, -- Player position when attempting
  position_y DOUBLE PRECISION,
  position_z DOUBLE PRECISION,
  distance_to_node DOUBLE PRECISION, -- Calculated distance for validation
  
  -- Result
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT, -- 'node_claimed', 'out_of_range', 'rate_limited', 'cooldown', 'invalid_node', etc.
  resource_type TEXT, -- Only if success
  resource_amount INTEGER, -- Only if success
  
  -- Anti-abuse tracking
  ip_address TEXT,
  user_agent TEXT,
  client_version TEXT,
  
  -- Timing
  attempt_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_duration_ms INTEGER, -- Server processing time
  
  -- Fraud detection flags
  is_suspicious BOOLEAN DEFAULT false,
  suspicious_reasons TEXT[], -- Array of reasons: 'rapid_succession', 'impossible_distance', 'bot_pattern', etc.
  flagged_for_review BOOLEAN DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT, -- Admin who reviewed
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance and fraud detection
CREATE INDEX IF NOT EXISTS idx_mining_attempts_wallet ON public.mining_attempts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_mining_attempts_player_id ON public.mining_attempts(player_id);
CREATE INDEX IF NOT EXISTS idx_mining_attempts_node_id ON public.mining_attempts(node_id);
CREATE INDEX IF NOT EXISTS idx_mining_attempts_session ON public.mining_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_mining_attempts_timestamp ON public.mining_attempts(attempt_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mining_attempts_success ON public.mining_attempts(success, attempt_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mining_attempts_ip ON public.mining_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_mining_attempts_suspicious ON public.mining_attempts(is_suspicious) WHERE is_suspicious = true;
CREATE INDEX IF NOT EXISTS idx_mining_attempts_flagged ON public.mining_attempts(flagged_for_review) WHERE flagged_for_review = true;

-- Composite index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_mining_attempts_wallet_time ON public.mining_attempts(wallet_address, attempt_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mining_attempts_ip_time ON public.mining_attempts(ip_address, attempt_timestamp DESC);

-- Function to detect suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_mining_patterns()
RETURNS TRIGGER AS $$
DECLARE
  recent_attempts INTEGER;
  recent_successes INTEGER;
  avg_distance DOUBLE PRECISION;
  suspicious_flags TEXT[] := '{}';
BEGIN
  -- Check rapid succession (more than 10 attempts in last minute)
  SELECT COUNT(*) INTO recent_attempts
  FROM public.mining_attempts
  WHERE wallet_address = NEW.wallet_address
    AND attempt_timestamp > NOW() - INTERVAL '1 minute';
  
  IF recent_attempts > 10 THEN
    suspicious_flags := array_append(suspicious_flags, 'rapid_succession');
  END IF;
  
  -- Check unrealistic success rate (>90% in last 50 attempts)
  SELECT COUNT(*) FILTER (WHERE success = true) INTO recent_successes
  FROM (
    SELECT success 
    FROM public.mining_attempts
    WHERE wallet_address = NEW.wallet_address
    ORDER BY attempt_timestamp DESC
    LIMIT 50
  ) recent;
  
  IF recent_successes > 45 THEN
    suspicious_flags := array_append(suspicious_flags, 'unrealistic_success_rate');
  END IF;
  
  -- Check impossible distances (teleportation between attempts)
  IF NEW.position_x IS NOT NULL THEN
    SELECT AVG(
      sqrt(
        power(NEW.position_x - position_x, 2) + 
        power(NEW.position_y - position_y, 2) + 
        power(NEW.position_z - position_z, 2)
      )
    ) INTO avg_distance
    FROM (
      SELECT position_x, position_y, position_z
      FROM public.mining_attempts
      WHERE wallet_address = NEW.wallet_address
        AND attempt_timestamp > NOW() - INTERVAL '10 seconds'
        AND position_x IS NOT NULL
      ORDER BY attempt_timestamp DESC
      LIMIT 5
    ) recent_positions;
    
    IF avg_distance > 500 THEN -- Threshold for teleportation detection
      suspicious_flags := array_append(suspicious_flags, 'impossible_distance');
    END IF;
  END IF;
  
  -- Update flags
  IF array_length(suspicious_flags, 1) > 0 THEN
    NEW.is_suspicious := true;
    NEW.suspicious_reasons := suspicious_flags;
    
    -- Auto-flag for review if multiple red flags
    IF array_length(suspicious_flags, 1) >= 2 THEN
      NEW.flagged_for_review := true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_detect_suspicious_mining
  BEFORE INSERT ON public.mining_attempts
  FOR EACH ROW
  EXECUTE FUNCTION detect_suspicious_mining_patterns();

-- Enable RLS
ALTER TABLE public.mining_attempts ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY service_role_all_mining_attempts ON public.mining_attempts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can only see their own attempts
CREATE POLICY read_own_mining_attempts ON public.mining_attempts
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND 
    wallet_address = (SELECT wallet_address FROM public.players WHERE user_id = auth.uid())
  );

COMMENT ON TABLE public.mining_attempts IS 'Audit trail and fraud detection for all mining attempts';
COMMENT ON COLUMN public.mining_attempts.attempt_id IS 'Unique idempotency key for this mining attempt';
COMMENT ON COLUMN public.mining_attempts.is_suspicious IS 'Auto-flagged by fraud detection triggers';
COMMENT ON COLUMN public.mining_attempts.flagged_for_review IS 'Requires manual admin review';
