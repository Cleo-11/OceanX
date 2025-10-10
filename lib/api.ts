import { env } from "./env"
import type { PlayerResources } from "./types"

const API_BASE_URL = env.NEXT_PUBLIC_API_URL

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PlayerProgress {
  id: string
  wallet_address: string
  current_tier: number
  selected_submarine: number
  total_tokens_earned: number
  total_play_time: number
  coins?: number
  resources: {
    nickel: number
    cobalt: number
    copper: number
    manganese: number
  }
  position: { x: number; y: number; z: number }
  version: string
  last_saved: string
  last_daily_trade?: string
}

export interface SubmarineData {
  id: number
  name: string
  cost: number
  speed: number
  storage: number
  miningPower: number
  hull: number
  energy: number
}

export interface SubmarineUpgradePayload extends SubmarineData {
  tier: number
  description?: string
  color?: string
  specialAbility?: string
  baseStats?: {
    health?: number
    energy?: number
    capacity?: PlayerResources
    maxCapacity?: PlayerResources
    depth?: number
    speed?: number
    miningRate?: number
    tier?: number
  }
  upgradeCost?: { tokens: number }
}

export interface SubmarineUpgradeResult {
  playerId: string
  wallet: string
  previousTier: number
  newTier: number
  tierDetails?: SubmarineUpgradePayload | null
  coins: number
  cost: {
    coins: number
  }
  timestamp: string
  message: string
}

export interface GameSession {
  sessionId: string
  playerCount: number
  maxPlayers: number
  resourceNodes?: ResourceNode[]
}

export interface ResourceNode {
  id: string
  type: string
  position: { x: number; y: number; z: number }
  amount: number
  maxAmount: number
  size: number
  depleted: boolean
}

export interface LeaderboardEntry {
  rank: number
  wallet: string
  tokens: number
  tier: number
  submarine: string
}

export interface DailyTradeResponse {
  ocxEarned: number
  breakdown: Record<string, { amount: number; rate: number; value: number }>
  tradeTime: string
  nextTradeAvailable: string
  message: string
}

export interface DailyTradeStatus {
  canTrade: boolean
  lastTradeTime?: string
  timeUntilNextTrade: number
  hoursUntilNext: number
  nextTradeAvailable: string
}

export interface PlayerBalanceResponse {
  coins: number
  balance: string
  symbol: string
  network: string
  legacyTokenBalance?: string
}

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      console.log(`🌐 API Request: ${this.baseURL}${endpoint}`)

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Network error" }))
        console.error(`❌ API Error (${response.status}):`, errorData)
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
        }
      }

      const data = await response.json()
      console.log(`✅ API Success:`, data)
      return {
        success: true,
        data,
      }
    } catch (error) {
      console.error("❌ API Request failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      }
    }
  }

  // Health check
  async healthCheck(): Promise<
    ApiResponse<{
      status: string
      timestamp: string
      network: string
      version: string
      database: string
      activeSessions: number
      totalPlayers: number
      tables: Record<string, string>
    }>
  > {
    return this.request("/health")
  }

  // Authentication
  async connectWallet(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<ApiResponse<{ player: PlayerProgress; submarine: SubmarineData; message: string; databaseMode: string }>> {
    return this.request("/auth/connect", {
      method: "POST",
      body: JSON.stringify({ address: walletAddress, signature, message }),
    })
  }



  // Submarine management
  async getSubmarines(): Promise<ApiResponse<{ submarines: SubmarineData[] }>> {
    return this.request("/submarines")
  }

  async getPlayerSubmarine(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<ApiResponse<{ current: SubmarineData; next?: SubmarineData; canUpgrade: boolean }>> {
    return this.request("/player/submarine", {
      method: "POST",
      body: JSON.stringify({ address: walletAddress, signature, message }),
    })
  }

  async upgradeSubmarine(
    walletAddress: string,
    signature: string,
    message: string,
    targetTier?: number,
    playerId?: string,
  ): Promise<ApiResponse<SubmarineUpgradeResult>> {
    const payload: Record<string, unknown> = { address: walletAddress, signature, message }
    if (typeof targetTier === "number" && Number.isFinite(targetTier)) {
      payload.targetTier = targetTier
    }
    if (typeof playerId === "string" && playerId.trim().length > 0) {
      payload.playerId = playerId.trim()
    }

    return this.request("/submarine/upgrade", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  // Player data
  async getPlayerBalance(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<ApiResponse<PlayerBalanceResponse>> {
    return this.request("/player/balance", {
      method: "POST",
      body: JSON.stringify({ address: walletAddress, signature, message }),
    })
  }

  // Daily Trading System
  async performDailyTrade(
    walletAddress: string,
    signature: string,
    message: string,
    resources: Record<string, number>,
  ): Promise<ApiResponse<DailyTradeResponse>> {
    return this.request("/daily-trade", {
      method: "POST",
      body: JSON.stringify({ address: walletAddress, signature, message, resources }),
    })
  }

  async getDailyTradeStatus(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<ApiResponse<DailyTradeStatus>> {
    return this.request("/daily-trade/status", {
      method: "POST",
      body: JSON.stringify({ address: walletAddress, signature, message }),
    })
  }

  // Rewards
  async claimDailyReward(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<ApiResponse<{ reward: string; message: string }>> {
    return this.request("/rewards/claim", {
      method: "POST",
      body: JSON.stringify({ address: walletAddress, signature, message }),
    })
  }

  // Leaderboard
  async getLeaderboard(): Promise<ApiResponse<{ leaderboard: LeaderboardEntry[] }>> {
    return this.request("/leaderboard")
  }

  // Utility method to create authenticated message
  createAuthMessage(walletAddress: string, action = "authenticate"): string {
    return `AbyssX ${action}

Wallet: ${walletAddress}
Timestamp: ${Date.now()}
Network: Sepolia`
  }
}

export const apiClient = new ApiClient(API_BASE_URL)

// Export utility functions
export const createSignaturePayload = (walletAddress: string, action = "authenticate") => {
  const message = apiClient.createAuthMessage(walletAddress, action)
  return { message }
}
