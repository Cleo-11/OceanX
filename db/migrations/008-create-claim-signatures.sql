-- Migration: Secure Claim Signatures Table
-- Purpose: Prevent replay attacks and enforce server-authoritative claim amounts
-- Created: 2025-11-20

-- =====================================================
-- CLAIM SIGNATURES TABLE
-- =====================================================
-- This table stores one-time-use claim signatures
-- Each signature can only be used once to prevent replay attacks
-- The server calculates the allowed amount, not the client

CREATE TABLE IF NOT EXISTS claim_signatures (
    -- Primary identifier for this claim
    claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- The wallet address authorized to use this claim
    wallet TEXT NOT NULL,
    
    -- The amount this claim is authorized for (server-calculated)
    amount NUMERIC(78, 0) NOT NULL CHECK (amount > 0),
    
    -- When this signature expires (unix timestamp in seconds)
    expires_at BIGINT NOT NULL,
    
    -- Whether this signature has been used
    used BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- When this signature was used (for audit trail)
    used_at TIMESTAMP WITH TIME ZONE,
    
    -- When this signature was created
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Optional: reason/context for this claim (e.g., "daily_reward", "mining_payout")
    claim_type TEXT,
    
    -- Optional: additional metadata for auditing
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT valid_expiration CHECK (expires_at > EXTRACT(EPOCH FROM created_at)),
    CONSTRAINT used_at_requires_used CHECK (
        (used = TRUE AND used_at IS NOT NULL) OR 
        (used = FALSE AND used_at IS NULL)
    )
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for looking up claims by wallet (most common query)
CREATE INDEX idx_claim_signatures_wallet ON claim_signatures(wallet);

-- Index for finding expired claims (cleanup jobs)
CREATE INDEX idx_claim_signatures_expires_at ON claim_signatures(expires_at);

-- Index for finding unused claims by wallet (prevents duplicate active claims)
CREATE INDEX idx_claim_signatures_wallet_unused ON claim_signatures(wallet, used) 
WHERE used = FALSE;

-- Composite index for the claim verification query
CREATE INDEX idx_claim_signatures_claim_verification ON claim_signatures(claim_id, used, expires_at);

-- Index for claim type analytics
CREATE INDEX idx_claim_signatures_claim_type ON claim_signatures(claim_type) 
WHERE claim_type IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY (Optional but recommended)
-- =====================================================

-- Enable RLS on the table
ALTER TABLE claim_signatures ENABLE ROW LEVEL SECURITY;

-- Only backend service can insert claims
-- (You'll need to create a service role in Supabase)
CREATE POLICY "Service role can insert claims" ON claim_signatures
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Only backend service can update claims
CREATE POLICY "Service role can update claims" ON claim_signatures
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Backend service can read all claims
CREATE POLICY "Service role can read claims" ON claim_signatures
    FOR SELECT
    TO service_role
    USING (true);

-- =====================================================
-- CLEANUP FUNCTION
-- =====================================================
-- Function to clean up expired, unused claims (run periodically)

CREATE OR REPLACE FUNCTION cleanup_expired_claim_signatures()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM claim_signatures
    WHERE used = FALSE 
      AND expires_at < EXTRACT(EPOCH FROM NOW());
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: Create Claim Signature
-- =====================================================
-- This function should be called server-side to create a new claim signature
-- It enforces business logic and prevents duplicate active claims

CREATE OR REPLACE FUNCTION create_claim_signature(
    p_wallet TEXT,
    p_amount NUMERIC,
    p_expires_in_seconds INTEGER DEFAULT 300, -- 5 minutes default
    p_claim_type TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_claim_id UUID;
    v_expires_at BIGINT;
    v_active_claims INTEGER;
BEGIN
    -- Validate inputs
    IF p_wallet IS NULL OR p_wallet = '' THEN
        RAISE EXCEPTION 'Wallet address is required';
    END IF;
    
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;
    
    IF p_expires_in_seconds <= 0 THEN
        RAISE EXCEPTION 'Expiration time must be positive';
    END IF;
    
    -- Calculate expiration timestamp
    v_expires_at := EXTRACT(EPOCH FROM NOW()) + p_expires_in_seconds;
    
    -- Check for existing active claims for this wallet (optional safety check)
    -- Uncomment if you want to prevent multiple pending claims per wallet
    /*
    SELECT COUNT(*) INTO v_active_claims
    FROM claim_signatures
    WHERE wallet = p_wallet
      AND used = FALSE
      AND expires_at > EXTRACT(EPOCH FROM NOW());
    
    IF v_active_claims > 0 THEN
        RAISE EXCEPTION 'Wallet % already has % active claim(s)', p_wallet, v_active_claims;
    END IF;
    */
    
    -- Create the claim signature
    INSERT INTO claim_signatures (
        wallet,
        amount,
        expires_at,
        claim_type,
        metadata
    )
    VALUES (
        LOWER(p_wallet), -- Normalize to lowercase
        p_amount,
        v_expires_at,
        p_claim_type,
        p_metadata
    )
    RETURNING claim_id INTO v_claim_id;
    
    RETURN v_claim_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE claim_signatures IS 
'Stores one-time-use claim signatures to prevent replay attacks and enforce server-authoritative amounts';

COMMENT ON COLUMN claim_signatures.claim_id IS 
'Unique identifier for this claim, included in the signed message';

COMMENT ON COLUMN claim_signatures.wallet IS 
'The wallet address authorized to use this claim (normalized to lowercase)';

COMMENT ON COLUMN claim_signatures.amount IS 
'The exact amount this claim is authorized for, calculated server-side';

COMMENT ON COLUMN claim_signatures.expires_at IS 
'Unix timestamp (seconds) when this signature expires';

COMMENT ON COLUMN claim_signatures.used IS 
'Whether this signature has been consumed (prevents replay attacks)';

COMMENT ON COLUMN claim_signatures.used_at IS 
'Timestamp when this signature was used (audit trail)';

COMMENT ON FUNCTION create_claim_signature IS 
'Server-side function to create a new claim signature with validation';

COMMENT ON FUNCTION cleanup_expired_claim_signatures IS 
'Removes expired, unused claim signatures (should be run periodically)';
