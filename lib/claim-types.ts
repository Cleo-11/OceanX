/**
 * Secure Claim System Types
 * 
 * These types define the structure for the server-authoritative,
 * replay-proof token claim system.
 */

// =====================================================
// EIP-712 DOMAIN AND TYPE DEFINITIONS
// =====================================================

/**
 * EIP-712 Domain for signature verification
 * This ensures signatures are bound to your specific application
 */
export const CLAIM_DOMAIN = {
  name: 'OceanX Token Claims',
  version: '1',
  chainId: 1, // Update to your chain ID (1 = mainnet, 11155111 = sepolia, etc.)
  // verifyingContract: '0x...', // Optional: your contract address
} as const;

/**
 * EIP-712 typed data structure for claims
 * This defines what data is signed and in what format
 */
export const CLAIM_TYPES = {
  Claim: [
    { name: 'claimId', type: 'string' },
    { name: 'wallet', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
  ],
};

// =====================================================
// DATABASE TYPES
// =====================================================

/**
 * Database row structure for claim_signatures table
 */
export interface ClaimSignatureRow {
  claim_id: string;
  wallet: string;
  amount: string; // Stored as numeric in DB, string in JS for precision
  expires_at: number; // Unix timestamp in seconds
  used: boolean;
  used_at: Date | null;
  created_at: Date;
  claim_type: string | null;
  metadata: Record<string, any>;
}

/**
 * Input for creating a new claim signature (server-side)
 */
export interface CreateClaimSignatureInput {
  wallet: string;
  amount: string | number | bigint;
  expiresInSeconds?: number; // Default: 300 (5 minutes)
  claimType?: string;
  metadata?: Record<string, any>;
}

// =====================================================
// CLAIM PAYLOAD TYPES
// =====================================================

/**
 * The structured data that gets signed (EIP-712 message)
 * This is what the server generates and signs
 */
export interface ClaimPayload {
  claimId: string; // UUID from database
  wallet: string; // Ethereum address (checksummed)
  amount: string; // Token amount as string (supports big numbers)
  expiresAt: number; // Unix timestamp in seconds
}

/**
 * The complete claim request sent by the client
 * Contains both the payload and the signature
 */
export interface ClaimRequest {
  payload: ClaimPayload;
  signature: string; // Hex string of the signature
}

// =====================================================
// RESPONSE TYPES
// =====================================================

/**
 * Successful claim response
 */
export interface ClaimSuccessResponse {
  success: true;
  claimId: string;
  wallet: string;
  amount: string;
  newBalance: string;
  transactionId?: string; // Optional: if you track transactions
  claimedAt: string; // ISO timestamp
}

/**
 * Claim error response
 */
export interface ClaimErrorResponse {
  success: false;
  error: string;
  code: ClaimErrorCode;
  details?: any;
}

/**
 * Union type for all claim responses
 */
export type ClaimResponse = ClaimSuccessResponse | ClaimErrorResponse;

// =====================================================
// ERROR CODES
// =====================================================

/**
 * Specific error codes for claim failures
 * Use these for client-side error handling
 */
export enum ClaimErrorCode {
  // Validation errors
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_WALLET = 'INVALID_WALLET',
  
  // Authorization errors
  UNAUTHORIZED_WALLET = 'UNAUTHORIZED_WALLET',
  SIGNATURE_EXPIRED = 'SIGNATURE_EXPIRED',
  
  // Replay/reuse errors
  CLAIM_ALREADY_USED = 'CLAIM_ALREADY_USED',
  CLAIM_NOT_FOUND = 'CLAIM_NOT_FOUND',
  
  // Amount verification errors
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  AMOUNT_EXCEEDS_LIMIT = 'AMOUNT_EXCEEDS_LIMIT',
  
  // Server errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  
  // Rate limiting
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
}

// =====================================================
// CLAIM CALCULATION TYPES
// =====================================================

/**
 * Parameters for calculating claim amounts server-side
 * Customize this based on your game's economy
 */
export interface ClaimCalculationContext {
  wallet: string;
  claimType: string;
  lastClaimTime?: Date;
  playerLevel?: number;
  miningPower?: number;
  // Add any other factors that affect claim amounts
}

/**
 * Result of server-side claim amount calculation
 */
export interface ClaimCalculationResult {
  amount: string;
  reason: string;
  metadata?: Record<string, any>;
}

// =====================================================
// SIGNATURE GENERATION TYPES (Server-side only)
// =====================================================

/**
 * Input for generating a claim signature (admin/server use only)
 */
export interface GenerateClaimSignatureInput {
  wallet: string;
  calculationContext: ClaimCalculationContext;
  expiresInSeconds?: number;
}

/**
 * Output from signature generation
 */
export interface GenerateClaimSignatureOutput {
  claimId: string;
  payload: ClaimPayload;
  signature: string;
  expiresAt: number;
}

// =====================================================
// AUDIT LOG TYPES
// =====================================================

/**
 * Audit log entry for claim attempts
 */
export interface ClaimAuditLog {
  timestamp: Date;
  claimId: string | null;
  wallet: string;
  amount: string;
  success: boolean;
  errorCode?: ClaimErrorCode;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

// =====================================================
// VALIDATION HELPERS
// =====================================================

/**
 * Type guard for ClaimRequest
 */
export function isValidClaimRequest(data: any): data is ClaimRequest {
  return (
    data &&
    typeof data === 'object' &&
    data.payload &&
    typeof data.payload === 'object' &&
    typeof data.payload.claimId === 'string' &&
    typeof data.payload.wallet === 'string' &&
    (typeof data.payload.amount === 'string' || typeof data.payload.amount === 'number') &&
    typeof data.payload.expiresAt === 'number' &&
    typeof data.signature === 'string'
  );
}

/**
 * Type guard for ClaimPayload
 */
export function isValidClaimPayload(data: any): data is ClaimPayload {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.claimId === 'string' &&
    typeof data.wallet === 'string' &&
    (typeof data.amount === 'string' || typeof data.amount === 'number') &&
    typeof data.expiresAt === 'number'
  );
}
