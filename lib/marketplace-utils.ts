import type { MarketplaceResource, MarketplaceRarity, MarketplaceCategory } from "./types"

/**
 * Default marketplace resources with their exchange rates
 * These are the 4 actual mining resources from the game
 * In production, these should be fetched from Supabase
 */
export const DEFAULT_MARKETPLACE_RESOURCES: Omit<MarketplaceResource, "amount">[] = [
  {
    id: "nickel",
    name: "Nickel",
    icon: "⚪",
    rarity: "common",
    category: "mineral",
    ocxRate: 10,
    description: "Common nickel deposits found on the ocean floor",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    icon: "�",
    rarity: "uncommon",
    category: "mineral",
    ocxRate: 25,
    description: "Valuable cobalt-rich mineral nodules from deep waters",
  },
  {
    id: "copper",
    name: "Copper",
    icon: "�",
    rarity: "rare",
    category: "mineral",
    ocxRate: 50,
    description: "Rare copper ore deposits from volcanic vents",
  },
  {
    id: "manganese",
    name: "Manganese",
    icon: "⚫",
    rarity: "epic",
    category: "mineral",
    ocxRate: 100,
    description: "Premium manganese nodules from the abyssal plains",
  },
]

/**
 * Get rarity color classes for Tailwind
 */
export function getRarityColors(rarity: MarketplaceRarity) {
  const colors = {
    common: {
      gradient: "from-gray-500 to-gray-700",
      glow: "shadow-gray-500/50",
      border: "border-gray-500/30",
      text: "text-gray-400",
      bg: "bg-gray-500/10",
    },
    uncommon: {
      gradient: "from-green-500 to-green-700",
      glow: "shadow-green-500/50",
      border: "border-green-500/30",
      text: "text-green-400",
      bg: "bg-green-500/10",
    },
    rare: {
      gradient: "from-blue-500 to-blue-700",
      glow: "shadow-blue-500/50",
      border: "border-blue-500/30",
      text: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    epic: {
      gradient: "from-purple-500 to-purple-700",
      glow: "shadow-purple-500/50",
      border: "border-purple-500/30",
      text: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    legendary: {
      gradient: "from-yellow-500 to-orange-600",
      glow: "shadow-yellow-500/50",
      border: "border-yellow-500/30",
      text: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
  }
  return colors[rarity]
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: MarketplaceCategory): string {
  const icons = {
    mineral: "⛏️",
    organic: "🌿",
    energy: "⚡",
    artifact: "🏺",
  }
  return icons[category]
}

/**
 * Calculate total OCX from a trade
 */
export function calculateTradeValue(ocxRate: number, amount: number): number {
  return ocxRate * amount
}

/**
 * Format OCX amount with commas
 */
export function formatOCX(amount: number): string {
  return amount.toLocaleString()
}

/**
 * Get mock player resources (replace with actual Supabase fetch in production)
 */
export function getMockPlayerResources(): MarketplaceResource[] {
  return DEFAULT_MARKETPLACE_RESOURCES.map((resource) => ({
    ...resource,
    // Random amounts for demo - replace with actual inventory from database
    amount: Math.floor(Math.random() * 100),
  }))
}
