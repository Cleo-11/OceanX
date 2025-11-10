import { ethers } from "ethers";
import fs from "fs";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL;
const TOKEN_ADDRESS = process.env.TOKEN_CONTRACT_ADDRESS;
const PLAYER_ADDRESS = process.env.TEST_PLAYER_PRIVATE_KEY 
  ? new ethers.Wallet(process.env.TEST_PLAYER_PRIVATE_KEY).address 
  : "0x5711B49b29680c1eabB3E3eb6c191d4DB70C853c";

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const abiJson = JSON.parse(fs.readFileSync("abis/OCXToken.json", "utf8"));
  const contract = new ethers.Contract(TOKEN_ADDRESS, abiJson.abi, provider);

  console.log("🪙 OCX Token Balance Check\n");
  console.log(`📋 Token Contract: ${TOKEN_ADDRESS}`);
  console.log(`👤 Your Wallet: ${PLAYER_ADDRESS}\n`);

  const balance = await contract.balanceOf(PLAYER_ADDRESS);

  console.log(`Token: OceanX Token (OCX)`);
  console.log(`Decimals: 18`);
  console.log(`\n💰 Your Balance: ${ethers.formatEther(balance)} OCX\n`);

  console.log("📱 To add to MetaMask:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Open MetaMask and switch to Sepolia network");
  console.log("2. Click on 'Tokens' tab at the bottom");
  console.log("3. Scroll down and click '+ Import tokens'");
  console.log(`4. Paste this address: ${TOKEN_ADDRESS}`);
  console.log("5. Symbol and decimals should auto-fill");
  console.log("6. Click 'Add Custom Token', then 'Import Tokens'");
  console.log("\nYour OCX balance should then appear in MetaMask! 🎉");
}

checkBalance().catch(console.error);
