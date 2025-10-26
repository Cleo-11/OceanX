export type GameState =
  | "idle"
  | "mining"
  | "resourceGained"
  | "trading"
  | "resourceTraded"
  | "voting"
  | "voteSubmitted"
  | "upgrading"
  | "upgraded"

export type ResourceType = "nickel" | "cobalt" | "copper" | "manganese"

export interface ResourceNode {
  id: string
  position: { x: number; y: number }
  type: ResourceType
  amount: number
  depleted: boolean
  size: number
}

export interface PlayerStats {
  health: number
  energy: number
  capacity: {
    nickel: number
    cobalt: number
    copper: number
    manganese: number
  }
  maxCapacity: {
    nickel: number
    cobalt: number
    copper: number
    manganese: number
  }
  depth: number
  speed: number
  miningRate: number
  tier: number
}

export interface PlayerResources {
  nickel: number
  cobalt: number
  copper: number
  manganese: number
}

export interface OtherPlayer {
  id: string
  position: { x: number; y: number }
  rotation: number
  submarineType: number
  username: string
}

export interface PlayerPosition {
  x: number
  y: number
  rotation: number
}

// Marketplace Types (simplified)
// Rarity and static value are intentionally omitted — prices will be dynamic on-chain.
export interface MarketplaceResource {
  id: string
  name: string
  icon: string
  // ocxRate is optional: the live market will provide values; show placeholder until available
  ocxRate?: number
  amount: number
  description: string
}

export interface TradeTransaction {
  id: string
  player_id: string
  resource_id: string
  resource_name: string
  amount: number
  ocx_received: number
  timestamp: string
}

// Database schema types for Supabase
export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string  // UUID
          user_id: string
          wallet_address: string | null  // Now nullable after migration
          username: string | null
          submarine_tier: number | null
          coins: number | null
          total_resources_mined: number | null
          total_ocx_earned: number | null  // Your DB uses numeric, which is fine
          last_reward_claim: string | null
          last_login: string | null
          created_at: string | null
          updated_at: string | null
          is_active: boolean | null
          last_daily_trade: string | null
        }
        Insert: {
          id?: string
          user_id: string
          wallet_address?: string | null
          username?: string | null
          submarine_tier?: number | null
          coins?: number | null
          total_resources_mined?: number | null
          total_ocx_earned?: number | null
          last_reward_claim?: string | null
          last_login?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_active?: boolean | null
          last_daily_trade?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          wallet_address?: string | null
          username?: string | null
          submarine_tier?: number | null
          coins?: number | null
          total_resources_mined?: number | null
          total_ocx_earned?: number | null
          last_reward_claim?: string | null
          last_login?: string | null
          created_at?: string | null
          updated_at?: string | null
          is_active?: boolean | null
          last_daily_trade?: string | null
        }
      }
      submarine_tiers: {
        Row: {
          id: number
          name: string
          description: string
          cost: number
          speed: number
          storage: number
          mining_power: number
          hull: number
          special_ability: string | null
        }
        Insert: {
          id?: number
          name: string
          description: string
          cost: number
          speed: number
          storage: number
          mining_power: number
          hull: number
          special_ability?: string | null
        }
        Update: {
          id?: number
          name?: string
          description?: string
          cost?: number
          speed?: number
          storage?: number
          mining_power?: number
          hull?: number
          special_ability?: string | null
        }
      }
    }
  }
}
