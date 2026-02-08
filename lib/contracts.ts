import { walletManager } from "./wallet"
import { env } from "./env"
import { ethers, BrowserProvider } from 'ethers'

// Import full ABIs
import UpgradeManagerABI from '@/server/abis/UpgradeManager.json'
import OceanXTokenABI from '@/server/abis/OceanXToken.json'

// Contract addresses from environment variables (more secure)
export const CONTRACT_ADDRESSES = {
  OCEAN_X_TOKEN: env.NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || "0x0D30A0D0d4De399ED862D0509817aDE64b7d2Ea9",
  PLAYER_PROFILE: env.NEXT_PUBLIC_PLAYER_PROFILE_ADDRESS || "0x3b4682e9e31c0fb9391967ce51c58e8b4cc02063",
  UPGRADE_MANAGER: env.NEXT_PUBLIC_UPGRADE_MANAGER_ADDRESS || "0xb8ca16e41aac1e17dc5ddd22c5f20b35860f9a0c",
}

// Contract ABIs (simplified for essential functions)
export const UPGRADE_MANAGER_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "targetSubmarine", type: "uint256" }],
    name: "upgradeSubmarine",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "submarineType", type: "uint256" }],
    name: "getUpgradeCost",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
]

export const PLAYER_PROFILE_ABI = [
  {
    inputs: [],
    name: "createProfile",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
]

export const OCEAN_X_TOKEN_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
]

export class ContractManager {
  static async upgradeSubmarine(targetTier: number): Promise<any> {
    return walletManager.executeContract(CONTRACT_ADDRESSES.UPGRADE_MANAGER, UPGRADE_MANAGER_ABI, "upgradeSubmarine", [
      targetTier,
    ])
  }

  static async createProfile(): Promise<any> {
    return walletManager.executeContract(CONTRACT_ADDRESSES.PLAYER_PROFILE, PLAYER_PROFILE_ABI, "createProfile")
  }

  static async approveTokens(amount: string): Promise<any> {
    return walletManager.executeContract(CONTRACT_ADDRESSES.OCEAN_X_TOKEN, OCEAN_X_TOKEN_ABI, "approve", [
      CONTRACT_ADDRESSES.UPGRADE_MANAGER,
      amount,
    ])
  }

  static async getTokenBalance(address: string): Promise<string> {
    return walletManager.readContract(CONTRACT_ADDRESSES.OCEAN_X_TOKEN, OCEAN_X_TOKEN_ABI, "balanceOf", [address])
  }
}

// ============================================================================
// Enhanced Ethers.js Integration for Submarine Upgrades
// ============================================================================

/**
 * Get browser provider (MetaMask or other injected wallet)
 */
export async function getBrowserProvider(): Promise<BrowserProvider> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No Web3 wallet detected. Please install MetaMask.')
  }
  return new ethers.BrowserProvider(window.ethereum)
}

/**
 * Connect wallet and return connection details
 */
export async function connectWallet() {
  const provider = await getBrowserProvider()
  await provider.send('eth_requestAccounts', [])
  
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  const network = await provider.getNetwork()
  
  return {
    provider,
    signer,
    address,
    chainId: Number(network.chainId),
  }
}

/**
 * Get UpgradeManager contract instance with signer
 */
export async function getUpgradeManagerContract(signer?: ethers.Signer) {
  const signerOrProvider = signer || (await connectWallet()).signer
  return new ethers.Contract(
    CONTRACT_ADDRESSES.UPGRADE_MANAGER,
    UpgradeManagerABI,
    signerOrProvider
  )
}

/**
 * Get OceanX Token contract instance with signer
 */
export async function getOceanXTokenContract(signer?: ethers.Signer) {
  const signerOrProvider = signer || (await connectWallet()).signer
  return new ethers.Contract(
    CONTRACT_ADDRESSES.OCEAN_X_TOKEN,
    OceanXTokenABI,
    signerOrProvider
  )
}

/**
 * Check token allowance for upgrade contract
 */
