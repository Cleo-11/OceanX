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
          { "internalType": "address", "name": "player", "type": "address" },
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "uint256", "name": "nonce", "type": "uint256" },
          { "internalType": "uint256", "name": "deadline", "type": "uint256" },
          { "internalType": "bytes", "name": "signature", "type": "bytes" }
        ],
        "name": "claimReward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [{ "internalType": "address", "name": "player", "type": "address" }],
        "name": "nonces",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
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

// EIP-712 Domain for OceanGameController
const DOMAIN = {
  name: "OceanGameController",
  version: "1",
  chainId: 11155111, // Sepolia testnet - adjust if using different network
  verifyingContract: process.env.GAME_CONTRACT_ADDRESS,
};

const CLAIM_REWARD_TYPES = {
  ClaimReward: [
    { name: "player", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

/**
 * Generate claim signature and execute claim transaction
 * @param {string} userAddress - Player's wallet address
 * @param {string} amount - Amount of tokens to claim (in wei)
 * @returns {Promise<string>} Transaction hash
 */
async function claimTokens(userAddress, amount) {
  try {
    const normalizedAddress = ethers.getAddress(userAddress);
    const parsedAmount = ethers.toBigInt(amount);

    if (parsedAmount <= 0n) {
      throw new Error("Amount must be greater than zero");
    }

    // Get current nonce for the player
    const nonce = await gameContract.nonces(normalizedAddress);
    
    // Set deadline to 1 hour from now
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Create EIP-712 signature
    const message = {
      player: normalizedAddress,
      amount: parsedAmount.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    };

    console.log("🔐 Generating EIP-712 signature for claim:", message);

    // Sign the typed data (backend signs as authorized signer)
    const signature = await backendSigner.signTypedData(DOMAIN, CLAIM_REWARD_TYPES, message);

    console.log("✅ Signature generated:", signature);

    // Call the smart contract claimReward function
    const tx = await gameContract.claimReward(
      normalizedAddress,
      parsedAmount,
      nonce,
      deadline,
      signature
    );
    
    console.log("⛓️ Claim transaction submitted:", tx.hash);
    await tx.wait();
    console.log("✅ Claim transaction confirmed");
    
    return tx.hash;
  } catch (error) {
    console.error("❌ Contract claim error:", error);
    throw error;
  }
}

module.exports = { claimTokens };