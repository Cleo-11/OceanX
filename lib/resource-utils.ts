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
  resources: PlayerResources,
  balance: number,
  requiredResources: {
    nickel: number
    cobalt: number
    copper: number
    manganese: number
    tokens: number
  },
): boolean {
  return (
    resources.nickel >= requiredResources.nickel &&
    resources.cobalt >= requiredResources.cobalt &&
    resources.copper >= requiredResources.copper &&
    resources.manganese >= requiredResources.manganese &&
    balance >= requiredResources.tokens
  )
}

export function deductResourcesForUpgrade(
  resources: PlayerResources,
  balance: number,
  requiredResources: {
    nickel: number
    cobalt: number
    copper: number
    manganese: number
    tokens: number
  },
): { newResources: PlayerResources; newBalance: number } {
  return {
    newResources: {
      nickel: resources.nickel - requiredResources.nickel,
      cobalt: resources.cobalt - requiredResources.cobalt,
      copper: resources.copper - requiredResources.copper,
      manganese: resources.manganese - requiredResources.manganese,
    },
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