export async function checkTokenAllowance(
  ownerAddress: string,
  requiredAmount: bigint
): Promise<boolean> {
  try {
    const provider = await getBrowserProvider()
    const tokenContract = new ethers.Contract(
      CONTRACT_ADDRESSES.OCEAN_X_TOKEN,
      OceanXTokenABI,
      provider
    )
    const allowance = await tokenContract.allowance(ownerAddress, CONTRACT_ADDRESSES.UPGRADE_MANAGER)
    return allowance >= requiredAmount
  } catch (error) {
    console.error('Failed to check allowance:', error)
    return false
  }
}

/**
 * Approve OCX tokens for UpgradeManager
 */
export async function approveOCXTokens(amount: bigint) {
  const { signer } = await connectWallet()
  const tokenContract = await getOceanXTokenContract(signer)
  
  const tx = await tokenContract.approve(CONTRACT_ADDRESSES.UPGRADE_MANAGER, amount)
  const receipt = await tx.wait()
  
  return { tx, receipt, txHash: receipt.hash }
}

/**
 * Execute submarine upgrade on-chain
 * Returns transaction details for server verification
 */
export async function executeSubmarineUpgrade(targetTier: number) {
  const { signer, address } = await connectWallet()
  const upgradeContract = await getUpgradeManagerContract(signer)
  
  // Get upgrade cost
  const cost = await upgradeContract.getUpgradeCost(targetTier)
  
  // Check and approve tokens if needed
  if (cost > BigInt(0)) {
    const hasAllowance = await checkTokenAllowance(address, cost)
    if (!hasAllowance) {
      await approveOCXTokens(cost)
    }
  }
  
  // Execute upgrade transaction
  const tx = await upgradeContract.upgradeSubmarine(targetTier)
  const receipt = await tx.wait()
  
  // Parse events to get upgrade details
  const upgradeEvent = receipt.logs
    .map((log: any) => {
      try {
        return upgradeContract.interface.parseLog(log)
      } catch {
        return null
      }
    })
    .find((event: any) => event?.name === 'SubmarineUpgraded')
  
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    cost: cost.toString(),
    previousTier: upgradeEvent?.args?.previousTier ? Number(upgradeEvent.args.previousTier) : null,
    newTier: upgradeEvent?.args?.newTier ? Number(upgradeEvent.args.newTier) : targetTier,
    playerAddress: address,
    timestamp: upgradeEvent?.args?.timestamp ? Number(upgradeEvent.args.timestamp) : Math.floor(Date.now() / 1000),
  }
}

/**
 * Get current tier for player from contract
 */
export async function getPlayerCurrentTier(playerAddress: string): Promise<number> {
  const provider = await getBrowserProvider()
  const upgradeContract = new ethers.Contract(
    CONTRACT_ADDRESSES.UPGRADE_MANAGER,
    UpgradeManagerABI,
    provider
  )
  const tier = await upgradeContract.getCurrentTier(playerAddress)
  return Number(tier)
}

/**
 * Get upgrade cost for target tier
 */
export async function getUpgradeCostForTier(targetTier: number): Promise<string> {
  const provider = await getBrowserProvider()
  const upgradeContract = new ethers.Contract(
    CONTRACT_ADDRESSES.UPGRADE_MANAGER,
    UpgradeManagerABI,
    provider
  )
  const cost = await upgradeContract.getUpgradeCost(targetTier)
  return ethers.formatEther(cost)
}

/**
 * Get player's OCX balance
 */
export async function getPlayerOCXBalance(address: string): Promise<string> {
  const provider = await getBrowserProvider()
  const tokenContract = new ethers.Contract(
    CONTRACT_ADDRESSES.OCEAN_X_TOKEN,
    OceanXTokenABI,
    provider
  )
  const balance = await tokenContract.balanceOf(address)
  return ethers.formatEther(balance)
}

/**
 * Get player's OCX balance using a public RPC provider (no wallet connection needed).
 * This is a read-only call that works even when MetaMask is not connected.
 */
export async function getOCXBalanceReadOnly(address: string): Promise<string> {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/'
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const tokenContract = new ethers.Contract(
    CONTRACT_ADDRESSES.OCEAN_X_TOKEN,
    [{
      inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    }],
    provider
  )
  const balance = await tokenContract.balanceOf(address)
  return ethers.formatEther(balance)
}

// Type augmentation
declare global {
  interface Window {
    ethereum?: any
  }
}

