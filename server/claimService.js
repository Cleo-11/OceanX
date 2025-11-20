import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load OCXToken ABI
let tokenAbi;
try {
  const tokenAbiPath = path.join(__dirname, "./abis/OCXToken.json");
  if (fs.existsSync(tokenAbiPath)) {
    const tokenAbiData = fs.readFileSync(tokenAbiPath, "utf8");
    tokenAbi = JSON.parse(tokenAbiData);
    console.log("✅ OCXToken ABI loaded successfully");
  } else {
    throw new Error("OCXToken ABI file not found at " + tokenAbiPath);
  }
} catch (error) {
  console.error("❌ Failed to load OCXToken ABI:", error.message);
  throw error; // Don't continue without the correct ABI
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const backendSigner = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);

const tokenContract = new ethers.Contract(
  process.env.TOKEN_CONTRACT_ADDRESS,
  tokenAbi.abi,
  backendSigner
);

// EIP-712 Domain for OCXToken (must match contract constructor)
const DOMAIN = {
  name: "OCXToken",
  version: "1",
  chainId: parseInt(process.env.CHAIN_ID || "11155111"), // Default to Sepolia if not set
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

// Configurable claim signature expiry (seconds). Default to 5 minutes (300s).
const CLAIM_SIGNATURE_EXPIRY_SEC = Number(process.env.CLAIM_SIGNATURE_EXPIRY_SEC ?? process.env.CLAIM_EXPIRY_SEC ?? 300);


/**
 * Generate claim signature and execute claim transaction
 * @param {string} userAddress - Player's wallet address
 * @param {string} amount - Amount of tokens to claim (in wei)
 * @returns {Promise<{txHash: string, receipt: object}>} Transaction hash and receipt
 */
async function claimTokens(userAddress, amount) {
  try {
    const normalizedAddress = ethers.getAddress(userAddress);
    const parsedAmount = ethers.toBigInt(amount);

    if (parsedAmount <= 0n) {
      throw new Error("Amount must be greater than zero");
    }

    console.log(`🔄 Processing claim for ${normalizedAddress}: ${ethers.formatEther(parsedAmount)} OCX`);

    // Get current nonce for the player from the contract
    const nonce = await tokenContract.nonces(normalizedAddress);
    console.log(`📊 Current nonce for ${normalizedAddress}: ${nonce.toString()}`);
    
    // Set deadline using configurable expiry (default 5 minutes)
    const deadline = Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(CLAIM_SIGNATURE_EXPIRY_SEC));

    // Create EIP-712 message (note: 'account' not 'player' to match contract CLAIM_TYPEHASH)
    const message = {
      account: normalizedAddress,
      amount: parsedAmount.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    };

    console.log("🔐 Generating EIP-712 signature for claim:", message);

    // Sign the typed data (backend signs as authorized signer)
    const signature = await backendSigner.signTypedData(DOMAIN, CLAIM_TYPES, message);

    console.log("✅ Signature generated:", signature);

    // Split signature into v, r, s components
    const sig = ethers.Signature.from(signature);
    const { v, r, s } = sig;

    console.log(`🔑 Signature components: v=${v}, r=${r}, s=${s}`);

    // Call the OCXToken claim function with split signature
    console.log("⛓️ Calling tokenContract.claim...");
    const tx = await tokenContract.claim(
      parsedAmount,
      nonce,
      deadline,
      v,
      r,
      s
    );
    
    console.log("⛓️ Claim transaction submitted:", tx.hash);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log("✅ Claim transaction confirmed in block:", receipt.blockNumber);
    
    return { txHash: tx.hash, receipt };
  } catch (error) {
    console.error("❌ Contract claim error:", error);
    throw error;
  }
}

/**
 * Generate claim signature WITHOUT executing transaction (sign-only for user-pays flow)
 * @param {string} userAddress - Player's wallet address  
 * @param {string} amount - Amount of tokens to claim (in wei)
 * @returns {Promise<{amountWei: string, nonce: string, deadline: number, signature: string, v: number, r: string, s: string}>}
 */
