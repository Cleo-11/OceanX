import type { PlayerStats } from "./types"

export interface SubmarineTier {
  tier: number
  name: string
  description: string
  baseStats: PlayerStats
  upgradeCost: {
    tokens: number
  }
  color: string
  specialAbility?: string
}

export const SUBMARINE_TIERS: SubmarineTier[] = [
  {
    tier: 1,
    name: "Nautilus I",
    description: "Basic exploration submarine with limited storage capacity.",
    baseStats: {
      health: 100,
      energy: 100,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 100,
        cobalt: 50,
        copper: 50,
        manganese: 25,
      },
      depth: 1000,
      speed: 1.0,
      miningRate: 1,
      tier: 1,
    },
    upgradeCost: {
      tokens: 100,
    },
    color: "#fbbf24",
  },
  {
    tier: 2,
    name: "Nautilus II",
    description: "Improved submarine with enhanced storage and durability.",
    baseStats: {
      health: 125,
      energy: 120,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 150,
        cobalt: 75,
        copper: 75,
        manganese: 40,
      },
      depth: 1200,
      speed: 1.3,
      miningRate: 1.2,
      tier: 2,
    },
    upgradeCost: {
      tokens: 200,
    },
    color: "#f59e0b",
  },
  {
    tier: 3,
    name: "Abyssal Explorer",
    description: "Specialized deep-sea submarine with reinforced hull.",
    baseStats: {
      health: 150,
      energy: 140,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 200,
        cobalt: 100,
        copper: 100,
        manganese: 60,
      },
      depth: 1500,
      speed: 1.6,
      miningRate: 1.4,
      tier: 3,
    },
    upgradeCost: {
      tokens: 350,
    },
    color: "#d97706",
  },
  {
    tier: 4,
    name: "Mariana Miner",
    description: "Heavy-duty mining submarine with expanded cargo holds.",
    baseStats: {
      health: 175,
      energy: 160,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 300,
        cobalt: 150,
        copper: 150,
        manganese: 80,
      },
      depth: 1800,
      speed: 2.0,
      miningRate: 1.6,
      tier: 4,
    },
    upgradeCost: {
      tokens: 500,
    },
    color: "#b45309",
  },
  {
    tier: 5,
    name: "Hydrothermal Hunter",
    description: "Advanced submarine with heat-resistant plating for volcanic regions.",
    baseStats: {
      health: 200,
      energy: 180,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 400,
        cobalt: 200,
        copper: 200,
        manganese: 100,
      },
      depth: 2200,
      speed: 2.4,
      miningRate: 1.8,
      tier: 5,
    },
    upgradeCost: {
      tokens: 750,
    },
    color: "#92400e",
  },
  {
    tier: 6,
    name: "Pressure Pioneer",
    description: "Cutting-edge submarine designed for extreme depths.",
    baseStats: {
      health: 250,
      energy: 220,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 500,
        cobalt: 250,
        copper: 250,
        manganese: 125,
      },
      depth: 2600,
      speed: 2.8,
      miningRate: 2.0,
      tier: 6,
    },
    upgradeCost: {
      tokens: 1000,
    },
    color: "#78350f",
    specialAbility: "Pressure Resistance: Immune to depth damage",
  },
  {
    tier: 7,
    name: "Quantum Diver",
    description: "Experimental submarine with quantum-stabilized hull.",
    baseStats: {
      health: 300,
      energy: 260,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 650,
        cobalt: 325,
        copper: 325,
        manganese: 160,
      },
      depth: 3000,
      speed: 3.2,
      miningRate: 2.2,
      tier: 7,
    },
    upgradeCost: {
      tokens: 1500,
    },
    color: "#1e40af",
    specialAbility: "Quantum Scanning: Reveals hidden resource nodes",
  },
  {
    tier: 8,
    name: "Titan Voyager",
    description: "Massive submarine with reinforced titanium hull and expanded storage bays.",
    baseStats: {
      health: 350,
      energy: 300,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 820,
        cobalt: 410,
        copper: 410,
        manganese: 205,
      },
      depth: 3500,
      speed: 3.6,
      miningRate: 2.4,
      tier: 8,
    },
    upgradeCost: {
      tokens: 2000,
    },
    color: "#1e3a8a",
    specialAbility: "Titanium Plating: 25% damage reduction",
  },
  {
    tier: 9,
    name: "Oceanic Behemoth",
    description: "Colossal mining vessel with automated resource processing systems.",
    baseStats: {
      health: 400,
      energy: 340,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 990,
        cobalt: 495,
        copper: 495,
        manganese: 248,
      },
      depth: 4000,
      speed: 4.0,
      miningRate: 2.6,
      tier: 9,
    },
    upgradeCost: {
      tokens: 2750,
    },
    color: "#312e81",
    specialAbility: "Auto-Processing: Resources are refined automatically",
  },
  {
    tier: 10,
    name: "Abyssal Fortress",
    description: "Fortress-class submarine built for the deepest ocean trenches.",
    baseStats: {
      health: 500,
      energy: 400,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 1160,
        cobalt: 580,
        copper: 580,
        manganese: 290,
      },
      depth: 5000,
      speed: 4.5,
      miningRate: 2.8,
      tier: 10,
    },
    upgradeCost: {
      tokens: 3500,
    },
    color: "#581c87",
    specialAbility: "Fortress Mode: Immobile but 3x mining rate",
  },
  {
    tier: 11,
    name: "Kraken's Bane",
    description: "Legendary submarine designed to withstand the most hostile environments.",
    baseStats: {
      health: 600,
      energy: 460,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 1330,
        cobalt: 665,
        copper: 665,
        manganese: 333,
      },
      depth: 6000,
      speed: 5.0,
      miningRate: 3.0,
      tier: 11,
    },
    upgradeCost: {
      tokens: 4500,
    },
    color: "#7c2d12",
    specialAbility: "Kraken Slayer: Immune to all environmental hazards",
  },
  {
    tier: 12,
    name: "Void Walker",
    description: "Mysterious submarine that seems to bend space and time around it.",
    baseStats: {
      health: 700,
      energy: 520,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 1500,
        cobalt: 750,
        copper: 750,
        manganese: 375,
      },
      depth: 7000,
      speed: 5.5,
      miningRate: 3.2,
      tier: 12,
    },
    upgradeCost: {
      tokens: 6000,
    },
    color: "#0c0a09",
    specialAbility: "Void Phase: Can teleport short distances",
  },
  {
    tier: 13,
    name: "Stellar Harvester",
    description: "Advanced submarine powered by miniaturized stellar technology.",
    baseStats: {
      health: 800,
      energy: 600,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 1670,
        cobalt: 835,
        copper: 835,
        manganese: 418,
      },
      depth: 8000,
      speed: 6.0,
      miningRate: 3.4,
      tier: 13,
    },
    upgradeCost: {
      tokens: 7500,
    },
    color: "#fbbf24",
    specialAbility: "Stellar Power: Unlimited energy in sunlight zones",
  },
  {
    tier: 14,
    name: "Cosmic Dreadnought",
    description: "The penultimate submarine, incorporating alien technology.",
    baseStats: {
      health: 900,
      energy: 700,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 1840,
        cobalt: 920,
        copper: 920,
        manganese: 460,
      },
      depth: 9000,
      speed: 6.5,
      miningRate: 3.6,
      tier: 14,
    },
    upgradeCost: {
      tokens: 9000,
    },
    color: "#a855f7",
    specialAbility: "Cosmic Resonance: Attracts rare resources",
  },
  {
    tier: 15,
    name: "Leviathan",
    description: "The ultimate deep-sea mining vessel, unmatched in all aspects.",
    baseStats: {
      health: 1000,
      energy: 1000,
      capacity: {
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
      },
      maxCapacity: {
        nickel: 2000,
        cobalt: 1000,
        copper: 1000,
        manganese: 500,
      },
      depth: 10000,
      speed: 8.0,
      miningRate: 5.0,
      tier: 15,
    },
    upgradeCost: {
      tokens: 0,
    },
    color: "#7e22ce",
    specialAbility: "Omnimining: Can mine all resources simultaneously",
  },
]

export function getSubmarineByTier(tier: number): SubmarineTier {
  return SUBMARINE_TIERS.find((sub) => sub.tier === tier) || SUBMARINE_TIERS[0]
}

export function getNextSubmarineTier(currentTier: number): SubmarineTier | null {
  if (currentTier >= SUBMARINE_TIERS.length) return null
  return SUBMARINE_TIERS.find((sub) => sub.tier === currentTier + 1) || null
}
