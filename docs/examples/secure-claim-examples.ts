/**
 * Complete Example: Secure Token Claim Flow
 * 
 * This file demonstrates the entire claim process from start to finish.
 */

import { ethers } from 'ethers';

// =====================================================
// EXAMPLE 1: Backend Creates a Claim Signature
// =====================================================

/**
 * When a player completes an action that earns tokens,
 * your backend generates a signed claim.
 */
async function exampleBackendCreateClaim() {
  const playerWallet = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  
  // 1. Calculate how much the player should receive
  // THIS IS SERVER-AUTHORITATIVE - client cannot influence this
  const earnedAmount = await calculatePlayerRewards(playerWallet);
  
  console.log(`Player earned: ${earnedAmount} tokens`);
  
  // 2. Create a signed claim (using your backend script)
  const claimRequest = await generateClaimSignature({
    wallet: playerWallet,
    amount: earnedAmount.toString(),
    claimType: 'mining_payout',
    expiresInSeconds: 600, // 10 minutes
  });
  
  // 3. Send this to the client
  return {
    success: true,
    claim: claimRequest,
    message: 'Mining complete! You can now claim your rewards.',
  };
}

/**
 * Example: Calculate rewards based on game state
 */
async function calculatePlayerRewards(wallet: string): Promise<bigint> {
  // Fetch player data from database
  const player = await fetchPlayer(wallet);
  
  // Example calculation based on:
  // - Time spent mining
  // - Player's mining power
  // - Current difficulty
  
  const timeInSeconds = player.currentMiningSession.duration;
  const miningPower = BigInt(player.stats.miningPower);
  const baseReward = miningPower * BigInt(timeInSeconds);
  
  // Apply difficulty multiplier
  const difficulty = player.currentMiningSession.difficulty;
  const finalReward = (baseReward * BigInt(difficulty)) / BigInt(100);
  
  // Convert to token units (18 decimals)
  const decimals18 = BigInt('1000000000000000000');
  return finalReward * decimals18;
}

// =====================================================
// EXAMPLE 2: Client Receives and Submits Claim
// =====================================================

/**
 * Client receives the claim from backend and submits it
 */
async function exampleClientSubmitClaim() {
  // 1. Client calls backend endpoint to finish mining
  const response = await fetch('/api/mining/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'abc-123',
    }),
  });
  
  const result = await response.json();
  
  // result.claim contains:
  // {
  //   payload: {
  //     claimId: "550e8400-e29b-41d4-a716-446655440000",
  //     wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  //     amount: "1500000000000000000",  // Server decided this!
  //     expiresAt: 1700000000
  //   },
  //   signature: "0x1234...abcd"
  // }
  
  console.log('Received claim for amount:', result.claim.payload.amount);
  
  // 2. Client submits the claim to the claim endpoint
  const claimResponse = await fetch('/api/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.claim),
  });
  
  const claimResult = await claimResponse.json();
  
  if (claimResult.success) {
    console.log('✅ Tokens claimed successfully!');
    console.log('Amount claimed:', claimResult.amount);
    console.log('New balance:', claimResult.newBalance);
  } else {
    console.error('❌ Claim failed:', claimResult.error);
  }
  
  return claimResult;
}

// =====================================================
// EXAMPLE 3: What Happens if Client Tries to Cheat?
// =====================================================

/**
 * Scenario: Malicious client tries to modify the claim amount
 */
async function exampleClientTriesToCheat() {
  // 1. Client receives legitimate claim from backend
  const legitimateClaim = {
    payload: {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      amount: '1500000000000000000', // 1.5 tokens
      expiresAt: 1700000000,
    },
    signature: '0xabcd1234...', // Valid signature for above payload
  };
  
  // 2. Hacker tries to modify the amount
  const tamperedClaim = {
    ...legitimateClaim,
    payload: {
      ...legitimateClaim.payload,
      amount: '999999999999999999999', // Changed to 999999 tokens!
    },
    // Signature is still the same (signed the original amount)
  };
  
  // 3. Submit tampered claim
  const response = await fetch('/api/claim', {
    method: 'POST',
    body: JSON.stringify(tamperedClaim),
  });
  
  const result = await response.json();
  
  // ❌ RESULT: Claim is rejected!
  console.log(result);
  // {
  //   success: false,
  //   error: "Signature verification failed",
  //   code: "INVALID_SIGNATURE"
  // }
  
  // WHY: The signature was created for amount="1500000000000000000"
  // When we verify the signature with amount="999999999999999999999",
  // the EIP-712 hash doesn't match, so verification fails!
}

// =====================================================
// EXAMPLE 4: What Happens with Replay Attack?
// =====================================================

/**
 * Scenario: Client tries to use the same signature twice
 */
