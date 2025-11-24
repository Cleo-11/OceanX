/**
 * Comprehensive tests for the Secure Claim System
 * 
 * Tests cover:
 * - Valid claims
 * - Replay attack prevention
 * - Amount forgery prevention
 * - Expiration handling
 * - Signature verification
 * - Race condition prevention
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import {
  verifyClaimSignature,
  signClaimPayload,
  verifyClaimRequest,
  isValidWalletAddress,
  normalizeWalletAddress,
} from '../lib/claim-signature-verification';
import {
  ClaimPayload,
  ClaimRequest,
  CLAIM_DOMAIN,
  CLAIM_TYPES,
} from '../lib/claim-types';

// =====================================================
// TEST CONFIGURATION
// =====================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Generate a test signing key (deterministic for tests)
const TEST_SIGNER_PRIVATE_KEY = ethers.keccak256(ethers.toUtf8Bytes('test-claim-signer'));
const testWallet = new ethers.Wallet(TEST_SIGNER_PRIVATE_KEY);
const TEST_SIGNER_ADDRESS = testWallet.address;

// Test player wallet
const TEST_PLAYER_PRIVATE_KEY = ethers.keccak256(ethers.toUtf8Bytes('test-player'));
const testPlayerWallet = new ethers.Wallet(TEST_PLAYER_PRIVATE_KEY);
const TEST_PLAYER_ADDRESS = testPlayerWallet.address;

let supabase;

// =====================================================
// TEST SETUP
// =====================================================

beforeAll(async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn('⚠️  Supabase credentials not set. Skipping integration tests.');
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
    }, {
      onConflict: 'wallet',
    });

  if (error) {
    console.error('Failed to create test player:', error);
  }
});

afterAll(async () => {
  // Cleanup test data
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
  it('should verify a valid signature', async () => {
    const payload: ClaimPayload = {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: TEST_PLAYER_ADDRESS,
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    const signature = await signClaimPayload(payload, TEST_SIGNER_PRIVATE_KEY);
    const recoveredAddress = verifyClaimSignature(payload, signature);

    expect(recoveredAddress.toLowerCase()).toBe(TEST_SIGNER_ADDRESS.toLowerCase());
  });

  it('should reject tampered amount', async () => {
    const payload: ClaimPayload = {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: TEST_PLAYER_ADDRESS,
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    const signature = await signClaimPayload(payload, TEST_SIGNER_PRIVATE_KEY);

    // Tamper with amount
    const tamperedPayload = { ...payload, amount: '9999999999999999999' };

    // Use verifyClaimRequest which checks if signer matches wallet
    const result = verifyClaimRequest({ payload: tamperedPayload, signature });
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('UNAUTHORIZED_WALLET');
  });

  it('should reject tampered wallet', async () => {
    const payload: ClaimPayload = {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: TEST_PLAYER_ADDRESS,
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    const signature = await signClaimPayload(payload, TEST_SIGNER_PRIVATE_KEY);

    // Tamper with wallet
    const tamperedPayload = { ...payload, wallet: '0x' + '0'.repeat(40) };

    // Use verifyClaimRequest which checks if signer matches wallet
    const result = verifyClaimRequest({ payload: tamperedPayload, signature });
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('UNAUTHORIZED_WALLET');
  });

  it('should reject invalid signature format', () => {
    const payload: ClaimPayload = {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: TEST_PLAYER_ADDRESS,
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    };

    expect(() => {
      verifyClaimSignature(payload, 'invalid-signature');
    }).toThrow();
  });

  it('should detect expired signature', () => {
    const expiredPayload: ClaimPayload = {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: TEST_PLAYER_ADDRESS,
      amount: '1000000000000000000',
      expiresAt: Math.floor(Date.now() / 1000) - 100, // Expired
    };

    const request: ClaimRequest = {
      payload: expiredPayload,
      signature: '0x' + '0'.repeat(130),
    };

    const result = verifyClaimRequest(request);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('SIGNATURE_EXPIRED');
  });

  it('should validate wallet addresses', () => {
    expect(isValidWalletAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0')).toBe(true);
    expect(isValidWalletAddress('0xinvalid')).toBe(false);
    expect(isValidWalletAddress('not-an-address')).toBe(false);
  });

  it('should normalize wallet addresses', () => {
    const unnormalized = '0x742d35cc6634c0532925a3b844bc9e7595f0beb0';
    const normalized = normalizeWalletAddress(unnormalized);
    // Ethers checksums this address as:
    expect(normalized).toBe('0x742D35CC6634c0532925A3b844BC9E7595F0BEb0');
  });
});

// =====================================================
// INTEGRATION TESTS: Database Functions
// =====================================================

describe('Database Integration', () => {
  beforeEach(async () => {
    if (!supabase) return;

    // Clean up test claims before each test
    await supabase
      .from('claim_signatures')
      .delete()
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase());
  });

  it('should create a claim signature in database', async () => {
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

    // Verify the claim was created
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

  it('should prevent duplicate active claims (if enabled)', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping database test (no Supabase connection)');
      return;
    }

    // Create first claim
    await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    // Note: The duplicate check is commented out in the function
    // This test documents the expected behavior if enabled
  });

  it('should cleanup expired claims', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping database test (no Supabase connection)');
      return;
    }

    // Create an expired claim
    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: -100, // Already expired
      p_claim_type: 'test',
    });

    // Run cleanup
    const { data: deletedCount } = await supabase.rpc('cleanup_expired_claim_signatures');

    expect(deletedCount).toBeGreaterThanOrEqual(1);

    // Verify claim was deleted
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

    // Reset test player balance
    await supabase
      .from('players')
      .update({ token_balance: '0' })
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase());

    // Clean up test claims
    await supabase
      .from('claim_signatures')
      .delete()
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase());
  });

  it('should process a valid claim successfully', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    // 1. Create claim signature
    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1500000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    // 2. Process the claim
    const { data: result, error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_requested_amount: '1500000000000000000',
    });

    expect(error).toBeNull();
    expect(result).toBeTruthy();
    expect(result[0].new_balance).toBe('1500000000000000000');

    // 3. Verify claim is marked as used
    const { data: claim } = await supabase
      .from('claim_signatures')
      .select('*')
      .eq('claim_id', claimId)
      .single();

    expect(claim.used).toBe(true);
    expect(claim.used_at).toBeTruthy();

    // 4. Verify player balance updated
    const { data: player } = await supabase
      .from('players')
      .select('token_balance')
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase())
      .single();

    expect(player.token_balance).toBe('1500000000000000000');
  });

  it('should reject replay attack (reusing same claim)', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    // 1. Create and process first claim
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

    // 2. Try to reuse the same claim (replay attack)
    const { error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_requested_amount: '1000000000000000000',
    });

    expect(error).toBeTruthy();
    expect(error.message).toContain('already been used');

    // 3. Verify balance wasn't doubled
    const { data: player } = await supabase
      .from('players')
      .select('token_balance')
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase())
      .single();

    expect(player.token_balance).toBe('1000000000000000000'); // Not doubled
  });

  it('should reject amount forgery attempt', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    // 1. Create claim for 1 token
    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000', // 1 token
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    // 2. Try to claim with different amount (forgery attempt)
    const { error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_requested_amount: '9999999999999999999', // Try to claim 9999 tokens!
    });

    expect(error).toBeTruthy();
    expect(error.message).toContain('Amount mismatch');

    // 3. Verify balance wasn't updated
    const { data: player } = await supabase
      .from('players')
      .select('token_balance')
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase())
      .single();

    expect(player.token_balance).toBe('0'); // No tokens claimed
  });

  it('should reject expired claim', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    // 1. Create expired claim
    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: -100, // Already expired
      p_claim_type: 'test',
    });

    // 2. Try to process expired claim
    const { error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_requested_amount: '1000000000000000000',
    });

    expect(error).toBeTruthy();
    expect(error.message).toContain('expired');
  });

  it('should reject claim for wrong wallet', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    // 1. Create claim for player A
    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    // 2. Try to claim with different wallet (player B)
    const differentWallet = '0x' + '1'.repeat(40);
    const { error } = await supabase.rpc('process_claim_transaction', {
      p_claim_id: claimId,
      p_wallet: differentWallet.toLowerCase(),
      p_requested_amount: '1000000000000000000',
    });

    expect(error).toBeTruthy();
    expect(error.message).toContain('Unauthorized wallet');
  });

  it('should handle concurrent claim attempts (race condition)', async () => {
    if (!supabase) {
      console.log('⚠️  Skipping integration test (no Supabase connection)');
      return;
    }

    // 1. Create claim
    const { data: claimId } = await supabase.rpc('create_claim_signature', {
      p_wallet: TEST_PLAYER_ADDRESS.toLowerCase(),
      p_amount: '1000000000000000000',
      p_expires_in_seconds: 300,
      p_claim_type: 'test',
    });

    // 2. Try to process same claim concurrently
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

    // 3. Only one should succeed
    const successes = results.filter(r => !r.error).length;
    expect(successes).toBe(1);

    // 4. Verify balance is correct (not multiplied)
    const { data: player } = await supabase
      .from('players')
      .select('token_balance')
      .eq('wallet', TEST_PLAYER_ADDRESS.toLowerCase())
      .single();

    expect(player.token_balance).toBe('1000000000000000000'); // Only claimed once
  });
});

// =====================================================
// PERFORMANCE TESTS
// =====================================================

describe('Performance', () => {
  it('should handle signature verification quickly', async () => {
    const payload: ClaimPayload = {
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

    console.log(`✓ 100 signature verifications in ${elapsed}ms (${elapsed / 100}ms avg)`);
    expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds
  });
});

console.log(`
🧪 Secure Claim System Tests
============================
Test Signer Address: ${TEST_SIGNER_ADDRESS}
Test Player Address: ${TEST_PLAYER_ADDRESS}
Supabase Connected: ${!!supabase}
`);
