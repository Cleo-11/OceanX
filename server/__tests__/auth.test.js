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
        domain: 'OceanX',
        action: 'join-game',
        wallet: testAddress,
        timestamp: Date.now(),
        session: 'test-session-123'
      };
      
      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);
      
      const result = verifyJoinSignature({
        walletAddress: testAddress,
        sessionId: 'test-session-123',
        signature,
        message
      });
      expect(result.wallet).toBe(testAddress);
      expect(result.session).toBe('test-session-123');
    });

    it('should reject invalid signatures', async () => {
      const payload = {
        domain: 'OceanX',
        action: 'join-game',
        wallet: testAddress,
        timestamp: Date.now(),
        session: 'test-session-123'
      };
      
      const message = JSON.stringify(payload);
      const invalidSignature = '0x' + '0'.repeat(130);
      
      expect(() => {
        verifyJoinSignature({
          walletAddress: testAddress,
          sessionId: 'test-session-123',
          signature: invalidSignature,
          message
        });
      }).toThrow('Signature verification failed');
    });

    it('should reject expired signatures', async () => {
      const payload = {
        domain: 'OceanX',
        action: 'join-game',
        wallet: testAddress,
        timestamp: Date.now() - (10 * 60 * 1000), // 10 minutes ago
        session: 'test-session-123'
      };
      
      const message = JSON.stringify(payload);
      const signature = await testWallet.signMessage(message);
      
      expect(() => {
        verifyJoinSignature({
          walletAddress: testAddress,
          sessionId: 'test-session-123',
          signature,
          message,
          maxAgeMs: 5 * 60 * 1000
        });
      }).toThrow('expired');
    });
  });

  describe('verifyAuthSignature', () => {
    it('should verify valid auth signatures', async () => {
      const timestamp = Date.now();
      const message = `AbyssX get-balance\n\nWallet: ${testAddress}\nTimestamp: ${timestamp}\nNetwork: Sepolia`;
      const signature = await testWallet.signMessage(message);
      
      const result = verifyAuthSignature({
        walletAddress: testAddress,
        signature,
        message,
        expectedActions: ['get-balance']
      });
      expect(result.wallet).toBe(testAddress);
      expect(result.action).toBe('get-balance');
    });

    it('should reject address mismatch', async () => {
      const wrongAddress = ethers.Wallet.createRandom().address.toLowerCase();
      const timestamp = Date.now();
      const message = `AbyssX get-balance\n\nWallet: ${wrongAddress}\nTimestamp: ${timestamp}\nNetwork: Sepolia`;
      const signature = await testWallet.signMessage(message);
      
      expect(() => {
        verifyAuthSignature({
          walletAddress: wrongAddress,
          signature,
          message,
          expectedActions: ['get-balance']
        });
      }).toThrow(/does not correspond/);
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
        bodyKeys: { 
          address: ['address'], 
          message: ['message'],
          signature: ['signature']
        },
        headerKeys: { 
          address: ['x-wallet'], 
          message: ['x-message'],
          signature: ['x-signature']
        }
      });

      const req = {
        body: { address: testAddress, message: 'AbyssX test-action\\n\\nWallet: ' + testAddress + '\\nTimestamp: ' + Date.now() },
        headers: {},
        get: () => undefined,
        query: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn((data) => {
          expect(res.status).toHaveBeenCalledWith(401);
          expect(data.error).toContain('Signature');
          done();
        })
      };

      middleware(req, res, () => {});
    });
  });
});