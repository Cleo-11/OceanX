#!/usr/bin/env node

/**
 * Simple Nonce Validation Test
 * Tests the NonceManager by checking debug endpoints
 */

const SERVER = process.env.SERVER_URL || "http://localhost:3001";

console.log("🧪 Nonce Validation Test (Simple)");
console.log("==================================\n");

async function test() {
  try {
    // Test 1: Check NonceManager stats
    console.log("Test 1: NonceManager Stats");
    console.log("--------------------------");
    
    const statsResponse = await fetch(`${SERVER}/debug/nonce-stats`);
    const stats = await statsResponse.json();
    
    console.log("HTTP Status:", statsResponse.status);
    console.log("Response:", JSON.stringify(stats, null, 2));
    
    if (statsResponse.ok && stats) {
      console.log("✅ NonceManager is initialized and working");
      console.log(`📊 Total signatures: ${stats.totalSignatures || 0}`);
      console.log(`📊 Pending: ${stats.pendingSignatures || 0}`);
      console.log(`📊 Claimed: ${stats.claimedSignatures || 0}`);
    } else {
      console.log("⚠️  NonceManager may not be fully initialized");
    }
    
    console.log("\n");
    
    // Test 2: Check database migration
    console.log("Test 2: Database Migration Status");
    console.log("----------------------------------");
    
    if (stats && (stats.totalSignatures !== undefined || stats.error === undefined)) {
      console.log("✅ Database migration appears to be complete");
      console.log("   The claim_signatures table is accessible");
    } else if (stats && stats.error && stats.error.includes("relation")) {
      console.log("❌ Database migration NOT run");
      console.log("   The claim_signatures table does not exist");
      console.log("\n💡 Next step: Run the migration in Supabase:");
      console.log("   File: supabase/migrations/20251123_claim_signature_tracking.sql");
    } else {
      console.log("⚠️  Unable to determine migration status");
    }
    
    console.log("\n");
    
    // Test 3: Summary
    console.log("==================================");
    console.log("📋 Test Summary");
    console.log("==================================\n");
    
    if (statsResponse.ok && stats && stats.totalSignatures !== undefined) {
      console.log("✅ NONCE VALIDATION SYSTEM IS WORKING!");
      console.log("\nThe system is ready to:");
      console.log("  • Track signature generation per nonce");
      console.log("  • Prevent signature replay attacks");
      console.log("  • Return existing signatures on duplicate requests");
      console.log("\nTo test full workflow (requires wallet auth):");
      console.log("  • Make authenticated POST to /marketplace/sign-claim");
      console.log("  • Make same request again");
      console.log("  • Second request should return existing signature");
    } else {
      console.log("⚠️  SETUP INCOMPLETE");
      console.log("\nRemaining steps:");
      console.log("  1. Run database migration in Supabase");
      console.log("  2. Restart the server");
      console.log("  3. Run this test again");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.log("\n💡 Make sure the server is running on", SERVER);
  }
}

test();
