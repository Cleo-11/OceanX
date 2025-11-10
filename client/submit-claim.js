/**
 * Client script to submit a claim transaction after receiving signature from backend
 * 
 * This script demonstrates the "user pays" flow:
 * 1. Backend generates EIP-712 signature (via POST /marketplace/sign-claim)
 * 2. Client submits OCXToken.claim(...) transaction and pays gas
 * 3. Client posts txHash to backend (via POST /marketplace/trade/confirm)
 * 
 * Usage:
 *   node client/submit-claim.js
 * 
 * Or with parameters:
 *   node client/submit-claim.js <recipient> <amountWei> <nonce> <deadline> <signature> <playerPrivateKey>
 * 
 * Environment variables required:
 *   RPC_URL - Ethereum RPC endpoint
 *   TOKEN_CONTRACT_ADDRESS - Deployed OCXToken address
 *   PLAYER_PRIVATE_KEY (optional if passed as arg)
 */

require('dotenv').config({ path: '../server/.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load token ABI
const abiPath = path.join(__dirname, '../server/abis/OCXToken.json');
if (!fs.existsSync(abiPath)) {
  console.error('❌ OCXToken ABI not found at:', abiPath);
  process.exit(1);
}
const tokenAbi = JSON.parse(fs.readFileSync(abiPath, 'utf8')).abi;

async function main() {
  console.log('\n=== OCXToken Claim Submission (User Pays Gas) ===\n');

  // Parse arguments
  const args = process.argv.slice(2);
  
  let recipient, amountWei, nonce, deadline, signature, playerPrivateKey;

  if (args.length >= 6) {
    // All args provided
    [recipient, amountWei, nonce, deadline, signature, playerPrivateKey] = args;
  } else if (args.length === 0) {
    // Interactive mode - user provides data from backend response
    console.log('Usage: node client/submit-claim.js <recipient> <amountWei> <nonce> <deadline> <signature> <playerPrivateKey>');
    console.log('\nExample:');
    console.log('  node client/submit-claim.js \\');
    console.log('    0x5711b49b29680c1eabb3e3eb6c191d4db70c853c \\');
    console.log('    1000000000000000000 \\');
    console.log('    0 \\');
    console.log('    1699999999 \\');
    console.log('    0x1234... \\');
    console.log('    0xabcd...');
    console.log('\nOr set PLAYER_PRIVATE_KEY in .env and omit last parameter\n');
    process.exit(0);
  } else {
    console.error('❌ Invalid number of arguments');
    console.log('Provide either all 6 args or none (for help)');
    process.exit(1);
  }

  // Use env var if private key not provided
  playerPrivateKey = playerPrivateKey || process.env.PLAYER_PRIVATE_KEY;

  if (!playerPrivateKey) {
    console.error('❌ Player private key not provided (arg or PLAYER_PRIVATE_KEY env var)');
    process.exit(1);
  }

  // Validate environment
  if (!process.env.RPC_URL || !process.env.TOKEN_CONTRACT_ADDRESS) {
    console.error('❌ Missing environment variables: RPC_URL, TOKEN_CONTRACT_ADDRESS');
    console.error('   Make sure server/.env is configured');
    process.exit(1);
  }

  console.log('📋 Configuration:');
  console.log('   RPC:', process.env.RPC_URL);
  console.log('   Token Contract:', process.env.TOKEN_CONTRACT_ADDRESS);
  console.log('   Recipient:', recipient);
  console.log('   Amount (wei):', amountWei);
  console.log('   Amount (OCX):', ethers.formatEther(amountWei));
  console.log('   Nonce:', nonce);
  console.log('   Deadline:', deadline, `(${new Date(parseInt(deadline) * 1000).toISOString()})`);
  console.log('   Signature:', signature.slice(0, 20) + '...');
  console.log('');

  try {
    // Connect to network
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const playerWallet = new ethers.Wallet(playerPrivateKey, provider);
    
    console.log(`🔑 Player wallet: ${playerWallet.address}`);

    // Check recipient matches player (should be the same in user-pays flow)
    if (playerWallet.address.toLowerCase() !== recipient.toLowerCase()) {
      console.warn(`⚠️  WARNING: Recipient (${recipient}) != Player wallet (${playerWallet.address})`);
      console.warn('   This will likely fail because contract checks msg.sender == account');
    }

    // Check player has enough ETH for gas
    const balance = await provider.getBalance(playerWallet.address);
    console.log(`💰 Player balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === 0n) {
      console.error('❌ Player has no ETH for gas!');
      process.exit(1);
    }

    // Create contract instance
    const token = new ethers.Contract(
      process.env.TOKEN_CONTRACT_ADDRESS,
      tokenAbi,
      playerWallet
    );

    // Split signature into v, r, s
    const sig = ethers.Signature.from(signature);
    const { v, r, s } = sig;

    console.log('🔑 Signature components:');
    console.log('   v:', v);
    console.log('   r:', r);
    console.log('   s:', s);
    console.log('');

    // Verify nonce matches on-chain (optional sanity check)
    const onChainNonce = await token.nonces(recipient);
    if (onChainNonce.toString() !== nonce) {
      console.error(`❌ Nonce mismatch! On-chain: ${onChainNonce}, signature: ${nonce}`);
      console.error('   Someone may have claimed already, or signature is stale');
      process.exit(1);
    }

    console.log('✅ Nonce verified');

    // Call claim function
    console.log('⛓️  Submitting claim transaction...');
    console.log('   This will require user approval and gas payment');
    console.log('');

    const tx = await token.claim(
      BigInt(amountWei),
      BigInt(nonce),
      BigInt(deadline),
      v,
      r,
      s,
      {
        gasLimit: 300000 // Set reasonable gas limit
      }
    );

    console.log('✅ Transaction submitted!');
    console.log('   TX Hash:', tx.hash);
    console.log('   Waiting for confirmation...');
    console.log('');

    const receipt = await tx.wait();

    console.log('✅ Transaction confirmed!');
    console.log('   Block:', receipt.blockNumber);
    console.log('   Gas used:', receipt.gasUsed.toString());
    console.log('   Status:', receipt.status === 1 ? 'Success ✅' : 'Failed ❌');
    console.log('');

    if (receipt.status !== 1) {
      console.error('❌ Transaction failed on-chain');
      process.exit(1);
    }

    // Parse logs to verify Claimed event
    const iface = new ethers.Interface(tokenAbi);
    let claimedEvent = null;

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === 'Claimed') {
          claimedEvent = parsed.args;
          break;
        }
      } catch (e) {
        // Not a Claimed event
      }
    }

    if (claimedEvent) {
      console.log('📊 Claimed Event:');
      console.log('   Account:', claimedEvent.account);
      console.log('   Amount:', ethers.formatEther(claimedEvent.amount), 'OCX');
      console.log('   Nonce:', claimedEvent.nonce.toString());
      console.log('');
    }

    // Check new balance
    const newBalance = await token.balanceOf(recipient);
    console.log('💰 New token balance:', ethers.formatEther(newBalance), 'OCX');
    console.log('');

    // Generate explorer link
    const chainId = (await provider.getNetwork()).chainId;
    let explorerUrl;
    if (chainId === 11155111n) {
      explorerUrl = `https://sepolia.etherscan.io/tx/${tx.hash}`;
    } else if (chainId === 84532n) {
      explorerUrl = `https://sepolia.basescan.org/tx/${tx.hash}`;
    } else if (chainId === 8453n) {
      explorerUrl = `https://basescan.org/tx/${tx.hash}`;
    } else if (chainId === 1n) {
      explorerUrl = `https://etherscan.io/tx/${tx.hash}`;
    } else {
      explorerUrl = `Chain ${chainId}: ${tx.hash}`;
    }

    console.log('🔗 View on explorer:');
    console.log('   ' + explorerUrl);
    console.log('');

    console.log('✅ SUCCESS! Claim completed.');
    console.log('');
    console.log('📌 Next step: POST txHash to backend confirmation endpoint');
    console.log('   POST /marketplace/trade/confirm');
    console.log('   Body: { "txHash": "' + tx.hash + '", "tradeId": "..." }');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.error('   Player wallet needs more ETH for gas');
    } else if (error.message.includes('Invalid signature')) {
      console.error('   Signature verification failed - check backend signer');
    } else if (error.message.includes('Invalid nonce')) {
      console.error('   Nonce mismatch - may have already claimed');
    } else if (error.message.includes('Signature expired')) {
      console.error('   Deadline passed - request new signature');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('\nFull error:');
      console.error(error);
    }

    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
