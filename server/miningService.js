/**
 * Server-Side Authoritative Mining System
 * 
 * This module implements secure, server-validated mining with:
 * - Server-side RNG and outcome determination
 * - Atomic node state management
 * - Range and prerequisite validation
 * - Idempotency and concurrency control
 * - Rate limiting and anti-bot measures
 * - Comprehensive logging and fraud detection
 */

import crypto from 'crypto';

// Mining Configuration
const MINING_CONFIG = {
  // Range validation
  MAX_MINING_RANGE: 50, // units - must be within this distance to mine
  
  // Cooldowns
  GLOBAL_MINING_COOLDOWN_MS: 2000, // 2 seconds between mining attempts per player
  NODE_CLAIM_DURATION_MS: 5000, // How long a node stays "claimed" before completion
  
  // Rate limiting
  MAX_ATTEMPTS_PER_MINUTE: 30, // Per wallet
  MAX_ATTEMPTS_PER_MINUTE_PER_IP: 60, // Per IP address
  
  // Resource amounts (min-max per mine)
  RESOURCE_AMOUNTS: {
    nickel: { min: 1, max: 5 },
    cobalt: { min: 1, max: 4 },
    copper: { min: 1, max: 3 },
    manganese: { min: 1, max: 2 }
  },
  
  // Drop rates (probability of getting resource)
  DROP_RATES: {
    nickel: 0.80,     // 80% chance
    cobalt: 0.50,     // 50% chance
    copper: 0.30,     // 30% chance
    manganese: 0.10   // 10% chance (rare)
  },
  
  // Rarity multipliers (future use)
  RARITY_MULTIPLIERS: {
    common: 1.0,
    uncommon: 1.5,
    rare: 2.0,
    epic: 3.0,
    legendary: 5.0
  },
  
  // Node respawn
  DEFAULT_RESPAWN_DELAY_SECONDS: 300, // 5 minutes
  
  // Anti-abuse thresholds
  SUSPICIOUS_SUCCESS_RATE_THRESHOLD: 0.90, // >90% success is suspicious
  SUSPICIOUS_RAPID_ATTEMPTS_COUNT: 10, // >10 attempts in 1 minute
  TELEPORT_DISTANCE_THRESHOLD: 500 // Suspiciously large distance between attempts
};

/**
 * Generate cryptographically secure random number (server-side RNG)
 */
function secureRandom() {
  return crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF;
}

/**
 * Calculate 3D distance between two positions
 */
function calculateDistance3D(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Generate unique attempt ID for idempotency
 */
function generateAttemptId(walletAddress, nodeId) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `attempt-${walletAddress.slice(0, 10)}-${nodeId}-${timestamp}-${random}`;
}

/**
 * Determine mining outcome using server-side RNG
 * Returns: { success: boolean, resourceType: string, amount: number, reason: string }
 */
function determineMiningOutcome(requestedResourceType, nodeRarity = 'common', submarineMiningRate = 1.0) {
  const resourceType = requestedResourceType || 'nickel';
  
  // Validate resource type
  if (!['nickel', 'cobalt', 'copper', 'manganese'].includes(resourceType)) {
    return { success: false, reason: 'invalid_resource_type' };
  }
  
  // Roll for success (server-side randomness)
  const roll = secureRandom();
  const dropRate = MINING_CONFIG.DROP_RATES[resourceType];
  const rarityMultiplier = MINING_CONFIG.RARITY_MULTIPLIERS[nodeRarity] || 1.0;
  
  // Apply submarine mining rate bonus
  const adjustedDropRate = Math.min(0.99, dropRate * submarineMiningRate * rarityMultiplier);
  
  if (roll > adjustedDropRate) {
    return {
      success: false,
      reason: 'mining_failed',
      roll: roll.toFixed(4),
      requiredRoll: adjustedDropRate.toFixed(4)
    };
  }
  
  // Determine amount (server-side RNG)
  const amountConfig = MINING_CONFIG.RESOURCE_AMOUNTS[resourceType];
  const baseAmount = Math.floor(
    amountConfig.min + secureRandom() * (amountConfig.max - amountConfig.min + 1)
  );
  
  // Apply submarine mining rate to amount
  const finalAmount = Math.max(1, Math.floor(baseAmount * submarineMiningRate));
  
  return {
    success: true,
    resourceType,
    amount: finalAmount,
    reason: 'success',
    roll: roll.toFixed(4)
  };
}

