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

  beforeAll(async () => {
    // Create test wallet
    testWallet = ethers.Wallet.createRandom();
    testAddress = testWallet.address.toLowerCase();

    // Setup mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn()
    };
    createClient.mockReturnValue(mockSupabase);

    // Import and setup app after mocking
    delete require.cache[require.resolve('../index.js')];
    const appModule = require('../index.js');
    app = appModule.app || appModule;
  });

  describe('POST /player/balance', () => {
    it('should return player balance with valid authentication', async () => {
      // Mock successful database response
      mockSupabase.single.mockResolvedValueOnce({
        data: { balance: 1000 },
        error: null
      });

      const payload = {
        action: 'get-balance',
        address: testAddress,
        timestamp: Date.now(),
        nonce: 'test-nonce-123'
      };

      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);

      const response = await request(app)
        .post('/player/balance')
        .set('x-signature', signature)
        .set('x-timestamp', payload.timestamp.toString())
        .set('x-nonce', payload.nonce)
        .set('x-action', payload.action)
        .send({ address: testAddress });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('balance', 1000);
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

      const payload = {
        action: 'get-balance',
        address: testAddress,
        timestamp: Date.now(),
        nonce: 'test-nonce-456'
      };

      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);

      const response = await request(app)
        .post('/player/balance')
        .set('x-signature', signature)
        .set('x-timestamp', payload.timestamp.toString())
        .set('x-nonce', payload.nonce)
        .set('x-action', payload.action)
        .send({ address: testAddress });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Error fetching');
    });
  });

  describe('POST /player/submarine', () => {
    it('should return submarine info with valid authentication', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { submarine_tier: 'luxury' },
        error: null
      });

      const payload = {
        action: 'get-submarine',
        address: testAddress,
        timestamp: Date.now(),
        nonce: 'test-nonce-789'
      };

      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);

      const response = await request(app)
        .post('/player/submarine')
        .set('x-signature', signature)
        .set('x-timestamp', payload.timestamp.toString())
        .set('x-nonce', payload.nonce)
        .set('x-action', payload.action)
        .send({ address: testAddress });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('submarine_tier', 'luxury');
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

      const payload = {
        action: 'claim',
        address: testAddress,
        timestamp: Date.now(),
        nonce: 'test-nonce-claim'
      };

      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);

      const response = await request(app)
        .post('/player/claim')
        .set('x-signature', signature)
        .set('x-timestamp', payload.timestamp.toString())
        .set('x-nonce', payload.nonce)
        .set('x-action', payload.action)
        .send({ address: testAddress });

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

      const payload = {
        action: 'claim',
        address: testAddress,
        timestamp: Date.now(),
        nonce: 'test-nonce-double-claim'
      };

      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);

      const response = await request(app)
        .post('/player/claim')
        .set('x-signature', signature)
        .set('x-timestamp', payload.timestamp.toString())
        .set('x-nonce', payload.nonce)
        .set('x-action', payload.action)
        .send({ address: testAddress });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Already claimed');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on endpoints', async () => {
      const payload = {
        action: 'get-balance',
        address: testAddress,
        timestamp: Date.now(),
        nonce: 'test-rate-limit'
      };

      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);

      // Make multiple requests rapidly
      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/player/balance')
          .set('x-signature', signature)
          .set('x-timestamp', payload.timestamp.toString())
          .set('x-nonce', payload.nonce + Math.random())
          .set('x-action', payload.action)
          .send({ address: testAddress })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});