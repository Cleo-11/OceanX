#!/usr/bin/env node
/**
 * Claim Signature Generator
 * 
 * This is a server-side script for generating secure claim signatures.
 * 
 * ⚠️ CRITICAL SECURITY WARNINGS:
 * 1. This script must ONLY run on your backend server
 * 2. NEVER expose the CLAIM_SIGNER_PRIVATE_KEY to clients
 * 3. NEVER commit the private key to version control
 * 4. Use environment variables for the private key
 * 
 * Usage:
 *   node scripts/generate-claim-signature.js <wallet> <amount> [claimType] [expiresInSeconds]
 * 
 * Example:
 *   node scripts/generate-claim-signature.js 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 1000000000000000000 daily_reward 300
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// =====================================================
// CONFIGURATION
// =====================================================

const CLAIM_SIGNER_PRIVATE_KEY = process.env.CLAIM_SIGNER_PRIVATE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!CLAIM_SIGNER_PRIVATE_KEY) {
  console.error('❌ Error: CLAIM_SIGNER_PRIVATE_KEY not set in environment');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// EIP-712 Domain
const CLAIM_DOMAIN = {
  name: 'OceanX Token Claims',
  version: '1',
  chainId: 1, // Update to match your chain
};

// EIP-712 Types
const CLAIM_TYPES = {
  Claim: [
    { name: 'claimId', type: 'string' },
    { name: 'wallet', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
  ],
};

// =====================================================
// MAIN FUNCTION
// =====================================================

interface GenerateClaimOptions {
  wallet: string;
  amount: string;
  claimType?: string;
  expiresInSeconds?: number;
  metadata?: Record<string, any>;
}

async function generateClaimSignature(options: GenerateClaimOptions) {
  const {
    wallet,
    amount,
    claimType = 'manual',
    expiresInSeconds = 300, // 5 minutes default
    metadata = {},
  } = options;

  console.log('\n🔐 Generating Claim Signature...\n');

  try {
    // 1. Validate inputs
    console.log('📋 Validating inputs...');
    
    const normalizedWallet = ethers.getAddress(wallet);
    const amountBN = BigInt(amount);
    
    if (amountBN <= 0n) {
      throw new Error('Amount must be positive');
    }

    console.log(`   ✓ Wallet: ${normalizedWallet}`);
    console.log(`   ✓ Amount: ${amount}`);
    console.log(`   ✓ Claim Type: ${claimType}`);
    console.log(`   ✓ Expires In: ${expiresInSeconds}s`);

    // 2. Create claim signature record in database
    console.log('\n💾 Creating claim signature in database...');
    
    const { data: dbData, error: dbError } = await supabase.rpc(
      'create_claim_signature',
      {
        p_wallet: normalizedWallet.toLowerCase(),
        p_amount: amount,
        p_expires_in_seconds: expiresInSeconds,
        p_claim_type: claimType,
        p_metadata: metadata,
      }
    );

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    const claimId = dbData;
    console.log(`   ✓ Claim ID: ${claimId}`);

    // 3. Fetch the created record to get expiration timestamp
    const { data: claimRecord, error: fetchError } = await supabase
      .from('claim_signatures')
      .select('*')
      .eq('claim_id', claimId)
      .single();

    if (fetchError || !claimRecord) {
      throw new Error('Failed to fetch created claim signature');
    }

    const expiresAt = claimRecord.expires_at;
    console.log(`   ✓ Expires At: ${new Date(expiresAt * 1000).toISOString()}`);

    // 4. Create the payload to sign
    const payload = {
      claimId: claimId,
      wallet: normalizedWallet,
      amount: amount,
      expiresAt: expiresAt,
    };

    console.log('\n✍️  Signing payload with EIP-712...');

    // 5. Sign the payload
    const wallet_signer = new ethers.Wallet(CLAIM_SIGNER_PRIVATE_KEY);
    const signature = await wallet_signer.signTypedData(
      CLAIM_DOMAIN,
      CLAIM_TYPES,
      payload
    );

    console.log(`   ✓ Signature: ${signature}`);
    console.log(`   ✓ Signer Address: ${wallet_signer.address}`);

    // 6. Verify the signature (sanity check)
    console.log('\n🔍 Verifying signature...');
    
    const recoveredAddress = ethers.verifyTypedData(
      CLAIM_DOMAIN,
      CLAIM_TYPES,
      payload,
      signature
    );

    if (recoveredAddress.toLowerCase() !== wallet_signer.address.toLowerCase()) {
      throw new Error('Signature verification failed!');
    }

    console.log('   ✓ Signature verified successfully');

    // 7. Output the complete claim request
    console.log('\n' + '='.repeat(60));
    console.log('✅ CLAIM SIGNATURE GENERATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📦 Complete Claim Request (send this to client):\n');

    const claimRequest = {
      payload,
      signature,
    };

    console.log(JSON.stringify(claimRequest, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('📝 cURL Example:\n');
    console.log(`curl -X POST http://localhost:3000/api/claim \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(claimRequest)}'`);

    console.log('\n' + '='.repeat(60));
    console.log('📝 JavaScript Example:\n');
    console.log(`const response = await fetch('/api/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${JSON.stringify(claimRequest, null, 2)})
});

const result = await response.json();
console.log(result);`);

    console.log('\n' + '='.repeat(60) + '\n');

    return claimRequest;
  } catch (error) {
    console.error('\n❌ Error generating claim signature:', error);
    throw error;
  }
}

// =====================================================
// CLI INTERFACE
// =====================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage: node generate-claim-signature.js <wallet> <amount> [claimType] [expiresInSeconds]

Arguments:
  wallet            - The wallet address authorized to use this claim
  amount            - The token amount (in smallest unit, e.g., wei)
  claimType         - Optional: Type of claim (default: "manual")
  expiresInSeconds  - Optional: Expiration time in seconds (default: 300)

Examples:
  # Generate a claim for 1 token (18 decimals) that expires in 5 minutes
  node generate-claim-signature.js 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 1000000000000000000

  # Generate a daily reward claim that expires in 1 hour
  node generate-claim-signature.js 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 5000000000000000000 daily_reward 3600

  # Generate a mining payout claim
  node generate-claim-signature.js 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 250000000000000000 mining_payout 600

Environment Variables Required:
  CLAIM_SIGNER_PRIVATE_KEY     - Private key for signing claims (0x-prefixed)
  NEXT_PUBLIC_SUPABASE_URL     - Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    - Supabase service role key
`);
    process.exit(1);
  }

  const [wallet, amount, claimType, expiresInSeconds] = args;

  await generateClaimSignature({
    wallet,
    amount,
    claimType: claimType || 'manual',
    expiresInSeconds: expiresInSeconds ? parseInt(expiresInSeconds) : 300,
  });
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for use as a module
export { generateClaimSignature };
