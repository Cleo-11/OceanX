#!/usr/bin/env node

/**
 * Test Claim Validation Implementation
 * Tests CVE-002 mitigation: server-side claim amount validation
 * 
 * Usage:
 *   node test-claim-validation.js
 *   API_URL=http://localhost:5000 WALLET=0x... SIGNATURE=xxx node test-claim-validation.js
 */

const API_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_WALLET = process.env.WALLET || '0x1234567890123456789012345678901234567890';
const TEST_SIGNATURE = process.env.SIGNATURE || 'test-signature-here';

// Track test results
let passed = 0;
let failed = 0;

// Helper to make API requests
async function apiRequest(endpoint, payload) {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_SIGNATURE}`
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json().catch(() => ({}));
    
    return {
      status: response.status,
      data,
      ok: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      ok: false
    };
  }
}

// Test helper
async function testClaim(testName, endpoint, payload, expectedStatus, description) {
  process.stdout.write(`Testing: ${testName}... `);
  
  const result = await apiRequest(endpoint, payload);
  
  if (result.status === expectedStatus) {
    console.log(`\x1b[32m✓ PASS\x1b[0m (HTTP ${result.status})`);
    console.log(`   Response:`, JSON.stringify(result.data));
    passed++;
  } else {
    console.log(`\x1b[31m✗ FAIL\x1b[0m (Expected HTTP ${expectedStatus}, got ${result.status})`);
    console.log(`   Response:`, JSON.stringify(result.data));
    failed++;
  }
  console.log('');
}

// Direct validation function test
async function testValidationFunction() {
  console.log('🔍 Testing computeMaxClaimableAmount() logic');
  console.log('--------------------------------------------');
  
  // This would require direct access to the validation function
  // For now, we test indirectly through the API endpoints
  
  console.log('ℹ️  Validation function tested indirectly through API endpoints\n');
}

// Main test suite
async function runTests() {
  console.log('🧪 Testing Claim Validation System');
  console.log('==================================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Test Wallet: ${TEST_WALLET}`);
  console.log('');
  
  // Test computeMaxClaimableAmount
  await testValidationFunction();
  
  console.log('📋 Test Suite: /marketplace/sign-claim endpoint');
  console.log('-----------------------------------------------');
  
  // Test 1: Valid claim request
  await testClaim(
    'Valid claim with reasonable amount',
    '/marketplace/sign-claim',
    { ocxAmount: 10 },
    200,
    'Should generate signature for valid amount'
  );
  
  // Test 2: Zero amount
  await testClaim(
    'Zero amount claim',
    '/marketplace/sign-claim',
    { ocxAmount: 0 },
    400,
    'Should reject zero amount with INVALID_AMOUNT'
  );
  
  // Test 3: Negative amount
  await testClaim(
    'Negative amount claim',
    '/marketplace/sign-claim',
    { ocxAmount: -100 },
    400,
    'Should reject negative amount'
  );
  
  // Test 4: Excessive amount
  await testClaim(
    'Excessive claim amount',
    '/marketplace/sign-claim',
    { ocxAmount: 999999999 },
    403,
    'Should reject with AMOUNT_EXCEEDS_LIMIT'
  );
  
  // Test 5: Resource trade without ownership
  await testClaim(
    'Resource trade without sufficient resources',
    '/marketplace/sign-claim',
    { ocxAmount: 50, resourceType: 'manganese', resourceAmount: 999999 },
    403,
    'Should reject with INSUFFICIENT_RESOURCES'
  );
  
  // Test 6: Idempotency
  const idempotencyKey = `test-${Date.now()}`;
  await testClaim(
    'First claim with idempotency key',
    '/marketplace/sign-claim',
    { ocxAmount: 5, idempotencyKey },
    200,
    'Should generate signature with custom idempotency key'
  );
  
  await testClaim(
    'Duplicate claim with same idempotency key',
    '/marketplace/sign-claim',
    { ocxAmount: 5, idempotencyKey },
    200,
    'Should return idempotent response'
  );
  
  console.log('');
  console.log('📋 Test Suite: /claim endpoint (relay flow)');
  console.log('-------------------------------------------');
  
  // Test 7: Valid relay claim
  await testClaim(
    'Valid relay claim',
    '/claim',
    { amount: '10000000000000000000', userAddress: TEST_WALLET },
    200,
    'Should relay transaction for valid amount in wei'
  );
  
  // Test 8: Invalid amount format
  await testClaim(
    'Invalid amount format',
    '/claim',
    { amount: 'invalid', userAddress: TEST_WALLET },
    400,
    'Should reject with INVALID_AMOUNT'
  );
  
  // Test 9: Excessive relay amount
  await testClaim(
    'Excessive relay amount',
    '/claim',
    { amount: '999999999000000000000000000', userAddress: TEST_WALLET },
    403,
    'Should reject relay if exceeds max claimable'
  );
  
  // Test 10: Missing wallet address
  await testClaim(
    'Missing user address',
    '/claim',
    { amount: '1000000000000000000' },
    401,
    'Should require wallet authentication'
  );
  
  console.log('');
  console.log('=======================================');
  console.log('Test Results Summary');
  console.log('=======================================');
  console.log(`\x1b[32mPassed: ${passed}\x1b[0m`);
  console.log(`\x1b[31mFailed: ${failed}\x1b[0m`);
  console.log('');
  
  if (failed === 0) {
    console.log('\x1b[32m🎉 All tests passed!\x1b[0m');
    process.exit(0);
  } else {
    console.log('\x1b[31m⚠️  Some tests failed. Review output above.\x1b[0m');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});
