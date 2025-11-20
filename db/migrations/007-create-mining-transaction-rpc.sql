-- Migration 007: Create atomic mining transaction RPC function
-- Ensures node claiming, resource updates, and attempt logging happen atomically

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
  v_result JSONB;
BEGIN
  -- Start transaction (implicit in function)
  
  -- 1. Lock and verify node is still available (prevents race conditions)
  SELECT status INTO v_node_status
  FROM public.resource_nodes
  WHERE id = p_node_db_id
  FOR UPDATE; -- Lock row for update
  
  IF v_node_status IS NULL THEN
    RAISE EXCEPTION 'Node % not found', p_node_db_id;
  END IF;
  
  IF v_node_status != 'available' THEN
    RAISE EXCEPTION 'Node already claimed or unavailable (status: %)', v_node_status;
  END IF;
  
  -- 2. Update node status to claimed
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
    RAISE EXCEPTION 'Node update failed - concurrent claim detected';
  END IF;
  
  -- 3. Update player resources atomically
  -- Use dynamic SQL to update the correct resource column
  EXECUTE format(
    'UPDATE public.players 
     SET %I = COALESCE(%I, 0) + $1,
         total_resources_mined = COALESCE(total_resources_mined, 0) + $1
     WHERE id = $2
     RETURNING %I',
    p_resource_type, 
    p_resource_type,
    p_resource_type
  ) USING p_resource_amount, p_player_id
  INTO v_new_amount;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player % not found', p_player_id;
  END IF;
  
  -- 4. Log mining attempt
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
  
  -- 5. Return success result
  v_result := jsonb_build_object(
    'success', true,
    'resource_type', p_resource_type,
    'resource_amount', p_resource_amount,
    'new_balance', v_new_amount,
    'node_id', p_node_id,
    'claimed_at', NOW()
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will auto-rollback on exception
    RAISE NOTICE 'Mining transaction failed: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION execute_mining_transaction TO service_role;

COMMENT ON FUNCTION execute_mining_transaction IS 'Atomically execute mining: claim node, update player resources, log attempt';
