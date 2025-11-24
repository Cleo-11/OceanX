-- Migration: Enhance existing claim_signatures table for nonce validation
-- Purpose: Add nonce tracking to prevent signature replay attacks
-- Date: November 23, 2025

-- Add nonce column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claim_signatures' AND column_name = 'nonce'
  ) THEN
    ALTER TABLE claim_signatures ADD COLUMN nonce BIGINT;
    COMMENT ON COLUMN claim_signatures.nonce IS 'Smart contract nonce at time of signature generation';
  END IF;
END $$;

-- Add signature column if it doesn't exist (to store the actual EIP-712 signature)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claim_signatures' AND column_name = 'signature'
  ) THEN
    ALTER TABLE claim_signatures ADD COLUMN signature TEXT;
    COMMENT ON COLUMN claim_signatures.signature IS 'EIP-712 signature for this claim';
  END IF;
END $$;

-- Create unique index on wallet+nonce to prevent duplicate signatures
-- Use IF NOT EXISTS pattern for idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_claim_sigs_wallet_nonce_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_claim_sigs_wallet_nonce_unique ON claim_signatures(wallet, nonce)
    WHERE nonce IS NOT NULL;
  END IF;
END $$;

-- Add indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_claim_sigs_wallet_lookup ON claim_signatures(wallet);
CREATE INDEX IF NOT EXISTS idx_claim_sigs_used_status ON claim_signatures(used) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_claim_sigs_expires_lookup ON claim_signatures(expires_at) WHERE used = false;

-- Update table comment
COMMENT ON TABLE claim_signatures IS 'Tracks claim signatures to prevent replay attacks. Each wallet+nonce combination can only generate one signature.';
COMMENT ON COLUMN claim_signatures.used IS 'Whether this signature has been consumed on-chain (prevents replay attacks)';
COMMENT ON COLUMN claim_signatures.wallet IS 'The wallet address authorized to use this claim (normalized to lowercase)';

-- Function to check if a nonce has already been used for a wallet
CREATE OR REPLACE FUNCTION check_nonce_usage(p_wallet TEXT, p_nonce BIGINT)
RETURNS TABLE (
  claim_id UUID,
  signature TEXT,
  amount NUMERIC,
  expires_at BIGINT,
  used BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.claim_id,
    cs.signature,
    cs.amount,
    cs.expires_at,
    cs.used
  FROM claim_signatures cs
  WHERE cs.wallet = lower(p_wallet)
    AND cs.nonce = p_nonce
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically expire old unused signatures
CREATE OR REPLACE FUNCTION expire_old_claim_signatures()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
  current_timestamp_seconds BIGINT;
BEGIN
  -- Convert current time to Unix timestamp (seconds)
  current_timestamp_seconds := EXTRACT(EPOCH FROM NOW())::BIGINT;
  
  -- Mark expired signatures as used (they can't be used anymore)
  UPDATE claim_signatures
  SET used = true,
      used_at = NOW()
  WHERE expires_at < current_timestamp_seconds
    AND used = false
  RETURNING COUNT(*) INTO expired_count;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_nonce_usage IS 'Checks if a nonce has already been used for signature generation';
COMMENT ON FUNCTION expire_old_claim_signatures IS 'Expires signatures past their expiration time';
