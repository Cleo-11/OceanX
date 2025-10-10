import type { PlayerStats, PlayerResources, ResourceType } from "./types"

export function canMineResource(
  stats: PlayerStats,
  resources: PlayerResources,
  resourceType: ResourceType,
  amount: number,
): { canMine: boolean; amountToMine: number } {
  const currentAmount = resources[resourceType]
  const maxCapacity = stats.maxCapacity[resourceType]
  const remainingCapacity = maxCapacity - currentAmount

  if (remainingCapacity <= 0) {
    return { canMine: false, amountToMine: 0 }
  }

  const amountToMine = Math.min(amount, remainingCapacity)
  return { canMine: true, amountToMine }
}

export function hasEnoughResourcesForUpgrade(
  _resources: PlayerResources,
  balance: number,
  requiredResources: {
    tokens: number
  },
): boolean {
  return balance >= requiredResources.tokens
}

export function deductResourcesForUpgrade(
  _resources: PlayerResources,
  balance: number,
  requiredResources: {
    tokens: number
  },
): { newResources: PlayerResources; newBalance: number } {
  // Resources are not deducted anymore in token-only economy
  // Keep the resources unchanged, only deduct tokens
  return {
    newResources: _resources,
    newBalance: balance - requiredResources.tokens,
  }
}

export function getStoragePercentage(resources: PlayerResources, stats: PlayerStats): number {
  const totalCurrent = resources.nickel + resources.cobalt + resources.copper + resources.manganese
  const totalMax =
    stats.maxCapacity.nickel + stats.maxCapacity.cobalt + stats.maxCapacity.copper + stats.maxCapacity.manganese

  return Math.round((totalCurrent / totalMax) * 100)
}

export function getResourceColor(type: ResourceType): string {
  switch (type) {
    case "nickel":
      return "#94a3b8"
    case "cobalt":
      return "#3b82f6"
    case "copper":
      return "#f97316"
    case "manganese":
      return "#a855f7"
    default:
      return "#ffffff"
  }
}

export function getResourceEmoji(type: ResourceType): string {
  switch (type) {
    case "nickel":
      return "🔋"
    case "cobalt":
      return "⚡"
    case "copper":
      return "🔌"
    case "manganese":
      return "🧲"
    default:
      return "💎"
  }
}
