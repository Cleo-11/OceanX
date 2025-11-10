#!/usr/bin/env node
/**
 * End-to-end test script for sign-only claim flow on Sepolia
 * 
 * This script:
 * 1. Calls POST /marketplace/sign-claim to get a signature
 * 2. Submits the claim transaction on-chain (player pays gas)
 * 3. Calls POST /marketplace/trade/confirm to finalize in DB
 * 
 * Run this with: node test-claim-flow.js
 * Make sure the server is running first: pnpm dev
 */

import { config } from "dotenv";
config(); // Load .env file

import { ethers } from "ethers";
import fetch from "node-fetch";

// Configuration from .env
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
const RPC_URL = process.env.RPC_URL;
const TOKEN_CONTRACT_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS;
const PLAYER_PRIVATE_KEY = process.env.TEST_PLAYER_PRIVATE_KEY;
const OCX_AMOUNT = process.env.TEST_OCX_AMOUNT || "10";

// Simple OCXToken ABI (just the claim function we need)
const TOKEN_ABI = [
  "function claim(uint256 amount, uint256 nonce, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
  "function nonces(address) external view returns (uint256)",
  "event Claimed(address indexed account, uint256 amount)"
];

async function main() {
  console.log("🧪 Starting Sepolia Claim Flow Test\n");

  // Validate environment
  if (!RPC_URL) {
    throw new Error("Missing RPC_URL in .env");
  }
  if (!TOKEN_CONTRACT_ADDRESS) {
    throw new Error("Missing TOKEN_CONTRACT_ADDRESS in .env");
  }
  if (!PLAYER_PRIVATE_KEY) {
    console.error("❌ Missing TEST_PLAYER_PRIVATE_KEY in .env");
    console.log("\nAdd this to server/.env:");
    console.log("TEST_PLAYER_PRIVATE_KEY=0x... (your test wallet private key)\n");
    process.exit(1);
  }

  // Setup provider and player wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const playerWallet = new ethers.Wallet(PLAYER_PRIVATE_KEY, provider);
  const playerAddress = playerWallet.address;

  console.log("📋 Configuration:");
  console.log(`  Backend URL: ${BACKEND_URL}`);
  console.log(`  Player Address: ${playerAddress}`);
  console.log(`  Token Contract: ${TOKEN_CONTRACT_ADDRESS}`);
  console.log(`  OCX Amount: ${OCX_AMOUNT}\n`);

  // Check player balance
  const ethBalance = await provider.getBalance(playerAddress);
  console.log(`💰 Player ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);
  if (ethBalance === 0n) {
    console.warn("⚠️  WARNING: Player has 0 ETH. You need Sepolia ETH to pay gas!\n");
  }

  // STEP 1: Request signature from backend
  console.log("📝 Step 1: Requesting claim signature from backend...");
  
  // Create auth signature in the correct format expected by the server
  const authMessage = `AbyssX claim
Wallet: ${playerAddress}
Timestamp: ${Date.now()}
Network: sepolia`;
  
  const authSignature = await playerWallet.signMessage(authMessage);

  const signResponse = await fetch(`${BACKEND_URL}/marketplace/sign-claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      walletAddress: playerAddress,
      address: playerAddress,
      authMessage: authMessage,
      authSignature: authSignature,
      ocxAmount: OCX_AMOUNT,
      resourceType: "test",
      resourceAmount: 100
    })
  });

  if (!signResponse.ok) {
    const errorText = await signResponse.text();
    throw new Error(`Sign request failed: ${signResponse.status} ${errorText}`);
  }

  const signData = await signResponse.json();
  console.log("✅ Received signature from backend");
  console.log(`   Amount (wei): ${signData.amountWei}`);
  console.log(`   Nonce: ${signData.nonce}`);
  console.log(`   Deadline: ${signData.deadline}`);
  console.log(`   Trade ID: ${signData.tradeId || "(none)"}\n`);

  // STEP 2: Submit claim transaction on-chain
  console.log("⛓️  Step 2: Submitting claim transaction on-chain...");
  
  const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, TOKEN_ABI, playerWallet);
  
  // Verify nonce matches on-chain
  const onChainNonce = await tokenContract.nonces(playerAddress);
  console.log(`   On-chain nonce: ${onChainNonce}`);
  if (onChainNonce.toString() !== signData.nonce.toString()) {
    throw new Error(`Nonce mismatch! Expected ${signData.nonce}, got ${onChainNonce}`);
  }

  // Submit transaction
  const tx = await tokenContract.claim(
    signData.amountWei,
    signData.nonce,
    signData.deadline,
    signData.v,
    signData.r,
    signData.s
  );

  console.log(`📤 Transaction submitted: ${tx.hash}`);
  console.log(`   Waiting for confirmation...`);

  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

  // Parse Claimed event
  const claimedEvent = receipt.logs
    .map(log => {
      try {
        return tokenContract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(log => log && log.name === "Claimed");

  if (claimedEvent) {
    console.log(`🎉 Claimed Event:`);
    console.log(`   Account: ${claimedEvent.args.account}`);
    console.log(`   Amount: ${ethers.formatEther(claimedEvent.args.amount)} OCX\n`);
  }

  // STEP 3: Confirm with backend
  console.log("💾 Step 3: Confirming transaction with backend...");
  
  const confirmResponse = await fetch(`${BACKEND_URL}/marketplace/trade/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      walletAddress: playerAddress,
      address: playerAddress,
      authMessage: authMessage,
      authSignature: authSignature,
      txHash: tx.hash,
      tradeId: signData.tradeId
    })
  });

  if (!confirmResponse.ok) {
    const errorText = await confirmResponse.text();
    console.error(`❌ Confirm request failed: ${confirmResponse.status} ${errorText}`);
  } else {
    const confirmData = await confirmResponse.json();
    console.log("✅ Backend confirmation successful");
    console.log(`   ${JSON.stringify(confirmData, null, 2)}\n`);
  }

  console.log("🎊 Test completed successfully!");
}

main().catch(error => {
  console.error("\n❌ Test failed:", error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
