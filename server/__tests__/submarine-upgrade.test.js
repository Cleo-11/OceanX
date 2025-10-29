/**
 * Comprehensive Test Suite for Submarine Upgrade System
 * 
 * This suite validates the off-chain submarine upgrade flow:
 * Frontend → Backend → Supabase → Frontend reload
 * 
 * Test Coverage:
 * 1. Successful upgrade scenarios
 * 2. Insufficient funds validation
 * 3. Sequential tier enforcement
 * 4. Database integrity checks
 * 5. Edge cases and race conditions
 * 6. Error handling and rollback
 */

const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');

// Mock Supabase
jest.mock('@supabase/supabase-js');

describe('Submarine Upgrade System - Comprehensive Test Suite', () => {
  let app;
  let testWallet;
  let testAddress;
  let mockSupabase;

  // Helper: Build authentication message
  const buildAuthMessage = (action, wallet) => {
    const timestamp = Date.now();
    return {
      timestamp,
      message: `AbyssX ${action}\n\nWallet: ${wallet}\nTimestamp: ${timestamp}\nNetwork: Sepolia`,
    };
  };

  // Helper: Sign action with wallet
  const signAction = async (action, walletSigner = testWallet) => {
    const wallet = walletSigner.address.toLowerCase();
    const { message, timestamp } = buildAuthMessage(action, wallet);
    const signature = await walletSigner.signMessage(message);
    return { message, signature, timestamp };
  };

  // Helper: Create mock player
  const createMockPlayer = (overrides = {}) => ({
    id: 'test-player-uuid',
    wallet_address: testAddress,
    submarine_tier: 1,
    coins: 1000,
    ...overrides,
  });

  beforeAll(async () => {
    // Create test wallet
    testWallet = ethers.Wallet.createRandom();
    testAddress = testWallet.address.toLowerCase();

    // Setup mock Supabase with chainable methods
    mockSupabase = {
      from: jest.fn(() => mockSupabase),
      select: jest.fn(() => mockSupabase),
      ilike: jest.fn(() => mockSupabase),
      eq: jest.fn(() => mockSupabase),
      limit: jest.fn(() => mockSupabase),
      update: jest.fn(() => mockSupabase),
      single: jest.fn(),
      _table: null,
    };
    createClient.mockReturnValue(mockSupabase);

    // Import app after mocking
    delete require.cache[require.resolve('../index.js')];
    const appModule = require('../index.js');
    app = appModule.app || appModule;
  });

  beforeEach(() => {
    // Reset all mocks before each test
    const chainableMethods = ['from', 'select', 'ilike', 'eq', 'limit', 'update'];
    chainableMethods.forEach((method) => {
      mockSupabase[method].mockClear();
      mockSupabase[method].mockImplementation((...args) => {
        if (method === 'from') {
          mockSupabase._table = args[0];
        }
        return mockSupabase;
      });
    });
    mockSupabase.single.mockClear();
    mockSupabase._table = null;
  });

  describe('1. Backend Route Testing - Success Scenarios', () => {
    it('should successfully upgrade from tier 1 to tier 2 with sufficient coins', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: 500 });
      const upgradedPlayer = { id: initialPlayer.id, submarine_tier: 2, coins: 300 };

      // Mock player fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: initialPlayer,
        error: null,
      });

      // Mock successful update
      mockSupabase.single.mockResolvedValueOnce({
        data: upgradedPlayer,
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      // Assertions
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        playerId: initialPlayer.id,
        wallet: testAddress,
        previousTier: 1,
        newTier: 2,
        coins: 300,
        cost: { coins: 200 }, // (1 + 1) * 100 = 200
      });
      expect(response.body.message).toContain('upgraded to tier 2');

      // Verify Supabase was called correctly
      expect(mockSupabase.from).toHaveBeenCalledWith('players');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          submarine_tier: 2,
          coins: 300,
        })
      );
    });

    it('should upgrade from tier 5 to tier 6 with exact coin amount', async () => {
      const upgradeCost = 600; // (5 + 1) * 100
      const initialPlayer = createMockPlayer({ submarine_tier: 5, coins: 600 });
      const upgradedPlayer = { id: initialPlayer.id, submarine_tier: 6, coins: 0 };

      mockSupabase.single
        .mockResolvedValueOnce({ data: initialPlayer, error: null })
        .mockResolvedValueOnce({ data: upgradedPlayer, error: null });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(200);
      expect(response.body.previousTier).toBe(5);
      expect(response.body.newTier).toBe(6);
      expect(response.body.coins).toBe(0);
      expect(response.body.cost.coins).toBe(upgradeCost);
    });

    it('should include tier details in response payload', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: 1000 });
      const upgradedPlayer = { id: initialPlayer.id, submarine_tier: 2, coins: 800 };

      mockSupabase.single
        .mockResolvedValueOnce({ data: initialPlayer, error: null })
        .mockResolvedValueOnce({ data: upgradedPlayer, error: null });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(200);
      expect(response.body.tierDetails).toBeDefined();
      expect(response.body.tierDetails).toHaveProperty('name');
      expect(response.body.tierDetails).toHaveProperty('baseStats');
      expect(response.body.tierDetails).toHaveProperty('upgradeCost');
    });
  });

  describe('2. Backend Route Testing - Validation & Error Cases', () => {
    it('should reject upgrade when player has insufficient coins', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: 50 });

      mockSupabase.single.mockResolvedValueOnce({
        data: initialPlayer,
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(402);
      expect(response.body.error).toMatch(/not enough coins/i);
      expect(response.body.code).toBe('INSUFFICIENT_COINS');
      
      // Verify no update was attempted
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should reject upgrade when player is at maximum tier', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 15, coins: 10000 });

      mockSupabase.single.mockResolvedValueOnce({
        data: initialPlayer,
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/maximum.*tier.*reached/i);
      expect(response.body.code).toBe('TIER_MAXED');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should reject non-sequential tier upgrades', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: 10000 });

      mockSupabase.single.mockResolvedValueOnce({
        data: initialPlayer,
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ 
          address: testAddress, 
          signature, 
          message,
          targetTier: 5, // Trying to jump from 1 to 5
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/sequential/i);
      expect(response.body.code).toBe('NON_SEQUENTIAL_TIER');
    });

    it('should return 404 when player record does not exist', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows returned' },
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/player.*not found/i);
      expect(response.body.code).toBe('PLAYER_NOT_FOUND');
    });

    it('should reject requests without valid authentication', async () => {
      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should reject requests with wallet mismatch', async () => {
      const { message, signature } = await signAction('upgrade submarine');
      const differentAddress = ethers.Wallet.createRandom().address.toLowerCase();

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: differentAddress, signature, message });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/wallet/i);
    });
  });

  describe('3. Supabase Data Integrity Tests', () => {
    it('should atomically update both submarine_tier and coins', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 3, coins: 1000 });
      const upgradedPlayer = { id: initialPlayer.id, submarine_tier: 4, coins: 600 };

      mockSupabase.single
        .mockResolvedValueOnce({ data: initialPlayer, error: null })
        .mockResolvedValueOnce({ data: upgradedPlayer, error: null });

      const { message, signature } = await signAction('upgrade submarine');

      await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      // Verify update was called with correct values
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          submarine_tier: 4,
          coins: 600,
          updated_at: expect.any(String),
        })
      );

      // Verify update was called exactly once
      expect(mockSupabase.update).toHaveBeenCalledTimes(1);
    });

    it('should rollback gracefully when Supabase update fails', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 2, coins: 1000 });

      mockSupabase.single
        .mockResolvedValueOnce({ data: initialPlayer, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database constraint violation' },
        });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(500);
      expect(response.body.error).toMatch(/failed.*upgrade/i);
      expect(response.body.code).toBe('UPGRADE_PERSIST_FAILED');
    });

    it('should maintain data consistency when update returns null', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: 500 });

      mockSupabase.single
        .mockResolvedValueOnce({ data: initialPlayer, error: null })
        .mockResolvedValueOnce({ data: null, error: null }); // Unexpected null

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('UPGRADE_PERSIST_FAILED');
    });

    it('should correctly calculate upgrade costs for all tiers', async () => {
      const testCases = [
        { tier: 1, expectedCost: 200 },
        { tier: 3, expectedCost: 400 },
        { tier: 7, expectedCost: 800 },
        { tier: 10, expectedCost: 1100 },
        { tier: 14, expectedCost: 1500 },
      ];

      for (const { tier, expectedCost } of testCases) {
        mockSupabase.single
          .mockResolvedValueOnce({
            data: createMockPlayer({ submarine_tier: tier, coins: 10000 }),
            error: null,
          })
          .mockResolvedValueOnce({
            data: { id: 'test-id', submarine_tier: tier + 1, coins: 10000 - expectedCost },
            error: null,
          });

        const { message, signature } = await signAction('upgrade submarine');

        const response = await request(app)
          .post('/submarine/upgrade')
          .send({ address: testAddress, signature, message });

        expect(response.status).toBe(200);
        expect(response.body.cost.coins).toBe(expectedCost);
      }
    });
  });

  describe('4. Edge Cases & Race Conditions', () => {
    it('should handle coins = 0 gracefully', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: 0 });

      mockSupabase.single.mockResolvedValueOnce({
        data: initialPlayer,
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(402);
      expect(response.body.error).toMatch(/not enough coins/i);
    });

    it('should handle negative coins value (data corruption scenario)', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: -100 });

      mockSupabase.single.mockResolvedValueOnce({
        data: initialPlayer,
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(402);
      expect(response.body.error).toMatch(/not enough coins/i);
    });

    it('should handle null/undefined coins value', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: null });

      mockSupabase.single.mockResolvedValueOnce({
        data: initialPlayer,
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(402);
      expect(response.body.error).toMatch(/not enough coins/i);
    });

    it('should handle tier 0 or invalid tier values', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 0, coins: 1000 });

      mockSupabase.single.mockResolvedValueOnce({
        data: initialPlayer,
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      // Should normalize tier 0 to tier 1 and attempt upgrade to tier 2
      expect(response.status).toBe(200);
      expect(response.body.previousTier).toBe(1);
      expect(response.body.newTier).toBe(2);
    });

    it('should handle extremely large coin values without overflow', async () => {
      const largeCoins = Number.MAX_SAFE_INTEGER - 1000;
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: largeCoins });
      const upgradedPlayer = { 
        id: initialPlayer.id, 
        submarine_tier: 2, 
        coins: largeCoins - 200 
      };

      mockSupabase.single
        .mockResolvedValueOnce({ data: initialPlayer, error: null })
        .mockResolvedValueOnce({ data: upgradedPlayer, error: null });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(200);
      expect(response.body.coins).toBe(largeCoins - 200);
    });

    it('should prevent upgrade beyond tier 15 (max tier)', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 15, coins: 50000 });

      mockSupabase.single.mockResolvedValueOnce({
        data: initialPlayer,
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ 
          address: testAddress, 
          signature, 
          message,
          targetTier: 16,
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('TIER_MAXED');
    });
  });

  describe('5. Concurrent Request Handling', () => {
    it('should handle rapid successive upgrade attempts (simulated race condition)', async () => {
      // Note: This test simulates the scenario but actual prevention 
      // would require database-level locking or optimistic concurrency control
      
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: 600 });
      
      // First request succeeds
      mockSupabase.single
        .mockResolvedValueOnce({ data: initialPlayer, error: null })
        .mockResolvedValueOnce({
          data: { id: initialPlayer.id, submarine_tier: 2, coins: 400 },
          error: null,
        });

      // Second request should see updated tier
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { ...initialPlayer, submarine_tier: 2, coins: 400 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: initialPlayer.id, submarine_tier: 3, coins: 100 },
          error: null,
        });

      const { message, signature } = await signAction('upgrade submarine');

      // First upgrade
      const response1 = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      // Second upgrade (would normally be blocked by rate limiting)
      const response2 = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response1.status).toBe(200);
      expect(response1.body.newTier).toBe(2);
      
      expect(response2.status).toBe(200);
      expect(response2.body.newTier).toBe(3);
    });
  });

  describe('6. Integration with Rate Limiting', () => {
    it('should apply rate limiting to upgrade endpoint', async () => {
      const initialPlayer = createMockPlayer({ submarine_tier: 1, coins: 100000 });
      
      // Mock responses for multiple requests
      for (let i = 0; i < 25; i++) {
        mockSupabase.single
          .mockResolvedValueOnce({ data: initialPlayer, error: null })
          .mockResolvedValueOnce({
            data: { id: initialPlayer.id, submarine_tier: 2, coins: 99800 },
            error: null,
          });
      }

      const { message, signature } = await signAction('upgrade submarine');

      // Send many requests rapidly
      const requests = Array(25).fill().map(() =>
        request(app)
          .post('/submarine/upgrade')
          .send({ address: testAddress, signature, message })
      );

      const responses = await Promise.all(requests);
      
      // Should have some rate-limited responses (429)
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });
});
