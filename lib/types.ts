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
