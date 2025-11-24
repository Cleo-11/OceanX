/**
 * Comprehensive tests for the Secure Claim System
 * Tests signature verification, database functions, and full claim flow
 */

const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

// =====================================================
// TEST CONFIGURATION
// =====================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Generate test keys (deterministic for tests)
const TEST_SIGNER_PRIVATE_KEY = ethers.keccak256(ethers.toUtf8Bytes('test-claim-signer'));
const testWallet = new ethers.Wallet(TEST_SIGNER_PRIVATE_KEY);
const TEST_SIGNER_ADDRESS = testWallet.address;

const TEST_PLAYER_PRIVATE_KEY = ethers.keccak256(ethers.toUtf8Bytes('test-player'));
const testPlayerWallet = new ethers.Wallet(TEST_PLAYER_PRIVATE_KEY);
const TEST_PLAYER_ADDRESS = testPlayerWallet.address;

// EIP-712 Domain and Types
const CLAIM_DOMAIN = {
  name: 'OceanX Token Claims',
  version: '1',
  chainId: 1,
};

const CLAIM_TYPES = {
  Claim: [
    { name: 'claimId', type: 'string' },
    { name: 'wallet', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
  ],
};

let supabase = null;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function signClaimPayload(payload, privateKey) {
  const wallet = new ethers.Wallet(privateKey);
  const normalizedPayload = {
    ...payload,
    amount: payload.amount.toString(),
    wallet: ethers.getAddress(payload.wallet),
  };
  return await wallet.signTypedData(CLAIM_DOMAIN, CLAIM_TYPES, normalizedPayload);
}

function verifyClaimSignature(payload, signature) {
  const normalizedPayload = {
    ...payload,
    amount: payload.amount.toString(),
    wallet: ethers.getAddress(payload.wallet),
  };
  return ethers.verifyTypedData(CLAIM_DOMAIN, CLAIM_TYPES, normalizedPayload, signature);
}

// =====================================================
// TEST SETUP
// =====================================================

beforeAll(async () => {
  console.log('\n🧪 Secure Claim System Tests');
  console.log('============================');
  console.log(`Test Signer: ${TEST_SIGNER_ADDRESS}`);
  console.log(`Test Player: ${TEST_PLAYER_ADDRESS}\n`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  Supabase credentials not set. Skipping integration tests.\n');
    return;
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Ensure test player exists
  const { error } = await supabase
    .from('players')
    .upsert({
      wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      token_balance: '0',
      username: 'test-player',
    }, { onConflict: 'wallet' });

  if (error && !error.message.includes('does not exist')) {
    console.error('Setup error:', error.message);
  }
});

afterAll(async () => {
  if (supabase) {
    await supabase
      .from('claim_signatures')
      .delete()
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase());
  }
});

// =====================================================
// UNIT TESTS: Signature Verification
// =====================================================

describe('Signature Verification', () => {
  test('should verify a valid signature', async () => {
    const payload = {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: TEST_PLAYER_ADDRESS,
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    const signature = await signClaimPayload(payload, TEST_SIGNER_PRIVATE_KEY);
    const recoveredAddress = verifyClaimSignature(payload, signature);

    expect(recoveredAddress.toLowerCase()).toBe(TEST_SIGNER_ADDRESS.toLowerCase());
  });

  test('should reject tampered amount', async () => {
    const payload = {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: TEST_PLAYER_ADDRESS,
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    const signature = await signClaimPayload(payload, TEST_SIGNER_PRIVATE_KEY);
    const tamperedPayload = { ...payload, amount: '9999999999999999999' };

    const originalSigner = verifyClaimSignature(payload, signature);
    const tamperedSigner = verifyClaimSignature(tamperedPayload, signature);

    // Tampered payload should recover different signer
    expect(tamperedSigner.toLowerCase()).not.toBe(originalSigner.toLowerCase());
  });

  test('should reject tampered wallet', async () => {
    const payload = {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: TEST_PLAYER_ADDRESS,
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    const signature = await signClaimPayload(payload, TEST_SIGNER_PRIVATE_KEY);
    const tamperedPayload = { ...payload, wallet: '0x' + '0'.repeat(40) };

    const originalSigner = verifyClaimSignature(payload, signature);
    const tamperedSigner = verifyClaimSignature(tamperedPayload, signature);

    expect(tamperedSigner.toLowerCase()).not.toBe(originalSigner.toLowerCase());
  });

  test('should validate wallet addresses', () => {
    // Valid checksummed address (vitalik.eth)
    expect(() => ethers.getAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).not.toThrow();
    
    // Test normalization (lowercase should be normalized to checksum)
    const normalized = ethers.getAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
    expect(normalized).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    
    // Invalid addresses should throw
    expect(() => ethers.getAddress('0xinvalid')).toThrow();
    expect(() => ethers.getAddress('not-an-address')).toThrow();
    expect(() => ethers.getAddress('0x123')).toThrow(); // Too short
  });
});

// =====================================================
// INTEGRATION TESTS: Database Functions
// =====================================================

describe('Database Integration', () => {
  beforeEach(async () => {
    if (!supabase) return;
    await supabase
      .from('claim_signatures')
      .delete()
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase());
  });

  test('should create a claim signature in database', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping database test (no Supabase connection)');
      return;
    }

    const { data: claimId, error } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
      p_metadata: { test: true },
    });

    expect(error).toBeNull();
    expect(claimId).toBeTruthy();

    const { data: claim } = await supabase
      .from('claim_signatures')
      .select('*')
      .eq('claim_id', claimId)
      .single();

    expect(claim).toBeTruthy();
    expect(claim.wallet).toBe(TEST_PLAYER_ADDRESS.toLowerCase());
    expect(claim.amount).toBe('1000000000000000000');
    expect(claim.used).toBe(false);
  });

  test('should cleanup expired claims', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping database test (no Supabase connection)');
      return;
    }

    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: -100,
      p_claim_type: 'test',
    });

    const { data: deletedCount } = await supabase.rpc('cleanup_expired_claim_signatures');

    expect(deletedCount).toBeGreaterThanOrEqual(1);

    const { data: claim } = await supabase
      .from('claim_signatures')
      .select('*')
      .eq('claim_id', claimId)
      .single();

    expect(claim).toBeNull();
  });
});

