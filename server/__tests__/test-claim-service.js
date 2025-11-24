/**
 * Test script for OCXToken claim service
 * 
 * This script validates that the claim service can:
 * 1. Load the OCXToken ABI correctly
 * 2. Connect to the blockchain via RPC
 * 3. Generate valid EIP-712 signatures
 * 4. Split signatures correctly
 * 5. Call the contract claim function
 * 
 * Usage:
 *   node test-claim-service.js <testWalletAddress> <amountInOCX>
 * 
 * Example:
 *   node test-claim-service.js 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 100
 * 
 * Prerequisites:
 *   - All required environment variables must be set (RPC_URL, TOKEN_CONTRACT_ADDRESS, etc.)
 *   - The contract must be deployed at TOKEN_CONTRACT_ADDRESS
 *   - The backend wallet must have been set as authorizedSigner in the contract
 *   - The contract must have sufficient balance to fulfill the claim
 */

require('dotenv').config();
const { ethers } = require('ethers');
const claimService = require('./claimService');

async function main() {
  console.log('\n=== OCXToken Claim Service Test ===\n');

  // Validate environment variables
  const requiredEnvVars = ['RPC_URL', 'TOKEN_CONTRACT_ADDRESS', 'BACKEND_PRIVATE_KEY', 'CHAIN_ID'];
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('\nPlease set these in your .env file. See .env.example for reference.');
    process.exit(1);
  }

  console.log('✅ Environment variables loaded');
  console.log('   RPC_URL:', process.env.RPC_URL);
  console.log('   CHAIN_ID:', process.env.CHAIN_ID);
  console.log('   TOKEN_CONTRACT_ADDRESS:', process.env.TOKEN_CONTRACT_ADDRESS);
  console.log('');

  // Parse command line arguments
  const testWallet = process.argv[2];
  const ocxAmount = process.argv[3];

  if (!testWallet || !ocxAmount) {
    console.error('❌ Usage: node test-claim-service.js <walletAddress> <amountInOCX>');
    console.error('   Example: node test-claim-service.js 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 100');
    process.exit(1);
  }

  // Validate wallet address
  try {
    ethers.getAddress(testWallet);
  } catch (e) {
    console.error('❌ Invalid wallet address:', testWallet);
    process.exit(1);
  }

  // Convert OCX to wei
  const ocxAmountParsed = parseFloat(ocxAmount);
  if (isNaN(ocxAmountParsed) || ocxAmountParsed <= 0) {
    console.error('❌ Invalid OCX amount. Must be a positive number.');
    process.exit(1);
  }

  const amountWei = ethers.parseEther(ocxAmount);

  console.log(`📋 Test Parameters:`);
  console.log(`   Recipient: ${testWallet}`);
  console.log(`   Amount: ${ocxAmount} OCX (${amountWei.toString()} wei)`);
  console.log('');

  // Check backend signer address
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const backendWallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
  
  console.log(`🔑 Backend Signer: ${backendWallet.address}`);
  console.log('');

  try {
    // Attempt to call the claim service
    console.log('🚀 Calling claimTokens...\n');
    const result = await claimService.claimTokens(testWallet, amountWei.toString());

    console.log('\n✅ Claim successful!');
    console.log('   Transaction Hash:', result.txHash);
    console.log('   Block Number:', result.receipt.blockNumber);
    console.log('   Gas Used:', result.receipt.gasUsed.toString());
    console.log('');
    console.log('🔗 View on block explorer:');
    
    // Generate explorer link based on chain ID
    const chainId = parseInt(process.env.CHAIN_ID);
    let explorerUrl;
    if (chainId === 84532) {
      explorerUrl = `https://sepolia.basescan.org/tx/${result.txHash}`;
    } else if (chainId === 8453) {
      explorerUrl = `https://basescan.org/tx/${result.txHash}`;
    } else if (chainId === 11155111) {
      explorerUrl = `https://sepolia.etherscan.io/tx/${result.txHash}`;
    } else {
      explorerUrl = `Transaction hash: ${result.txHash}`;
    }
    console.log(`   ${explorerUrl}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Claim failed!');
    console.error('   Error:', error.message);
    
    if (error.message.includes('Insufficient claimable balance')) {
      console.error('\n💡 The contract does not have enough tokens. Check the contract balance.');
    } else if (error.message.includes('Invalid signature')) {
      console.error('\n💡 The backend signer is not the authorized signer for this contract.');
      console.error('   Make sure BACKEND_PRIVATE_KEY matches the authorizedSigner set during deployment.');
    } else if (error.message.includes('Invalid nonce')) {
      console.error('\n💡 Nonce mismatch. This could indicate a previous failed transaction.');
    } else if (error.message.includes('network')) {
      console.error('\n💡 Network connection issue. Check your RPC_URL.');
    }
    
    console.error('\nFull error details:');
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);
