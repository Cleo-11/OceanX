/**
 * Resource Cache Refresh Cron Job
 * 
 * This script refreshes stale resource caches periodically.
 * Run this every 5 minutes via:
 * - Render Cron Job
 * - Supabase Edge Function with pg_cron
 * - External cron service (cron-job.org, etc.)
 * 
 * USAGE:
 *   node scripts/refresh-resource-caches.js
 * 
 * ENVIRONMENT VARIABLES:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (not anon key!)
 *   CACHE_STALE_THRESHOLD_MINUTES - Minutes before cache is stale (default: 5)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STALE_THRESHOLD = parseInt(process.env.CACHE_STALE_THRESHOLD_MINUTES || '5', 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function refreshCaches() {
  console.log('🔄 Starting resource cache refresh...');
  console.log(`   Stale threshold: ${STALE_THRESHOLD} minutes`);
  console.log(`   Time: ${new Date().toISOString()}`);
  
  try {
    const startTime = Date.now();
    
    // Call the refresh function
    const { data, error } = await supabase.rpc('refresh_stale_resource_caches', {
      p_stale_threshold_minutes: STALE_THRESHOLD
    });
    
    const duration = Date.now() - startTime;
    
    if (error) {
      console.error('❌ Refresh failed:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Refresh complete!');
    console.log(`   Refreshed: ${data.refreshed_count} player(s)`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Executed at: ${data.executed_at}`);
    
    // Log stats if any players were refreshed
    if (data.refreshed_count > 0) {
      // Get count of remaining stale caches
      const { count } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .or(`resources_cached_at.is.null,resources_cached_at.lt.${new Date(Date.now() - STALE_THRESHOLD * 60 * 1000).toISOString()}`);
      
      console.log(`   Remaining stale: ${count || 0} player(s)`);
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

// Run the refresh
refreshCaches().then(() => {
  console.log('🏁 Done!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