async function generateClaimSignature(userAddress, amount) {
  try {
    const normalizedAddress = ethers.getAddress(userAddress);
    const parsedAmount = ethers.toBigInt(amount);

    if (parsedAmount <= 0n) {
      throw new Error("Amount must be greater than zero");
    }

    console.log(`🔐 Generating claim signature for ${normalizedAddress}: ${ethers.formatEther(parsedAmount)} OCX`);

    // Get current nonce for the player from the contract
    const nonce = await tokenContract.nonces(normalizedAddress);
    console.log(`📊 Current nonce for ${normalizedAddress}: ${nonce.toString()}`);
    
    // Set deadline using configurable expiry (default 5 minutes)
    const deadline = Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(CLAIM_SIGNATURE_EXPIRY_SEC));

    // Create EIP-712 message
    const message = {
      account: normalizedAddress,
      amount: parsedAmount.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
    };

    console.log("🔐 Signing typed data:", message);

    // Sign the typed data (backend signs as authorized signer)
    const signature = await backendSigner.signTypedData(DOMAIN, CLAIM_TYPES, message);

    // Split signature into v, r, s components
    const sig = ethers.Signature.from(signature);
    const { v, r, s } = sig;

    console.log(`✅ Signature generated: ${signature.slice(0, 10)}...`);
    console.log(`   v=${v}, r=${r.slice(0, 10)}..., s=${s.slice(0, 10)}...`);

    return {
      amountWei: parsedAmount.toString(),
      nonce: nonce.toString(),
      deadline,
      signature,
      v,
      r,
      s
    };
  } catch (error) {
    console.error("❌ Signature generation error:", error);
    throw error;
  }
}

/**
 * Verify a claim transaction receipt and parse Claimed event
 * @param {string} txHash - Transaction hash to verify
 * @param {string} expectedRecipient - Expected recipient address
 * @param {string} expectedAmount - Expected amount in wei
 * @returns {Promise<{valid: boolean, event: object|null}>}
 */
async function verifyClaimTransaction(txHash, expectedRecipient, expectedAmount) {
  try {
    console.log(`🔍 Verifying claim transaction: ${txHash}`);
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      throw new Error("Transaction not found or not confirmed");
    }

    if (receipt.status !== 1) {
      throw new Error("Transaction failed on-chain");
    }

    // Parse logs to find Claimed event
    const iface = new ethers.Interface(tokenAbi.abi);
    let claimedEvent = null;

    for (const log of receipt.logs) {
      // Only parse logs from our token contract
      if (log.address.toLowerCase() !== process.env.TOKEN_CONTRACT_ADDRESS.toLowerCase()) {
        continue;
      }

      try {
        const parsed = iface.parseLog({
          topics: log.topics,
          data: log.data
        });

        if (parsed && parsed.name === 'Claimed') {
          claimedEvent = {
            account: parsed.args.account,
            amount: parsed.args.amount.toString(),
            nonce: parsed.args.nonce.toString()
          };
          break;
        }
      } catch (e) {
        // Not a Claimed event or not our contract
        continue;
      }
    }

    if (!claimedEvent) {
      throw new Error("Claimed event not found in transaction logs");
    }

    // Verify recipient and amount match expectations
    const normalizedRecipient = ethers.getAddress(expectedRecipient);
    const normalizedEventAccount = ethers.getAddress(claimedEvent.account);
    
    if (normalizedEventAccount !== normalizedRecipient) {
      throw new Error(`Recipient mismatch: expected ${normalizedRecipient}, got ${normalizedEventAccount}`);
    }

    // Only check amount if expectedAmount is provided
    if (expectedAmount && claimedEvent.amount !== expectedAmount) {
      throw new Error(`Amount mismatch: expected ${expectedAmount}, got ${claimedEvent.amount}`);
    }

    console.log(`✅ Claim verified: ${normalizedRecipient} claimed ${ethers.formatEther(claimedEvent.amount)} OCX`);

    return {
      valid: true,
      event: claimedEvent,
      blockNumber: receipt.blockNumber,
      transactionHash: receipt.hash
    };

  } catch (error) {
    console.error("❌ Claim verification error:", error);
    throw error;
  }
}

export { claimTokens, generateClaimSignature, verifyClaimTransaction };