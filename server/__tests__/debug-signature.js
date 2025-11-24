#!/usr/bin/env node
/**
 * Debug script - manually verify signature step-by-step
 */

import { config } from "dotenv";
config();

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const RPC_URL = process.env.RPC_URL;
const TOKEN_CONTRACT_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS;
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;
const PLAYER_ADDRESS = "0x5711B49b29680c1eabB3E3eb6c191d4DB70C853c";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tokenAbiPath = path.join(__dirname, "abis", "OCXToken.json");
const tokenAbi = JSON.parse(fs.readFileSync(tokenAbiPath, "utf8"));

const DOMAIN = {
  name: "OCXToken",
  version: "1",
  chainId: 11155111,
  verifyingContract: TOKEN_CONTRACT_ADDRESS,
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
  console.log("🔍 Debugging EIP-712 Signature\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const backendWallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, tokenAbi.abi, provider);

  console.log(`Player: ${PLAYER_ADDRESS}`);
  console.log(`Backend Signer: ${backendWallet.address}`);
  console.log(`Contract Authorized Signer: ${await contract.authorizedSigner()}`);
  console.log(`Contract Chain ID: ${(await provider.getNetwork()).chainId}\n`);

  // Get nonce
  const nonce = await contract.nonces(PLAYER_ADDRESS);
  // Use configurable expiry if provided (seconds). Default to 5 minutes (300s).
  const expiry = Number(process.env.CLAIM_SIGNATURE_EXPIRY_SEC ?? process.env.CLAIM_EXPIRY_SEC ?? 300);
  const deadline = Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(expiry));
  const amount = ethers.parseEther("10");

  const message = {
    account: PLAYER_ADDRESS,
    amount: amount.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  };

  console.log("📝 Message:", message);
  console.log("\n📝 Domain:", DOMAIN);

  // Generate signature
  const signature = await backendWallet.signTypedData(DOMAIN, CLAIM_TYPES, message);
  console.log(`\n✅ Signature: ${signature}`);

  const sig = ethers.Signature.from(signature);
  console.log(`   v=${sig.v}, r=${sig.r}, s=${sig.s}`);

  // Compute digest
  const digest = ethers.TypedDataEncoder.hash(DOMAIN, CLAIM_TYPES, message);
  console.log(`\n📋 EIP-712 Digest: ${digest}`);

  // Recover signer
  const recovered = ethers.recoverAddress(digest, signature);
  console.log(`\n🔍 Recovered Signer: ${recovered}`);
  console.log(`   Expected: ${backendWallet.address}`);
  console.log(`   Match: ${recovered.toLowerCase() === backendWallet.address.toLowerCase() ? '✅' : '❌'}`);

  // Now try what the contract does
  console.log("\n🔬 Simulating Contract Verification:");
  console.log(`   msg.sender would be: ${PLAYER_ADDRESS}`);
  
  // The contract computes: keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, amount, nonce, deadline))
  const CLAIM_TYPEHASH = ethers.id("Claim(address account,uint256 amount,uint256 nonce,uint256 deadline)");
  console.log(`   CLAIM_TYPEHASH: ${CLAIM_TYPEHASH}`);
  
  const structHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256", "uint256", "uint256"],
      [CLAIM_TYPEHASH, PLAYER_ADDRESS, amount, nonce, deadline]
    )
  );
  console.log(`   structHash: ${structHash}`);
  
  // Then _hashTypedDataV4(structHash)
  const domainSeparator = ethers.TypedDataEncoder.hashDomain(DOMAIN);
  console.log(`   domainSeparator: ${domainSeparator}`);
  
  const contractDigest = ethers.keccak256(
    ethers.concat([
      "0x1901",
      domainSeparator,
      structHash
    ])
  );
  console.log(`   contractDigest: ${contractDigest}`);
  console.log(`   Matches our digest: ${contractDigest === digest ? '✅' : '❌'}`);
}

main().catch(console.error);
