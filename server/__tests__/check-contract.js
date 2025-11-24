#!/usr/bin/env node
/**
 * Quick diagnostic script to check the OCXToken contract configuration
 */

import { config } from "dotenv";
config();

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Use file-relative path so script runs regardless of cwd
const RPC_URL = process.env.RPC_URL;
const TOKEN_CONTRACT_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS;
const BACKEND_SIGNER_ADDRESS = process.env.BACKEND_SIGNER_ADDRESS;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tokenAbiPath = path.join(__dirname, "abis", "OCXToken.json");
const tokenAbi = JSON.parse(fs.readFileSync(tokenAbiPath, "utf8"));

async function main() {
  console.log("🔍 Checking OCXToken Contract Configuration\n");
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, tokenAbi.abi, provider);

  console.log(`📋 Contract: ${TOKEN_CONTRACT_ADDRESS}`);
  console.log(`📋 Network: ${(await provider.getNetwork()).name} (chainId: ${(await provider.getNetwork()).chainId})`);
  console.log(`📋 Backend Signer: ${BACKEND_SIGNER_ADDRESS}\n`);

  // Check if contract has an authorizedSigner or similar
  try {
    const authorizedSigner = await contract.authorizedSigner();
    console.log(`✅ Contract authorizedSigner: ${authorizedSigner}`);
    
    if (authorizedSigner.toLowerCase() === BACKEND_SIGNER_ADDRESS.toLowerCase()) {
      console.log("✅ Backend signer matches contract's authorized signer!\n");
    } else {
      console.log("❌ MISMATCH! Backend signer does NOT match contract's authorized signer!");
      console.log(`   Expected: ${authorizedSigner}`);
      console.log(`   Got:      ${BACKEND_SIGNER_ADDRESS}\n`);
    }
  } catch (error) {
    console.log("⚠️  Could not read authorizedSigner from contract");
    console.log(`   Error: ${error.message}\n`);
  }

  // Check contract name and version for EIP-712
  try {
    const name = await contract.name();
    const version = await contract.version?.();
    console.log(`📝 Token name: ${name}`);
    if (version) console.log(`📝 Version: ${version}`);
  } catch (error) {
    console.log(`⚠️  Could not read name/version: ${error.message}`);
  }
}

main().catch(console.error);
