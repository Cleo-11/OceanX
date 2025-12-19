/**
 * Resource Service - Append-Only Pattern
 * 
 * This module provides functions for managing player resources using
 * the append-only pattern for cost optimization.
 * 
 * PATTERN OVERVIEW:
 * - Resources are stored as events (INSERT) not balances (UPDATE)
 * - Cached balances are stored in players table for fast reads
 * - Cache is refreshed periodically (every 10 events or via cron)
 * 
 * COST BENEFITS:
 * - INSERT operations are ~60% cheaper than UPDATE
 * - Better concurrent write performance
 * - Full audit trail of all resource changes
 */

/**
 * Get player resources using hybrid approach
 * Uses cached balance + delta from recent events
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} playerId - Player UUID
 * @returns {Object} Resource balances
 */
async function getPlayerResources(supabase, playerId) {
  const { data, error } = await supabase.rpc('get_player_resources', {
    p_player_id: playerId
  });
  
  if (error) {
    console.error('Error fetching player resources:', error);
    throw error;
  }
  
  if (!data || data.length === 0) {
    return {
      nickel: 0,
      cobalt: 0,
      copper: 0,
      manganese: 0,
      total: 0,
      isCached: false,
      cachedAt: null
    };
  }
  
  const row = data[0];
  return {
    nickel: row.nickel || 0,
    cobalt: row.cobalt || 0,
    copper: row.copper || 0,
    manganese: row.manganese || 0,
    total: row.total_resources || 0,
    isCached: row.is_cached || false,
    cachedAt: row.cached_at
  };
}

/**
 * Get player resources from live view (always accurate but slower)
 * Use this when you need guaranteed accurate balances (e.g., trading)
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} playerId - Player UUID
 * @returns {Object} Resource balances
 */
async function getPlayerResourcesLive(supabase, playerId) {
  const { data, error } = await supabase
    .from('player_resources_live')
    .select('nickel, cobalt, copper, manganese, total_resources')
    .eq('player_id', playerId)
    .single();
  
  if (error) {
    console.error('Error fetching live player resources:', error);
    throw error;
  }
  
  return {
    nickel: data?.nickel || 0,
    cobalt: data?.cobalt || 0,
    copper: data?.copper || 0,
    manganese: data?.manganese || 0,
    total: data?.total_resources || 0
  };
}

/**
 * Append a resource event (spending, trading, etc.)
 * 
 * @param {Object} supabase - Supabase client
 * @param {Object} params - Event parameters
 * @returns {Object} Insert result
 */
async function appendResourceEvent(supabase, {
  playerId,
  walletAddress,
  resourceType,
  amount,
  eventType,
  sourceId = null,
  sourceTable = null,
  metadata = {}
}) {
  // Validate resource type
  if (!['nickel', 'cobalt', 'copper', 'manganese'].includes(resourceType)) {
    throw new Error(`Invalid resource type: ${resourceType}`);
  }
  
  // Validate event type
  const validEventTypes = [
    'mining', 'trade_sell', 'trade_buy', 'claim', 
    'admin_adjustment', 'transfer_out', 'transfer_in', 'refund'
  ];
  if (!validEventTypes.includes(eventType)) {
    throw new Error(`Invalid event type: ${eventType}`);
  }
  
  const { data, error } = await supabase
    .from('resource_events')
    .insert({
      player_id: playerId,
      wallet_address: walletAddress?.toLowerCase(),
      resource_type: resourceType,
      amount: amount,
      event_type: eventType,
      source_id: sourceId,
      source_table: sourceTable,
      metadata: metadata
    })
    .select('id, created_at')
    .single();
  
  if (error) {
    console.error('Error appending resource event:', error);
    throw error;
  }
  
  return {
    success: true,
    eventId: data.id,
    createdAt: data.created_at
  };
}

/**
 * Spend resources (creates negative event)
 * Validates player has sufficient balance before spending
 * 
 * @param {Object} supabase - Supabase client
 * @param {Object} params - Spend parameters
 * @returns {Object} Result with new balance
 */
