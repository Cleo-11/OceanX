#!/usr/bin/env node
/**
 * Script to verify smart contract deployments and configurations
 * Run with: node scripts/verify-contracts.js
 */

const { ethers } = require("ethers");
require("dotenv").config();

// Contract addresses (from your .env or hardcoded)
const CONTRACTS = {
  OCEAN_X_TOKEN: process.env.NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS || "0x7082bd37ea9552faf0549abb868602135aada705",
  UPGRADE_MANAGER: process.env.NEXT_PUBLIC_UPGRADE_MANAGER_ADDRESS || "0xb8ca16e41aac1e17dc5ddd22c5f20b35860f9a0c",
  GAME_CONTROLLER: process.env.GAME_CONTRACT_ADDRESS,
};

const RPC_URL = process.env.RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY";

async function verifyContracts() {
  console.log("🔍 Verifying Contract Deployments...\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  for (const [name, address] of Object.entries(CONTRACTS)) {
    if (!address) {
      console.log(`⚠️  ${name}: NOT CONFIGURED`);
      continue;
    }

    console.log(`📝 ${name}: ${address}`);

    try {
      // Check if contract exists
      const code = await provider.getCode(address);
      
      if (code === "0x") {
        console.log(`   ❌ CONTRACT NOT DEPLOYED - No code at this address\n`);
        continue;
      }

      console.log(`   ✅ Contract deployed (${code.length} bytes)`);

      // Try to verify it's the correct contract type
      if (name === "OCEAN_X_TOKEN") {
        const token = new ethers.Contract(
          address,
          ["function name() view returns (string)", "function symbol() view returns (string)"],
          provider
        );
        try {
          const tokenName = await token.name();
          const symbol = await token.symbol();
          console.log(`   ℹ️  Token: ${tokenName} (${symbol})`);
        } catch (err) {
          console.log(`   ⚠️  Could not read token info - may not be ERC20`);
        }
      }

      if (name === "UPGRADE_MANAGER") {
        const upgradeManager = new ethers.Contract(
          address,
          [
            "function getCurrentTier(address) view returns (uint256)",
            "function MAX_TIER() view returns (uint256)"
          ],
          provider
        );
        try {
          const maxTier = await upgradeManager.MAX_TIER();
          console.log(`   ℹ️  Max Tier: ${maxTier}`);
        } catch (err) {
          console.log(`   ⚠️  Could not read upgrade manager info`);
        }
      }

      if (name === "GAME_CONTROLLER") {
        const gameController = new ethers.Contract(
          address,
          ["function backendSigner() view returns (address)"],
          provider
        );
        try {
          const signer = await gameController.backendSigner();
          console.log(`   ℹ️  Backend Signer: ${signer}`);
          
          // Check if configured backend signer matches
          if (process.env.BACKEND_PRIVATE_KEY) {
            const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY);
            if (wallet.address.toLowerCase() === signer.toLowerCase()) {
              console.log(`   ✅ Backend signer matches configured wallet`);
            } else {
              console.log(`   ❌ Backend signer MISMATCH!`);
              console.log(`      Contract expects: ${signer}`);
              console.log(`      You configured: ${wallet.address}`);
            }
          }
        } catch (err) {
          console.log(`   ⚠️  Could not read game controller info`);
        }
      }

      console.log("");
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}\n`);
    }
  }

  console.log("\n✅ Contract verification complete");
}

verifyContracts().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