async function exampleReplayAttack() {
  const claim = {
    payload: {
      claimId: '550e8400-e29b-41d4-a716-446655440000',
      wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      amount: '1500000000000000000',
      expiresAt: 1700000000,
    },
    signature: '0xabcd1234...',
  };
  
  // 1. First claim - succeeds
  const firstClaim = await fetch('/api/claim', {
    method: 'POST',
    body: JSON.stringify(claim),
  });
  
  const firstResult = await firstClaim.json();
  console.log('First claim:', firstResult);
  // ✅ { success: true, amount: "1500000000000000000", ... }
  
  // 2. Second claim with same signature - fails
  const secondClaim = await fetch('/api/claim', {
    method: 'POST',
    body: JSON.stringify(claim), // Same exact data!
  });
  
  const secondResult = await secondClaim.json();
  console.log('Second claim:', secondResult);
  // ❌ {
  //   success: false,
  //   error: "Claim signature has already been used",
  //   code: "CLAIM_ALREADY_USED"
  // }
  
  // WHY: The database marks the claim_id as "used" after first claim.
  // The atomic transaction includes:
  // 1. Lock the row (prevents concurrent use)
  // 2. Check if used = false
  // 3. Mark used = true
  // 4. Credit balance
  // All in one transaction!
}

// =====================================================
// EXAMPLE 5: Complete Integration Pattern
// =====================================================

/**
 * How to integrate this into your game
 */
class GameTokenClaims {
  /**
   * When player completes mining, generate a claim
   */
  async onMiningComplete(wallet: string, sessionId: string) {
    try {
      // 1. Validate the mining session
      const session = await this.validateMiningSession(sessionId, wallet);
      
      // 2. Calculate rewards (SERVER-AUTHORITATIVE)
      const rewards = await this.calculateMiningRewards(session);
      
      // 3. Generate signed claim
      const claim = await this.generateClaim({
        wallet,
        amount: rewards.toString(),
        claimType: 'mining_payout',
        expiresInSeconds: 600,
        metadata: {
          sessionId,
          miningPower: session.miningPower,
          duration: session.duration,
        },
      });
      
      // 4. Return to client
      return {
        success: true,
        rewards: rewards.toString(),
        claim,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  /**
   * Calculate mining rewards based on session data
   */
  private async calculateMiningRewards(session: MiningSession): Promise<bigint> {
    // Your game logic here
    const baseReward = BigInt(session.miningPower) * BigInt(session.duration);
    const decimals18 = BigInt('1000000000000000000');
    return baseReward * decimals18;
  }
  
  /**
   * Validate a mining session belongs to the player
   */
  private async validateMiningSession(
    sessionId: string,
    wallet: string
  ): Promise<MiningSession> {
    // Fetch from database and verify ownership
    const session = await db.miningSessions.findOne({ sessionId });
    
    if (!session) {
      throw new Error('Mining session not found');
    }
    
    if (session.wallet.toLowerCase() !== wallet.toLowerCase()) {
      throw new Error('Session does not belong to this wallet');
    }
    
    if (session.completed) {
      throw new Error('Session already completed');
    }
    
    return session;
  }
  
  /**
   * Generate a claim signature
   */
  private async generateClaim(options: any) {
    // Call your signature generation script
    return await generateClaimSignature(options);
  }
}

// =====================================================
// EXAMPLE 6: Testing
// =====================================================

/**
 * Example test cases
 */
describe('Secure Claim System', () => {
  it('should allow valid claim', async () => {
    const claim = await createTestClaim('1000000000000000000');
    const result = await submitClaim(claim);
    
    expect(result.success).toBe(true);
    expect(result.amount).toBe('1000000000000000000');
  });
  
  it('should reject tampered amount', async () => {
    const claim = await createTestClaim('1000000000000000000');
    claim.payload.amount = '9999999999999999999'; // Tamper!
    
    const result = await submitClaim(claim);
    
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_SIGNATURE');
  });
  
  it('should reject replay attack', async () => {
    const claim = await createTestClaim('1000000000000000000');
    
    // First claim succeeds
    const first = await submitClaim(claim);
    expect(first.success).toBe(true);
    
    // Second claim fails
    const second = await submitClaim(claim);
    expect(second.success).toBe(false);
    expect(second.code).toBe('CLAIM_ALREADY_USED');
  });
  
  it('should reject expired claim', async () => {
    const claim = await createTestClaim('1000000000000000000', {
      expiresInSeconds: -100, // Already expired
    });
    
    const result = await submitClaim(claim);
    
    expect(result.success).toBe(false);
    expect(result.code).toBe('SIGNATURE_EXPIRED');
  });
});

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface MiningSession {
  sessionId: string;
  wallet: string;
  miningPower: number;
  duration: number;
  completed: boolean;
}

// Mock implementations (replace with your actual implementations)
async function fetchPlayer(wallet: string): Promise<any> {
  // Your database query here
  return {
    wallet,
    stats: { miningPower: 100 },
    currentMiningSession: {
      duration: 3600,
      difficulty: 150,
    },
  };
}

async function generateClaimSignature(options: any): Promise<any> {
  // Your signature generation implementation
  return {
    payload: {
      claimId: 'test-id',
      wallet: options.wallet,
      amount: options.amount,
      expiresAt: Math.floor(Date.now() / 1000) + options.expiresInSeconds,
    },
    signature: '0x...',
  };
}

async function createTestClaim(amount: string, options?: any): Promise<any> {
  return generateClaimSignature({
    wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    amount,
    claimType: 'test',
    expiresInSeconds: 300,
    ...options,
  });
}

async function submitClaim(claim: any): Promise<any> {
  const response = await fetch('/api/claim', {
    method: 'POST',
    body: JSON.stringify(claim),
  });
  return response.json();
}

// Export examples
export {
  exampleBackendCreateClaim,
  exampleClientSubmitClaim,
  exampleClientTriesToCheat,
  exampleReplayAttack,
  GameTokenClaims,
};
