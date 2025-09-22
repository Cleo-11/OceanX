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

// Database schema types for Supabase
export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: number
          wallet_address: string
          username: string | null
          submarine_tier: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          wallet_address: string
          username?: string | null
          submarine_tier?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          wallet_address?: string
          username?: string | null
          submarine_tier?: number
          created_at?: string
          updated_at?: string
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