/**
 * Validate if player can mine (prerequisites check)
 */
async function validateMiningPrerequisites(supabase, walletAddress, playerPosition, nodeId, attemptId) {
  const validationErrors = [];
  
  // Check for duplicate attempt (idempotency)
  const { data: existingAttempt } = await supabase
    .from('mining_attempts')
    .select('id, success, resource_type, resource_amount')
    .eq('attempt_id', attemptId)
    .single();
  
  if (existingAttempt) {
    return {
      valid: false,
      idempotent: true,
      reason: 'duplicate_attempt',
      existingResult: existingAttempt
    };
  }
  
  // Check player cooldown (rate limiting at DB level)
  const cooldownThreshold = new Date(Date.now() - MINING_CONFIG.GLOBAL_MINING_COOLDOWN_MS);
  const { data: recentAttempts, error: cooldownError } = await supabase
    .from('mining_attempts')
    .select('attempt_timestamp')
    .eq('wallet_address', walletAddress.toLowerCase())
    .gte('attempt_timestamp', cooldownThreshold.toISOString())
    .order('attempt_timestamp', { ascending: false })
    .limit(1);
  
  if (recentAttempts && recentAttempts.length > 0) {
    const timeSinceLastAttempt = Date.now() - new Date(recentAttempts[0].attempt_timestamp).getTime();
    if (timeSinceLastAttempt < MINING_CONFIG.GLOBAL_MINING_COOLDOWN_MS) {
      validationErrors.push({
        field: 'cooldown',
        message: `Must wait ${Math.ceil((MINING_CONFIG.GLOBAL_MINING_COOLDOWN_MS - timeSinceLastAttempt) / 1000)}s before mining again`
      });
    }
  }

  // If any quick validation errors (like cooldown) exist, return early
  if (validationErrors.length > 0) {
    return {
      valid: false,
      reason: validationErrors[0].field,
      errors: validationErrors
    };
  }
  
  // Fetch node from database
  const { data: node, error: nodeError } = await supabase
    .from('resource_nodes')
    .select('*')
    .eq('node_id', nodeId)
    .single();
  
  if (nodeError || !node) {
    validationErrors.push({
      field: 'node',
      message: 'Resource node not found or has been removed'
    });
    return { valid: false, reason: 'invalid_node', errors: validationErrors };
  }
  
  // Check node status
  if (node.status !== 'available') {
    validationErrors.push({
      field: node.status === 'claimed' ? 'claimed' : 'node_status',
      message: `Node is ${node.status}, not available for mining`
    });
  }
  
  // Check if node is still in respawn period
  if (node.respawn_at && new Date(node.respawn_at) > new Date()) {
    const secondsUntilRespawn = Math.ceil((new Date(node.respawn_at) - new Date()) / 1000);
    validationErrors.push({
      field: 'respawn',
      message: `Node respawns in ${secondsUntilRespawn}s`
    });
  }
  
  // Range validation: player must be close enough to node
  if (playerPosition) {
    const nodePosition = {
      x: node.position_x,
      y: node.position_y,
      z: node.position_z
    };
    
    const distance = calculateDistance3D(playerPosition, nodePosition);
    
    if (distance > MINING_CONFIG.MAX_MINING_RANGE) {
      validationErrors.push({
        field: 'range',
        message: `Too far from node (${distance.toFixed(1)} units, max ${MINING_CONFIG.MAX_MINING_RANGE})`
      });
    }
    
    // Store distance for fraud detection
    node.distanceToNode = distance;
  }
  
  if (validationErrors.length > 0) {
    return {
      valid: false,
      reason: validationErrors[0].field,
      errors: validationErrors,
      node
    };
  }
  
  return {
    valid: true,
    node,
    distanceToNode: node.distanceToNode
  };
}

