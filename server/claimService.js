const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load game ABI
let gameAbi;
try {
  const gameAbiPath = path.join(__dirname, "./abis/OceanGameController.json");
  if (fs.existsSync(gameAbiPath)) {
    const gameAbiData = fs.readFileSync(gameAbiPath, "utf8");
    gameAbi = JSON.parse(gameAbiData);
    console.log("✅ Game ABI loaded successfully");
  } else {
    throw new Error("ABI file not found");
  }
} catch (error) {
  console.error("⚠️ Failed to load game ABI, using fallback:", error.message);
  // Fallback: use a minimal ABI if the file doesn't exist
  gameAbi = {
    abi: [
      {
        "inputs": [
          { "internalType": "address", "name": "user", "type": "address" },
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "bytes", "name": "signature", "type": "bytes" }
        ],
        "name": "claim",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ]
  };
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const backendSigner = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);

const gameContract = new ethers.Contract(
  process.env.GAME_CONTRACT_ADDRESS,
  gameAbi.abi,
  backendSigner
);

async function claimTokens(userAddress, amount, signature) {
  try {
    // Calls the claim function on the contract
    const tx = await gameContract.claim(userAddress, amount, signature);
    await tx.wait();
    return tx.hash;
  } catch (error) {
    console.error("Contract claim error:", error);
    throw error;
  }
}

module.exports = { claimTokens };