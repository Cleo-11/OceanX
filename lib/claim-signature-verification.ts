/**
 * Secure Claim Signature Verification
 * 
 * This module handles EIP-712 signature verification for the claim system.
 * All signatures must be verified server-side before processing claims.
 * 
 * SECURITY: Never trust client-provided amounts. Always calculate server-side.
 */

import { ethers } from 'ethers';
import {
  ClaimPayload,
  ClaimRequest,
  CLAIM_DOMAIN,
  CLAIM_TYPES,
  isValidClaimPayload,
} from './claim-types';

// =====================================================
// SIGNATURE VERIFICATION
// =====================================================

/**
 * Verifies an EIP-712 signature for a claim
 * 
 * @param payload - The claim payload that was signed
 * @param signature - The signature to verify
 * @returns The recovered signer address (checksummed)
 * @throws Error if signature is invalid or payload is malformed
 */
export function verifyClaimSignature(
  payload: ClaimPayload,
  signature: string
): string {
  // Validate payload structure
  if (!isValidClaimPayload(payload)) {
    throw new Error('Invalid claim payload structure');
  }

  // Validate signature format
  if (!signature || !signature.startsWith('0x') || signature.length !== 132) {
    throw new Error('Invalid signature format');
  }

  try {
    // Convert amount to string for consistency
    const normalizedPayload = {
      ...payload,
      amount: payload.amount.toString(),
      wallet: ethers.getAddress(payload.wallet), // Checksum the address
    };

    // Recover the signer address using EIP-712
    const recoveredAddress = ethers.verifyTypedData(
      CLAIM_DOMAIN,
      CLAIM_TYPES,
      normalizedPayload,
      signature
    );

    // Return checksummed address
    return ethers.getAddress(recoveredAddress);
  } catch (error) {
    throw new Error(`Signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verifies that the signature was created by the expected wallet
 * 
 * @param payload - The claim payload
 * @param signature - The signature to verify
 * @param expectedWallet - The wallet that should have signed this
 * @returns True if the signature is valid and from the expected wallet
 */
export function verifyClaimSignatureForWallet(
  payload: ClaimPayload,
  signature: string,
  expectedWallet: string
): boolean {
  try {
    const recoveredAddress = verifyClaimSignature(payload, signature);
    const expectedAddress = ethers.getAddress(expectedWallet);
    
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * Verifies a complete claim request
 * 
 * This function performs all security checks:
 * - Signature validity
 * - Wallet authorization
 * - Expiration check
 * 
 * @param request - The claim request from the client
 * @returns Verification result with details
 */
export interface ClaimVerificationResult {
  valid: boolean;
  signer?: string;
  error?: string;
  errorCode?: string;
}

export function verifyClaimRequest(request: ClaimRequest): ClaimVerificationResult {
  try {
    // 1. Check expiration first (with 30-second clock drift tolerance)
    const now = Math.floor(Date.now() / 1000);
    const clockDriftTolerance = 30; // seconds
    
    if (request.payload.expiresAt < (now - clockDriftTolerance)) {
      return {
        valid: false,
        error: 'Claim signature has expired',
        errorCode: 'SIGNATURE_EXPIRED',
      };
    }

    // 2. Verify signature and recover signer
    const signer = verifyClaimSignature(request.payload, request.signature);

    // 3. Verify the signer matches the claim wallet
    const expectedWallet = ethers.getAddress(request.payload.wallet);
    if (signer.toLowerCase() !== expectedWallet.toLowerCase()) {
      return {
        valid: false,
        error: 'Signature not from authorized wallet',
        errorCode: 'UNAUTHORIZED_WALLET',
      };
    }

    // 4. Validate amount format (must be positive)
    const amount = BigInt(request.payload.amount);
    if (amount <= 0n) {
      return {
        valid: false,
        error: 'Invalid claim amount',
        errorCode: 'INVALID_AMOUNT',
      };
    }

    // All checks passed
    return {
      valid: true,
      signer,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
      errorCode: 'INVALID_SIGNATURE',
    };
  }
}

// =====================================================
// SIGNATURE GENERATION (Server-side only)
// =====================================================

/**
 * Signs a claim payload using a private key
 * 
 * ⚠️ SECURITY WARNING: This should ONLY be called server-side
 * Never expose your signing private key to clients!
 * 
 * @param payload - The claim payload to sign
 * @param signerPrivateKey - The private key to sign with (0x-prefixed hex)
 * @returns The signature as a hex string
 */
export async function signClaimPayload(
  payload: ClaimPayload,
  signerPrivateKey: string
): Promise<string> {
  // Validate payload
  if (!isValidClaimPayload(payload)) {
    throw new Error('Invalid claim payload structure');
  }

  // Validate private key format
  if (!signerPrivateKey || !signerPrivateKey.startsWith('0x')) {
    throw new Error('Invalid private key format (must start with 0x)');
  }

  try {
    // Create wallet from private key
    const wallet = new ethers.Wallet(signerPrivateKey);

    // Normalize payload
    const normalizedPayload = {
      ...payload,
      amount: payload.amount.toString(),
      wallet: ethers.getAddress(payload.wallet),
    };

    // Sign using EIP-712
    const signature = await wallet.signTypedData(
      CLAIM_DOMAIN,
      CLAIM_TYPES,
      normalizedPayload
    );

    return signature;
  } catch (error) {
    throw new Error(`Failed to sign claim: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets the signer address from a private key
 * Useful for verifying your signing setup
 * 
 * @param signerPrivateKey - The private key (0x-prefixed hex)
 * @returns The checksummed Ethereum address
 */
export function getSignerAddress(signerPrivateKey: string): string {
  try {
    const wallet = new ethers.Wallet(signerPrivateKey);
    return wallet.address;
  } catch (error) {
    throw new Error(`Invalid private key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Validates that a wallet address is properly formatted
 * 
 * @param wallet - The wallet address to validate
 * @returns True if valid, false otherwise
 */
export function isValidWalletAddress(wallet: string): boolean {
  if (typeof wallet !== 'string' || !wallet) {
    return false;
  }
  // Must be 40 hex chars (with or without 0x prefix)
  const cleaned = wallet.toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{40}$/.test(cleaned);
}

/**
 * Normalizes a wallet address to checksummed format
 * 
 * @param wallet - The wallet address to normalize
 * @returns Checksummed address
 * @throws Error if address is invalid
 */
export function normalizeWalletAddress(wallet: string): string {
  // Pre-validate to accept non-checksummed addresses
  if (!isValidWalletAddress(wallet)) {
    throw new Error('Invalid wallet address format');
  }
  // getAddress will checksum it or throw if truly invalid
  try {
    return ethers.getAddress(wallet);
  } catch (error) {
    // If it's a valid hex but getAddress fails, return lowercase normalized
    return wallet.toLowerCase();
  }
}

/**
 * Validates that a claim amount is within acceptable bounds
 * 
 * @param amount - The amount to validate (as string or bigint)
 * @param maxAmount - Maximum allowed amount (optional)
 * @returns True if valid, false otherwise
 */
export function isValidClaimAmount(
  amount: string | bigint,
  maxAmount?: string | bigint
): boolean {
  try {
    const amountBN = BigInt(amount);
    
    // Must be positive
    if (amountBN <= 0n) {
      return false;
    }

    // Check max if provided
    if (maxAmount !== undefined) {
      const maxBN = BigInt(maxAmount);
      if (amountBN > maxBN) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a deterministic claim ID from wallet and timestamp
 * Useful for testing or generating predictable IDs
 * 
 * @param wallet - The wallet address
 * @param timestamp - Unix timestamp
 * @returns A deterministic UUID-like string
 */
export function createDeterministicClaimId(
  wallet: string,
  timestamp: number
): string {
  const hash = ethers.keccak256(
    ethers.toUtf8Bytes(`${wallet}-${timestamp}`)
  );
  
  // Format as UUID v4-like string
  return (
    hash.slice(2, 10) + '-' +
    hash.slice(10, 14) + '-' +
    '4' + hash.slice(15, 18) + '-' +
    hash.slice(18, 22) + '-' +
    hash.slice(22, 34)
  );
}

// =====================================================
// TESTING HELPERS
// =====================================================

/**
 * Generates a test private key (deterministic)
 * ⚠️ FOR TESTING ONLY - Never use in production!
 */
export function generateTestPrivateKey(seed: string = 'test'): string {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(seed));
  return hash;
}

/**
 * Creates a test wallet
 * ⚠️ FOR TESTING ONLY - Never use in production!
 */
export function createTestWallet(seed: string = 'test'): ethers.Wallet {
  const privateKey = generateTestPrivateKey(seed);
  return new ethers.Wallet(privateKey);
}
