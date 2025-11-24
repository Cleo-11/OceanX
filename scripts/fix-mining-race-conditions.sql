-- ========================================
-- FIX MINING RACE CONDITIONS
-- ========================================
-- This script updates the execute_mining_transaction RPC function to properly
-- handle race conditions with row-level locking and better error handling.
--
-- What this fixes:
-- 1. Adds FOR UPDATE NOWAIT on player row (prevents concurrent mining by same player)
-- 2. Validates resource type before dynamic SQL (prevents injection)
-- 3. Removes error suppression (lets errors propagate for proper handling)
-- 4. Adds better concurrent claim detection
--
-- How to apply:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy/paste this entire file
-- 3. Click "Run" to execute
-- ========================================

CREATE OR REPLACE FUNCTION execute_mining_transaction(
  p_attempt_id TEXT,
  p_player_id UUID,
  p_wallet_address TEXT,
  p_session_id TEXT,
  p_node_id TEXT,
  p_node_db_id BIGINT,
  p_position_x DOUBLE PRECISION,
  p_position_y DOUBLE PRECISION,
  p_position_z DOUBLE PRECISION,
  p_distance DOUBLE PRECISION,
  p_resource_type TEXT,
  p_resource_amount INTEGER,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_processing_ms INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_current_amount INTEGER;
  v_new_amount INTEGER;
  v_node_status TEXT;
  v_player_exists BOOLEAN;
  v_result JSONB;
BEGIN
  -- Transaction starts implicitly
  
  -- 1. Lock player row first (prevents concurrent mining attempts from same player)
  -- This ensures a player can't mine multiple nodes simultaneously
  SELECT EXISTS(SELECT 1 FROM public.players WHERE id = p_player_id FOR UPDATE) 
  INTO v_player_exists;
  
  IF NOT v_player_exists THEN
    RAISE EXCEPTION 'Player % not found', p_player_id;
  END IF;
  
  -- 2. Lock and verify node is still available (prevents race conditions)
  -- FOR UPDATE NOWAIT = fail immediately if another transaction has this row locked
  SELECT status INTO v_node_status
  FROM public.resource_nodes
  WHERE id = p_node_db_id
  FOR UPDATE NOWAIT; -- Don't wait if locked, fail immediately
  
  IF v_node_status IS NULL THEN
    RAISE EXCEPTION 'Node % not found', p_node_db_id;
  END IF;
  
  IF v_node_status != 'available' THEN
    RAISE EXCEPTION 'Node already claimed or unavailable (status: %)', v_node_status;
  END IF;
  
  -- 3. Update node status to claimed
  UPDATE public.resource_nodes
  SET 
    status = 'claimed',
    claimed_by_wallet = p_wallet_address,
    claimed_by_player_id = p_player_id,
    claimed_at = NOW(),
    depleted_at = NOW(),
    respawn_at = NOW() + (respawn_delay_seconds || ' seconds')::INTERVAL,
    updated_at = NOW()
  WHERE id = p_node_db_id
    AND status = 'available'; -- Double-check for concurrency safety
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Concurrent claim detected - node update failed';
  END IF;
  
  -- 4. Update player resources atomically
  -- Validate resource type to prevent SQL injection
  IF p_resource_type NOT IN ('nickel', 'cobalt', 'copper', 'manganese') THEN
    RAISE EXCEPTION 'Invalid resource type: %', p_resource_type;
  END IF;
  
  -- Use dynamic SQL to update the correct resource column
  EXECUTE format(
    'UPDATE public.players 
     SET %I = COALESCE(%I, 0) + $1,
         total_resources_mined = COALESCE(total_resources_mined, 0) + $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING %I',
    p_resource_type, 
    p_resource_type,
    p_resource_type
  ) USING p_resource_amount, p_player_id
  INTO v_new_amount;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player update failed';
  END IF;
  
  -- 5. Log mining attempt
  INSERT INTO public.mining_attempts (
    attempt_id,
    player_id,
    wallet_address,
    session_id,
    node_id,
    resource_node_db_id,
    position_x,
    position_y,
    position_z,
    distance_to_node,
    success,
    resource_type,
    resource_amount,
    ip_address,
    user_agent,
    processing_duration_ms,
    attempt_timestamp
  ) VALUES (
    p_attempt_id,
    p_player_id,
    p_wallet_address,
    p_session_id,
    p_node_id,
    p_node_db_id,
    p_position_x,
    p_position_y,
    p_position_z,
    p_distance,
    true, -- success
    p_resource_type,
    p_resource_amount,
    p_ip_address,
    p_user_agent,
    p_processing_ms,
    NOW()
  );
  
  -- 6. Return success result
  v_result := jsonb_build_object(
    'success', true,
    'resource_type', p_resource_type,
    'resource_amount', p_resource_amount,
    'new_balance', v_new_amount,
    'node_id', p_node_id,
    'claimed_at', NOW()
  );
  
  RETURN v_result;
  
  -- Note: No EXCEPTION handler - let errors propagate to application layer
  -- This ensures proper error detection and transaction rollback
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION execute_mining_transaction TO service_role;

COMMENT ON FUNCTION execute_mining_transaction IS 'Atomically execute mining with row-level locking to prevent race conditions: claim node, update player resources, log attempt';

-- ========================================
-- VERIFICATION
-- ========================================

-- Check function exists
SELECT 
  p.proname AS function_name,
  pg_catalog.pg_get_function_result(p.oid) AS return_type,
  pg_catalog.pg_get_functiondef(p.oid) AS definition_preview
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'execute_mining_transaction'
  AND n.nspname = 'public';

-- Expected: Function should exist with RETURNS JSONB