/**
 * Execute mining attempt with atomic DB transaction
 * This is the main server-authoritative mining handler
 */
async function executeMiningAttempt(supabase, {
  walletAddress,
  sessionId,
  nodeId,
  playerPosition,
  requestedResourceType,
  attemptId,
  ipAddress,
  userAgent
}) {
  const startTime = Date.now();
  
  try {
    // Get player data
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, submarine_tier, nickel, cobalt, copper, manganese')
      .ilike('wallet_address', walletAddress)
      .single();
    
    if (playerError || !player) {
      return {
        success: false,
        reason: 'player not found',
        message: 'Player record not found'
      };
    }
    
    // Get submarine mining rate
    const submarineMiningRate = await getSubmarineMiningRate(player.submarine_tier);
    
    // Validate prerequisites
    const validation = await validateMiningPrerequisites(
      supabase,
      walletAddress,
      playerPosition,
      nodeId,
      attemptId
    );
    
    if (!validation.valid) {
      // Log failed attempt
      await supabase.from('mining_attempts').insert({
        attempt_id: attemptId,
        player_id: player.id,
        wallet_address: walletAddress.toLowerCase(),
        session_id: sessionId,
        node_id: nodeId,
        position_x: playerPosition?.x,
        position_y: playerPosition?.y,
        position_z: playerPosition?.z,
        distance_to_node: validation.node?.distanceToNode,
        success: false,
        failure_reason: validation.reason,
        ip_address: ipAddress,
        user_agent: userAgent,
        processing_duration_ms: Date.now() - startTime
      });
      
      // Return idempotent result if duplicate
      if (validation.idempotent) {
        return {
          success: validation.existingResult.success,
          idempotent: true,
          resourceType: validation.existingResult.resource_type,
          amount: validation.existingResult.resource_amount,
          message: 'Duplicate attempt - returning previous result'
        };
      }
      
      return {
        success: false,
        reason: validation.reason,
        message: validation.errors?.[0]?.message || 'Mining validation failed'
      };
    }
    
    const node = validation.node;
    
    // SERVER-SIDE RNG: Determine outcome
    const outcome = determineMiningOutcome(
      requestedResourceType || node.resource_type,
      node.rarity,
      submarineMiningRate
    );
    
    if (!outcome.success) {
      // Log failed mining attempt
      await supabase.from('mining_attempts').insert({
        attempt_id: attemptId,
        player_id: player.id,
        wallet_address: walletAddress.toLowerCase(),
        session_id: sessionId,
        node_id: nodeId,
        resource_node_db_id: node.id,
        position_x: playerPosition?.x,
        position_y: playerPosition?.y,
        position_z: playerPosition?.z,
        distance_to_node: validation.distanceToNode,
        success: false,
        failure_reason: outcome.reason,
        ip_address: ipAddress,
        user_agent: userAgent,
        processing_duration_ms: Date.now() - startTime
      });
      
      return {
        success: false,
        reason: outcome.reason,
        message: 'Mining attempt failed - no resources obtained',
        roll: outcome.roll,
        requiredRoll: outcome.requiredRoll
      };
    }
    
    // ATOMIC TRANSACTION: Claim node + INSERT resource event (APPEND-ONLY) + log attempt
    // This uses the append-only pattern for cost optimization:
    // - INSERT operations are ~60% cheaper than UPDATE operations
    // - Provides full audit trail of all resource changes
    // - Cached balance is refreshed periodically (every 10 events or via cron)
    const { data: transactionResult, error: transactionError } = await supabase.rpc(
      'execute_mining_transaction_v2', // v2 uses append-only pattern
      {
        p_attempt_id: attemptId,
        p_player_id: player.id,
        p_wallet_address: walletAddress.toLowerCase(),
        p_session_id: sessionId,
        p_node_id: nodeId,
        p_node_db_id: node.id,
        p_position_x: playerPosition?.x,
        p_position_y: playerPosition?.y,
        p_position_z: playerPosition?.z,
        p_distance: validation.distanceToNode,
        p_resource_type: outcome.resourceType,
        p_resource_amount: outcome.amount,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_processing_ms: Date.now() - startTime
      }
    );
    
    // Handle transaction errors (race conditions, node already claimed, etc.)
    if (transactionError) {
      console.error('❌ Mining transaction failed:', {
        error: transactionError.message,
        code: transactionError.code,
        details: transactionError.details,
        hint: transactionError.hint,
        wallet: walletAddress,
        nodeId
      });
      
      // Log failed transaction attempt
      await supabase.from('mining_attempts').insert({
        attempt_id: attemptId,
        player_id: player.id,
        wallet_address: walletAddress.toLowerCase(),
        session_id: sessionId,
        node_id: nodeId,
        resource_node_db_id: node.id,
        position_x: playerPosition?.x,
        position_y: playerPosition?.y,
        position_z: playerPosition?.z,
        distance_to_node: validation.distanceToNode,
        success: false,
        failure_reason: 'transaction_error',
        ip_address: ipAddress,
        user_agent: userAgent,
        processing_duration_ms: Date.now() - startTime
      });
      
      // Determine failure reason from error message
      const errorMsg = transactionError.message?.toLowerCase() || '';
      if (errorMsg.includes('already claimed') || errorMsg.includes('concurrent claim')) {
        return {
          success: false,
          reason: 'node_already_claimed',
          message: 'This resource node was just claimed by another player'
        };
      } else if (errorMsg.includes('not found')) {
        return {
          success: false,
          reason: 'node_not_found',
          message: 'Resource node no longer exists'
        };
      } else {
        return {
          success: false,
          reason: 'transaction_failed',
          message: 'Mining transaction failed - please try again'
        };
      }
    }
    
    // Verify transaction success
    if (!transactionResult || transactionResult.success === false) {
      console.error('❌ Transaction returned failure:', transactionResult);
      return {
        success: false,
        reason: 'transaction_failed',
        message: transactionResult?.error || 'Mining transaction failed'
      };
    }
    
    return {
      success: true,
      resourceType: outcome.resourceType,
      amount: outcome.amount,
      message: `Mined ${outcome.amount}x ${outcome.resourceType}`,
      nodeId: node.node_id,
      roll: outcome.roll,
      newBalance: {
        nickel: player.nickel + (outcome.resourceType === 'nickel' ? outcome.amount : 0),
        cobalt: player.cobalt + (outcome.resourceType === 'cobalt' ? outcome.amount : 0),
        copper: player.copper + (outcome.resourceType === 'copper' ? outcome.amount : 0),
        manganese: player.manganese + (outcome.resourceType === 'manganese' ? outcome.amount : 0)
      }
    };
    
  } catch (error) {
    console.error('❌ Mining execution error:', error);
    
    // Log error attempt
    try {
      await supabase.from('mining_attempts').insert({
        attempt_id: attemptId,
        wallet_address: walletAddress.toLowerCase(),
        session_id: sessionId,
        node_id: nodeId,
        position_x: playerPosition?.x,
        position_y: playerPosition?.y,
        position_z: playerPosition?.z,
        success: false,
        failure_reason: 'server_error',
        ip_address: ipAddress,
        processing_duration_ms: Date.now() - startTime
      });
    } catch (logError) {
      console.error('❌ Failed to log error attempt:', logError);
    }
    
    return {
      success: false,
      reason: 'server_error',
      message: 'Internal server error during mining'
    };
  }
}

/**
 * Get submarine mining rate multiplier
 */
function getSubmarineMiningRate(tier) {
  // Tier-based mining rates (matches submarine data)
  const rates = {
    1: 1.0,
    2: 1.2,
    3: 1.4,
    4: 1.6,
    5: 1.8,
    6: 2.0,
    7: 2.2,
    8: 2.4,
    9: 2.6,
    10: 2.8,
    11: 3.0,
    12: 3.2,
    13: 3.4,
    14: 3.6
  };
  
  return rates[tier] || 1.0;
}

export {
  MINING_CONFIG,
  executeMiningAttempt,
  determineMiningOutcome,
  validateMiningPrerequisites,
  generateAttemptId,
  calculateDistance3D,
  secureRandom,
  getSubmarineMiningRate
};
