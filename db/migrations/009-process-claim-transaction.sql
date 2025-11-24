-- Stored Procedure: Process Claim Transaction
-- This function handles the entire claim process atomically
-- All validation, locking, and balance updates happen in a single transaction

CREATE OR REPLACE FUNCTION process_claim_transaction(
    p_claim_id UUID,
    p_wallet TEXT,
    p_requested_amount TEXT
)
RETURNS TABLE (
    new_balance TEXT,
    transaction_id TEXT
) AS $$
DECLARE
    v_claim_signature RECORD;
    v_server_amount TEXT;
    v_current_balance NUMERIC(78, 0);
    v_new_balance NUMERIC(78, 0);
    v_player_exists BOOLEAN;
    v_now_timestamp BIGINT;
BEGIN
    -- Get current unix timestamp
    v_now_timestamp := EXTRACT(EPOCH FROM NOW());

    -- ============================================================
    -- STEP 1: Lock and fetch the claim signature row
    -- ============================================================
    -- FOR UPDATE locks the row to prevent race conditions
    -- NOWAIT fails immediately if row is already locked
    
    SELECT * INTO v_claim_signature
    FROM claim_signatures
    WHERE claim_id = p_claim_id
    FOR UPDATE NOWAIT;

    -- Check if claim exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found';
    END IF;

    -- ============================================================
    -- STEP 2: Validate claim signature hasn't been used
    -- ============================================================
    
    IF v_claim_signature.used = TRUE THEN
        RAISE EXCEPTION 'Claim signature has already been used at %', v_claim_signature.used_at;
    END IF;

    -- ============================================================
    -- STEP 3: Validate claim signature hasn't expired
    -- ============================================================
    
    IF v_claim_signature.expires_at < v_now_timestamp THEN
        RAISE EXCEPTION 'Claim signature expired at % (current time: %)', 
            TO_TIMESTAMP(v_claim_signature.expires_at),
            TO_TIMESTAMP(v_now_timestamp);
    END IF;

    -- ============================================================
    -- STEP 4: Validate wallet matches
    -- ============================================================
    
    IF LOWER(v_claim_signature.wallet) != LOWER(p_wallet) THEN
        RAISE EXCEPTION 'Unauthorized wallet. Expected: %, Got: %', 
            v_claim_signature.wallet, 
            p_wallet;
    END IF;

    -- ============================================================
    -- STEP 5: Get server-calculated amount
    -- ============================================================
    -- This is the CRITICAL security step:
    -- The amount is determined by the database record, not the client
    
    v_server_amount := v_claim_signature.amount::TEXT;

    -- ============================================================
    -- STEP 6: Verify requested amount matches server amount
    -- ============================================================
    -- This prevents clients from tampering with the amount
    
    IF v_server_amount != p_requested_amount THEN
        RAISE EXCEPTION 'Amount mismatch. Server: %, Requested: %', 
            v_server_amount, 
            p_requested_amount;
    END IF;

    -- ============================================================
    -- STEP 7: Mark signature as used
    -- ============================================================
    -- This prevents replay attacks
    
    UPDATE claim_signatures
    SET 
        used = TRUE,
        used_at = NOW()
    WHERE claim_id = p_claim_id;

    -- ============================================================
    -- STEP 8: Credit the player's balance
    -- ============================================================
    -- Lock the player row to prevent race conditions
    
    SELECT EXISTS(
        SELECT 1 FROM players WHERE wallet = LOWER(p_wallet)
    ) INTO v_player_exists;

    IF NOT v_player_exists THEN
        RAISE EXCEPTION 'Player not found for wallet: %', p_wallet;
    END IF;

    -- Get current balance with row lock
    SELECT COALESCE(token_balance, 0) INTO v_current_balance
    FROM players
    WHERE wallet = LOWER(p_wallet)
    FOR UPDATE;

    -- Calculate new balance
    v_new_balance := v_current_balance + v_claim_signature.amount;

    -- Update player balance
    UPDATE players
    SET 
        token_balance = v_new_balance,
        updated_at = NOW()
    WHERE wallet = LOWER(p_wallet);

    -- ============================================================
    -- STEP 9: Create audit log entry (optional)
    -- ============================================================
    -- Uncomment if you have a transaction_logs table
    /*
    INSERT INTO transaction_logs (
        transaction_type,
        wallet,
        amount,
        metadata
    ) VALUES (
        'claim',
        LOWER(p_wallet),
        v_claim_signature.amount,
        jsonb_build_object(
            'claim_id', p_claim_id,
            'claim_type', v_claim_signature.claim_type
        )
    );
    */

    -- ============================================================
    -- STEP 10: Return success result
    -- ============================================================
    
    RETURN QUERY SELECT 
        v_new_balance::TEXT as new_balance,
        p_claim_id::TEXT as transaction_id;

EXCEPTION
    WHEN lock_not_available THEN
        RAISE EXCEPTION 'Claim is currently being processed. Please try again.';
    WHEN OTHERS THEN
        -- Re-raise the exception to rollback transaction
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
-- Grant execute permission to service role only

-- Revoke from public
REVOKE ALL ON FUNCTION process_claim_transaction FROM PUBLIC;

-- Grant to service role (adjust based on your Supabase setup)
-- GRANT EXECUTE ON FUNCTION process_claim_transaction TO service_role;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION process_claim_transaction IS 
'Atomically processes a token claim with full validation, replay protection, and amount verification. All steps happen in a single transaction with row-level locking to prevent race conditions.';
