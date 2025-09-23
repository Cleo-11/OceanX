import { walletManager } from "./wallet"
import { env } from "./env"

// Contract addresses from environment variables (more secure)
export const CONTRACT_ADDRESSES = {
  OCEAN_X_TOKEN: env.NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS || "0x7082bd37ea9552faf0549abb868602135aada705",
  PLAYER_PROFILE: env.NEXT_PUBLIC_PLAYER_PROFILE_ADDRESS || "0x3b4682e9e31c0fb9391967ce51c58e8b4cc02063",
  UPGRADE_MANAGER: env.NEXT_PUBLIC_UPGRADE_MANAGER_ADDRESS || "0xb8ca16e41aac1e17dc5ddd22c5f20b35860f9a0c",
  DAILY_MINER: env.NEXT_PUBLIC_DAILY_MINER_ADDRESS || "0x8b0f0580fe26554bbfa2668ee042f20301c3ced3",
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

export const DAILY_MINER_ABI = [
  {
    inputs: [],
    name: "claimDailyReward",
    outputs: [],
    stateMutability: "nonpayable",
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

  static async claimDailyReward(): Promise<any> {
    return walletManager.executeContract(CONTRACT_ADDRESSES.DAILY_MINER, DAILY_MINER_ABI, "claimDailyReward")
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
