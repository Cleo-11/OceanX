const { verifyJoinSignature, verifyAuthSignature, createAuthMiddleware } = require('../auth');
const { ethers } = require('ethers');

describe('Authentication System', () => {
  let testWallet;
  let testAddress;
  
  beforeAll(async () => {
    // Create a test wallet for signing
    testWallet = ethers.Wallet.createRandom();
    testAddress = testWallet.address.toLowerCase();
  });

  describe('verifyJoinSignature', () => {
    it('should verify valid join signatures', async () => {
      const payload = {
        action: 'join-game',
        address: testAddress,
        timestamp: Date.now(),
        nonce: 'test-nonce-123'
      };
      
      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);
      
      const result = await verifyJoinSignature(signature, payload);
      expect(result.isValid).toBe(true);
      expect(result.recoveredAddress).toBe(testAddress);
    });

    it('should reject invalid signatures', async () => {
      const payload = {
        action: 'join-game',
        address: testAddress,
        timestamp: Date.now(),
        nonce: 'test-nonce-123'
      };
      
      const invalidSignature = '0x' + '0'.repeat(130);
      
      const result = await verifyJoinSignature(invalidSignature, payload);
      expect(result.isValid).toBe(false);
    });

    it('should reject expired signatures', async () => {
      const payload = {
        action: 'join-game',
        address: testAddress,
        timestamp: Date.now() - (10 * 60 * 1000), // 10 minutes ago
        nonce: 'test-nonce-123'
      };
      
      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);
      
      const result = await verifyJoinSignature(signature, payload, 5 * 60 * 1000); // 5 min max age
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('verifyAuthSignature', () => {
    it('should verify valid auth signatures', async () => {
      const payload = {
        action: 'get-balance',
        address: testAddress,
        timestamp: Date.now(),
        nonce: 'test-nonce-456'
      };
      
      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);
      
      const result = await verifyAuthSignature(signature, payload);
      expect(result.isValid).toBe(true);
      expect(result.recoveredAddress).toBe(testAddress);
    });

    it('should reject address mismatch', async () => {
      const payload = {
        action: 'get-balance',
        address: ethers.Wallet.createRandom().address.toLowerCase(),
        timestamp: Date.now(),
        nonce: 'test-nonce-456'
      };
      
      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);
      
      const result = await verifyAuthSignature(signature, payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('address mismatch');
    });
  });

  describe('createAuthMiddleware', () => {
    it('should create middleware that validates expected actions', () => {
      const middleware = createAuthMiddleware({
        expectedActions: ['test-action'],
        bodyKeys: { address: 'string', nonce: 'string' },
        headerKeys: { signature: 'string', timestamp: 'string' }
      });
      
      expect(typeof middleware).toBe('function');
    });

    it('should reject requests with missing signature', (done) => {
      const middleware = createAuthMiddleware({
        expectedActions: ['test-action'],
        bodyKeys: { address: 'string' },
        headerKeys: { signature: 'string' }
      });

      const req = {
        body: { address: testAddress },
        headers: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn((data) => {
          expect(res.status).toHaveBeenCalledWith(401);
          expect(data.error).toContain('signature');
          done();
        })
      };

      middleware(req, res, () => {});
    });
  });
});