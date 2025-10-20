const request = require('supertest');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { ethers } = require('ethers');

// Mock Supabase
jest.mock('@supabase/supabase-js');

describe('API Endpoints', () => {
  let app;
  let testWallet;
  let testAddress;
  let mockSupabase;

  const buildAuthMessage = (action, wallet) => {
    const timestamp = Date.now();
    return {
      timestamp,
      message: `AbyssX ${action}\n\nWallet: ${wallet}\nTimestamp: ${timestamp}\n`,
    };
  };

  const signAction = async (action, walletSigner = testWallet) => {
    const wallet = walletSigner.address.toLowerCase();
    const { message, timestamp } = buildAuthMessage(action, wallet);
    const signature = await walletSigner.signMessage(message);
    return { message, signature, timestamp };
  };

  beforeAll(async () => {
    // Create test wallet
    testWallet = ethers.Wallet.createRandom();
    testAddress = testWallet.address.toLowerCase();

    // Setup mock Supabase
    mockSupabase = {
      from: jest.fn(() => mockSupabase),
      select: jest.fn(() => mockSupabase),
      ilike: jest.fn(() => mockSupabase),
      limit: jest.fn(() => mockSupabase),
      update: jest.fn(() => mockSupabase),
      eq: jest.fn(() => mockSupabase),
      single: jest.fn(),
    };
    createClient.mockReturnValue(mockSupabase);

    // Import and setup app after mocking
    delete require.cache[require.resolve('../index.js')];
    const appModule = require('../index.js');
    app = appModule.app || appModule;
  });

  beforeEach(() => {
    const chainableMethods = ['from', 'select', 'ilike', 'limit', 'update', 'eq'];
    chainableMethods.forEach((method) => {
      mockSupabase[method].mockReset();
      mockSupabase[method].mockImplementation((...args) => {
        if (method === 'from') {
          mockSupabase._table = args[0];
        }
        return mockSupabase;
      });
    });
    mockSupabase.single.mockReset();
    mockSupabase._table = null;
  });

  describe('POST /player/balance', () => {
    it('should return player balance with valid authentication', async () => {
      // Mock successful database response
      mockSupabase.single.mockResolvedValueOnce({
        data: { coins: 1000, total_ocx_earned: 5000 },
        error: null
      });

      const { message, signature } = await signAction('get balance');

      const response = await request(app)
        .post('/player/balance')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        coins: 1000,
        symbol: 'COIN',
        network: 'offchain',
        legacyTokenBalance: '5000',
      });
      expect(response.body.balance).toBe('1000');
    });

    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/player/balance')
        .send({ address: testAddress });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('signature');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const { message, signature } = await signAction('get balance');

      const response = await request(app)
        .post('/player/balance')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Error fetching');
    });
  });

  describe('POST /player/submarine', () => {
    it('should return submarine info with valid authentication', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { submarine_tier: 2 },
        error: null
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 2,
          tier: 2,
          name: 'Test Sub',
          description: 'Test Tier',
          max_nickel: 150,
          max_cobalt: 150,
          max_copper: 150,
          max_manganese: 75,
          health: 120,
          energy: 110,
          speed: 1.2,
          mining_rate: 1.5,
          depth_limit: 1500,
          color: '#ffffff',
          special_ability: 'Test ability',
        },
        error: null
      });

      const { message, signature } = await signAction('get submarine');

      const response = await request(app)
        .post('/player/submarine')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        current: {
          id: 2,
          tier: 2,
          name: 'Test Sub',
          description: 'Test Tier',
          storage: 150,
          speed: 1.2,
          miningPower: 1.5,
          color: '#ffffff',
          specialAbility: 'Test ability',
        },
        canUpgrade: true,
      });
    });
  });

  describe('POST /player/claim', () => {
    it('should process daily claim successfully', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Mock player data (not claimed today)
      mockSupabase.single.mockResolvedValueOnce({
        data: { 
          balance: 500, 
          submarine_tier: 'basic',
          last_daily_claim: '2024-01-01' // Old date
        },
        error: null
      });

      // Mock successful update
      mockSupabase.eq.mockResolvedValueOnce({
        error: null
      });

      const { message, signature } = await signAction('claim');

      const response = await request(app)
        .post('/player/claim')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('amount', 500); // Basic tier
      expect(response.body).toHaveProperty('new_balance', 1000);
    });

    it('should reject double claims on same day', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      mockSupabase.single.mockResolvedValueOnce({
        data: { 
          balance: 1000, 
          submarine_tier: 'basic',
          last_daily_claim: today // Already claimed today
        },
        error: null
      });

      const { message, signature } = await signAction('claim');

      const response = await request(app)
        .post('/player/claim')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Already claimed');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on endpoints', async () => {
      const { message, signature } = await signAction('get balance');

      // Make multiple requests rapidly
      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/player/balance')
          .send({ address: testAddress, signature, message })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('POST /submarine/upgrade', () => {
    it('should upgrade submarine when player has sufficient coins', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'player-1', wallet_address: testAddress, submarine_tier: 1, coins: 500 },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'player-1', submarine_tier: 2, coins: 300 },
          error: null,
        });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        previousTier: 1,
        newTier: 2,
        coins: 300,
        cost: { coins: 200 },
      });
      expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
        submarine_tier: 2,
        coins: 300,
      }));
    });

    it('should reject upgrade when coins are insufficient', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'player-1', wallet_address: testAddress, submarine_tier: 1, coins: 50 },
        error: null,
      });

      const { message, signature } = await signAction('upgrade submarine');

      const response = await request(app)
        .post('/submarine/upgrade')
        .send({ address: testAddress, signature, message });

      expect(response.status).toBe(402);
      expect(response.body.error).toMatch(/not enough coins/i);
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
  });
});