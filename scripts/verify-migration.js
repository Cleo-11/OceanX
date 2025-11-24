#!/usr/bin/env node

/**
 * Verify Nonce Validation Migration
 * Checks if the claim_signatures table has been updated with nonce tracking
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const SERVER = process.env.SERVER_URL || "http://localhost:3001";

console.log("🔍 Verifying Nonce Validation Migration");
console.log("========================================\n");

async function verify() {
  // Check if we can connect to Supabase (try both NEXT_PUBLIC_ and non-prefixed versions)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ Missing Supabase credentials");
    console.log("   Check .env.local for SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL");
    console.log("   and SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("✅ Supabase connection configured\n");

  // Test 1: Check if table exists and has nonce column
  console.log("Test 1: Check table schema");
  console.log("---------------------------");
  
  try {
    // Try to query the table with nonce column
    const { data, error } = await supabase
      .from('claim_signatures')
      .select('claim_id, wallet, nonce, signature, used, expires_at, created_at')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('nonce')) {
        console.log("❌ MIGRATION NOT RUN");
        console.log("   The 'nonce' column does not exist in claim_signatures table");
        console.log("\n📋 Next Steps:");
        console.log("   1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/editor");
        console.log("   2. Click 'SQL Editor' in the left sidebar");
        console.log("   3. Click 'New Query'");
        console.log("   4. Copy the entire contents of:");
        console.log("      supabase/migrations/20251123_claim_signature_tracking.sql");
        console.log("   5. Paste into the SQL editor");
        console.log("   6. Click 'Run' (or press Ctrl+Enter)");
        console.log("   7. Run this script again to verify");
        return;
      } else if (error.message.includes('column') && error.message.includes('signature')) {
        console.log("⚠️  PARTIAL MIGRATION");
        console.log("   The 'signature' column may be missing");
        console.log("   Error:", error.message);
        return;
      } else {
        console.log("❌ Unexpected error:", error.message);
        return;
      }
    }

    console.log("✅ Table schema looks good!");
    console.log("   Columns verified: claim_id, wallet, nonce, signature, used, expires_at");
    console.log("");

  } catch (err) {
    console.log("❌ Error checking table:", err.message);
    return;
  }

  // Test 2: Check if unique index exists
  console.log("Test 2: Verify unique constraint on (wallet, nonce)");
  console.log("----------------------------------------------------");
  
  try {
    // Try to insert duplicate nonce (should fail if constraint exists)
    const testWallet = "0x0000000000000000000000000000000000000001";
    const testNonce = 999999;
    const testAmount = "100";
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    // First insert
    const { error: insertError1 } = await supabase
      .from('claim_signatures')
      .insert({
        wallet: testWallet,
        nonce: testNonce,
        amount: testAmount,
        expires_at: expiresAt,
        used: false,
      });

    if (insertError1) {
      console.log("⚠️  Could not insert test record:", insertError1.message);
    } else {
      console.log("✅ First test insert successful");
      
      // Try duplicate insert (should fail)
      const { error: insertError2 } = await supabase
        .from('claim_signatures')
        .insert({
          wallet: testWallet,
          nonce: testNonce,
          amount: testAmount,
          expires_at: expiresAt,
          used: false,
        });

      if (insertError2 && insertError2.code === '23505') {
        console.log("✅ UNIQUE constraint is working!");
        console.log("   Duplicate (wallet, nonce) was rejected as expected");
      } else if (!insertError2) {
        console.log("⚠️  WARNING: Duplicate insert succeeded (constraint may be missing)");
      } else {
        console.log("⚠️  Unexpected error on duplicate insert:", insertError2.message);
      }

      // Cleanup test record
      await supabase
        .from('claim_signatures')
        .delete()
        .eq('wallet', testWallet)
        .eq('nonce', testNonce);
      
      console.log("🧹 Cleaned up test records");
    }
  } catch (err) {
    console.log("❌ Error testing unique constraint:", err.message);
  }

  console.log("");

  // Test 3: Check server integration
  console.log("Test 3: Server NonceManager Integration");
  console.log("----------------------------------------");
  
  try {
    const response = await fetch(`${SERVER}/debug/nonce-stats`);
    const stats = await response.json();

    if (response.ok && stats && typeof stats.totalSignatures === 'number') {
      console.log("✅ Server NonceManager is working!");
      console.log("   Stats:", JSON.stringify(stats, null, 2));
    } else {
      console.log("⚠️  Server may need restart");
      console.log("   Response:", stats);
    }
  } catch (err) {
    console.log("⚠️  Could not connect to server:", err.message);
    console.log("   Make sure server is running: cd server && npm run dev");
  }

  console.log("\n========================================");
  console.log("✅ MIGRATION VERIFICATION COMPLETE");
  console.log("========================================\n");
}

verify().catch(console.error);
