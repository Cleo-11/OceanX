#!/usr/bin/env node
/**
 * Diagnostic script to verify EIP-712 signature matches what contract expects
 */

import { config } from "dotenv";
config();

import { ethers } from "ethers";

const DOMAIN = {
  name: "OCXToken",
  version: "1",
  chainId: 11155111, // Sepolia
  verifyingContract: process.env.TOKEN_CONTRACT_ADDRESS,
};

const CLAIM_TYPES = {
  Claim: [
    { name: "account", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

async function main() {
  console.log("🧪 Testing EIP-712 Signature Generation\n");

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const backendWallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
  const playerAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

  console.log(`Backend Signer: ${backendWallet.address}`);
  console.log(`Player Address: ${playerAddress}`);
  console.log(`Contract: ${DOMAIN.verifyingContract}\n`);

  const message = {
    account: playerAddress,
    amount: "10000000000000000000",
    nonce: "0",
    deadline: "1762774178",
  };

  console.log("Message to sign:", message);
  console.log("\nDomain:", DOMAIN);

  const signature = await backendWallet.signTypedData(DOMAIN, CLAIM_TYPES, message);
  console.log(`\n✅ Generated signature: ${signature}`);

  const sig = ethers.Signature.from(signature);
  console.log(`   v=${sig.v}, r=${sig.r}, s=${sig.s}`);

  // Verify signature recovery
  const digest = ethers.TypedDataEncoder.hash(DOMAIN, CLAIM_TYPES, message);
  console.log(`\n📝 EIP-712 digest: ${digest}`);

  const recovered = ethers.recoverAddress(digest, signature);
  console.log(`\n🔍 Recovered signer: ${recovered}`);
  console.log(`   Expected: ${backendWallet.address}`);
  console.log(`   Match: ${recovered.toLowerCase() === backendWallet.address.toLowerCase()}`);
}

main().catch(console.error);