async function spendResources(supabase, {
  playerId,
  walletAddress,
  resourceType,
  amount,
  reason,
  sourceId = null
}) {
  // Get current balance (use live view for accuracy)
  const resources = await getPlayerResourcesLive(supabase, playerId);
  const currentBalance = resources[resourceType] || 0;
  
  if (currentBalance < amount) {
    return {
      success: false,
      reason: 'insufficient_balance',
      message: `Insufficient ${resourceType}: have ${currentBalance}, need ${amount}`,
      currentBalance
    };
  }
  
  // Append negative event
  const result = await appendResourceEvent(supabase, {
    playerId,
    walletAddress,
    resourceType,
    amount: -amount, // Negative for spending
    eventType: reason || 'trade_sell',
    sourceId,
    metadata: { original_balance: currentBalance }
  });
  
  return {
    success: true,
    eventId: result.eventId,
    previousBalance: currentBalance,
    newBalance: currentBalance - amount
  };
}

/**
 * Refresh player's cached resource balance
 * Call this after multiple transactions or periodically
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} playerId - Player UUID
 * @returns {Object} Refreshed balances
 */
async function refreshPlayerCache(supabase, playerId) {
  const { data, error } = await supabase.rpc('refresh_player_resources_cache', {
    p_player_id: playerId
  });
  
  if (error) {
    console.error('Error refreshing player cache:', error);
    throw error;
  }
  
  return data;
}

/**
 * Refresh all stale caches (for cron job)
 * 
 * @param {Object} supabase - Supabase client
 * @param {number} staleThresholdMinutes - Minutes before cache is stale
 * @returns {Object} Refresh summary
 */
async function refreshStaleCaches(supabase, staleThresholdMinutes = 5) {
  const { data, error } = await supabase.rpc('refresh_stale_resource_caches', {
    p_stale_threshold_minutes: staleThresholdMinutes
  });
  
  if (error) {
    console.error('Error refreshing stale caches:', error);
    throw error;
  }
  
  return data;
}

/**
 * Get resource event history for a player
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} playerId - Player UUID
 * @param {Object} options - Query options
 * @returns {Array} Resource events
 */
async function getResourceHistory(supabase, playerId, {
  limit = 50,
  resourceType = null,
  eventType = null,
  startDate = null,
  endDate = null
} = {}) {
  let query = supabase
    .from('resource_events')
    .select('id, resource_type, amount, event_type, source_id, metadata, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (resourceType) {
    query = query.eq('resource_type', resourceType);
  }
  
  if (eventType) {
    query = query.eq('event_type', eventType);
  }
  
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  
  if (endDate) {
    query = query.lte('created_at', endDate);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching resource history:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Get resource balance at a specific point in time
 * Useful for auditing and dispute resolution
 * 
 * @param {Object} supabase - Supabase client
 * @param {string} playerId - Player UUID
 * @param {Date|string} timestamp - Point in time
 * @returns {Object} Historical balances
 */
async function getResourcesAtTime(supabase, playerId, timestamp) {
  const { data, error } = await supabase
    .from('resource_events')
    .select('resource_type, amount')
    .eq('player_id', playerId)
    .lte('created_at', timestamp);
  
  if (error) {
    console.error('Error fetching historical resources:', error);
    throw error;
  }
  
  // Aggregate events
  const balances = { nickel: 0, cobalt: 0, copper: 0, manganese: 0 };
  for (const event of (data || [])) {
    balances[event.resource_type] += event.amount;
  }
  
  return {
    ...balances,
    total: balances.nickel + balances.cobalt + balances.copper + balances.manganese,
    asOf: timestamp
  };
}

export {
  getPlayerResources,
  getPlayerResourcesLive,
  appendResourceEvent,
  spendResources,
  refreshPlayerCache,
  refreshStaleCaches,
  getResourceHistory,
  getResourcesAtTime
};