// =====================================================
// INTEGRATION TESTS: Full Claim Flow
// =====================================================

describe('Complete Claim Flow', () => {
  beforeEach(async () => {
    if (!supabase) return;

    await supabase
      .from('players')
      .update({ token_balance: '0' })
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase());

    await supabase
      .from('claim_signatures')
      .delete()
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase());
  });

  test('should process a valid claim successfully', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1500000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    const { data: result, error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_requested_amount: '1500000000000000000',
    });

    expect(error).toBeNull();
    expect(result).toBeTruthy();
    expect(result[0].new_balance).toBe('1500000000000000000');

    const { data: claim } = await supabase
      .from('claim_signatures')
      .select('*')
      .eq('claim_id', claimId)
      .single();

    expect(claim.used).toBe(true);
    expect(claim.used_at).toBeTruthy();
  });

  test('should reject replay attack', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_requested_amount: '1000000000000000000',
    });

    const { error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_requested_amount: '1000000000000000000',
    });

    expect(error).toBeTruthy();
    expect(error.message).toContain('already been used');
  });

  test('should reject amount forgery', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    const { error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_requested_amount: '9999999999999999999',
    });

    expect(error).toBeTruthy();
    expect(error.message).toContain('Amount mismatch');
  });

  test('should reject expired claim', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: -100,
      p_claim_type: 'test',
    });

    const { error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_requested_amount: '1000000000000000000',
    });

    expect(error).toBeTruthy();
    expect(error.message).toContain('expired');
  });

  test('should reject claim for wrong wallet', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    const differentWallet = '0x' + '1'.repeat(40);
    const { error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: differentWallet.toLowerCase(),
      p_requested_amount: '1000000000000000000',
    });

    expect(error).toBeTruthy();
    expect(error.message).toContain('Unauthorized wallet');
  });

  test('should handle concurrent claim attempts', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    const promises = [
      supabase.rpc('process_claim_transaction', {
        p_claim_id: claimId,
        p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
        p_requested_amount: '1000000000000000000',
      }),
      supabase.rpc('process_claim_transaction', {
        p_claim_id: claimId,
        p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
        p_requested_amount: '1000000000000000000',
      }),
      supabase.rpc('process_claim_transaction', {
        p_claim_id: claimId,
        p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
        p_requested_amount: '1000000000000000000',
      }),
    ];

    const results = await Promise.all(promises);
    const successes = results.filter(r => !r.error).length;

    expect(successes).toBe(1);

    const { data: player } = await supabase
      .from('players')
      .select('token_balance')
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase())
      .single();

    expect(player.token_balance).toBe('1000000000000000000');
  });
});

// =====================================================
// PERFORMANCE TESTS
// =====================================================

describe('Performance', () => {
  test('signature verification should be fast', async () => {
    const payload = {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: TEST_PLAYER_ADDRESS,
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    const signature = await signClaimPayload(payload, TEST_SIGNER_PRIVATE_KEY);

    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      verifyClaimSignature(payload, signature);
    }
    const elapsed = Date.now() - start;

    console.log(`\n  ✓ 100 signature verifications in ${elapsed}ms (${(elapsed / 100).toFixed(2)}ms avg)`);
    expect(elapsed).toBeLessThan(5000);
  });
});
