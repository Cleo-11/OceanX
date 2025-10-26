/**
 * Supabase Data Validation Script
 * 
 * This script validates database integrity for the submarine upgrade system.
 * Run this against your Supabase instance to verify schema and data consistency.
 * 
 * Usage:
 *   node scripts/validate-upgrade-schema.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function validateSchema() {
  console.log('🔍 Validating Supabase Schema for Submarine Upgrades...\n');

  const results = {
    passed: [],
    failed: [],
    warnings: [],
  };

  // Test 1: Check players table exists and has required columns
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, wallet_address, submarine_tier, coins')
      .limit(1);

    if (error) throw error;
    
    results.passed.push('✅ Players table exists with required columns');
  } catch (error) {
    results.failed.push(`❌ Players table validation failed: ${error.message}`);
  }

  // Test 2: Verify submarine_tier defaults to 1
  try {
    const testWallet = `0x${Math.random().toString(16).slice(2, 42)}`;
    
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({ wallet_address: testWallet })
      .select('submarine_tier')
      .single();

    if (insertError) throw insertError;

    if (newPlayer.submarine_tier === 1) {
      results.passed.push('✅ submarine_tier defaults to 1 on new player creation');
    } else {
      results.failed.push(`❌ submarine_tier default is ${newPlayer.submarine_tier}, expected 1`);
    }

    // Cleanup
    await supabase.from('players').delete().eq('wallet_address', testWallet);
  } catch (error) {
    results.failed.push(`❌ Default submarine_tier test failed: ${error.message}`);
  }

  // Test 3: Verify coins defaults to 0
  try {
    const testWallet = `0x${Math.random().toString(16).slice(2, 42)}`;
    
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({ wallet_address: testWallet })
      .select('coins')
      .single();

    if (insertError) throw insertError;

    const coinsValue = Number(newPlayer.coins);
    if (coinsValue === 0) {
      results.passed.push('✅ coins defaults to 0 on new player creation');
    } else {
      results.failed.push(`❌ coins default is ${coinsValue}, expected 0`);
    }

    // Cleanup
    await supabase.from('players').delete().eq('wallet_address', testWallet);
  } catch (error) {
    results.failed.push(`❌ Default coins test failed: ${error.message}`);
  }

  // Test 4: Verify atomic updates work correctly
  try {
    const testWallet = `0x${Math.random().toString(16).slice(2, 42)}`;
    
    // Create test player
    const { data: player, error: createError } = await supabase
      .from('players')
      .insert({ wallet_address: testWallet, submarine_tier: 1, coins: 1000 })
      .select('id')
      .single();

    if (createError) throw createError;

    // Simulate upgrade transaction
    const { data: updated, error: updateError } = await supabase
      .from('players')
      .update({ submarine_tier: 2, coins: 800 })
      .eq('id', player.id)
      .select('submarine_tier, coins')
      .single();

    if (updateError) throw updateError;

    if (updated.submarine_tier === 2 && Number(updated.coins) === 800) {
      results.passed.push('✅ Atomic updates work correctly (tier + coins)');
    } else {
      results.failed.push(
        `❌ Atomic update failed: tier=${updated.submarine_tier}, coins=${updated.coins}`
      );
    }

    // Cleanup
    await supabase.from('players').delete().eq('id', player.id);
  } catch (error) {
    results.failed.push(`❌ Atomic update test failed: ${error.message}`);
  }

  // Test 5: Check for any players with invalid tier values
  try {
    const { data: invalidPlayers, error } = await supabase
      .from('players')
      .select('id, wallet_address, submarine_tier')
      .or('submarine_tier.is.null,submarine_tier.lt.1,submarine_tier.gt.15');

    if (error) throw error;

    if (invalidPlayers.length === 0) {
      results.passed.push('✅ No players with invalid submarine_tier values');
    } else {
      results.warnings.push(
        `⚠️  Found ${invalidPlayers.length} players with invalid submarine_tier values`
      );
    }
  } catch (error) {
    results.warnings.push(`⚠️  Could not check for invalid tier values: ${error.message}`);
  }

  // Test 6: Check for any players with negative coins
  try {
    const { data: negativePlayers, error } = await supabase
      .from('players')
      .select('id, wallet_address, coins')
      .lt('coins', 0);

    if (error) throw error;

    if (negativePlayers.length === 0) {
      results.passed.push('✅ No players with negative coins');
    } else {
      results.failed.push(
        `❌ Found ${negativePlayers.length} players with negative coins (data corruption)`
      );
    }
  } catch (error) {
    results.warnings.push(`⚠️  Could not check for negative coins: ${error.message}`);
  }

  // Test 7: Verify submarine_tiers reference table exists
  try {
    const { data, error } = await supabase
      .from('submarine_tiers')
      .select('id, tier, name')
      .limit(1);

    if (error) throw error;
    
    results.passed.push('✅ submarine_tiers reference table exists');
  } catch (error) {
    results.warnings.push(`⚠️  submarine_tiers table not found: ${error.message}`);
  }

  // Print Results
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION RESULTS');
  console.log('='.repeat(60) + '\n');

  if (results.passed.length > 0) {
    console.log('PASSED TESTS:');
    results.passed.forEach(msg => console.log(msg));
    console.log('');
  }

  if (results.warnings.length > 0) {
    console.log('WARNINGS:');
    results.warnings.forEach(msg => console.log(msg));
    console.log('');
  }

  if (results.failed.length > 0) {
    console.log('FAILED TESTS:');
    results.failed.forEach(msg => console.log(msg));
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`Summary: ${results.passed.length} passed, ${results.failed.length} failed, ${results.warnings.length} warnings`);
  console.log('='.repeat(60) + '\n');

  if (results.failed.length > 0) {
    console.log('❌ Schema validation FAILED. Please review the errors above.');
    process.exit(1);
  } else {
    console.log('✅ Schema validation PASSED. Database is ready for submarine upgrades!');
    process.exit(0);
  }
}

// Run validation
validateSchema().catch(error => {
  console.error('❌ Unexpected error during validation:', error);
  process.exit(1);
});
