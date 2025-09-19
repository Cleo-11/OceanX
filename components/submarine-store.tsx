"use client"

import { useState } from "react"
import type { PlayerResources } from "@/lib/types"
import { SUBMARINE_TIERS, getSubmarineByTier } from "@/lib/submarine-tiers"
import { hasEnoughResourcesForUpgrade } from "@/lib/resource-utils"
import { X, Lock, Star, Zap } from "lucide-react"
import SubmarineIcon from "./SubmarineIcon"
import { AnimatedOceanBackground } from "./animated-ocean-background"
import { CSSWaterEffect } from "./css-water-effect"

interface SubmarineStoreProps {
  isOpen: boolean
  onClose: () => void
  currentTier: number
  resources: PlayerResources
  balance: number
  onPurchase: (targetTier: number) => void
  gameState: string
}

export function SubmarineStore({
  isOpen,
  onClose,
  currentTier,
  resources,
  balance,
  onPurchase,
  gameState,
}: SubmarineStoreProps) {
  const [selectedTier, setSelectedTier] = useState<number | null>(null)

  if (!isOpen) return null

  const isUpgrading = gameState === "upgrading"

  const getTierStatus = (tier: number) => {
    if (tier < currentTier) return "owned"
    if (tier === currentTier) return "current"
    if (tier === currentTier + 1) return "available"
    return "locked"
  }

  const canAffordSubmarine = (tier: number) => {
    if (tier <= currentTier) return false
    const submarine = getSubmarineByTier(tier)
    return hasEnoughResourcesForUpgrade(resources, balance, submarine.upgradeCost)
  }

  const getStatusColor = (tier: number) => {
    const status = getTierStatus(tier)
    switch (status) {
      case "owned":
        return "bg-green-900/30 border-green-500/50"
      case "current":
        return "bg-cyan-900/30 border-cyan-400"
      case "available":
        return canAffordSubmarine(tier) ? "bg-blue-900/30 border-blue-400" : "bg-slate-900/30 border-slate-600"
      case "locked":
        return "bg-slate-900/30 border-slate-700"
      default:
        return "bg-slate-900/30 border-slate-600"
    }
  }

  const getStatusIcon = (tier: number) => {
    const status = getTierStatus(tier)
    switch (status) {
      case "owned":
        return <Star className="h-4 w-4 text-green-400 fill-current" />
      case "current":
        return <Zap className="h-4 w-4 text-cyan-400 fill-current" />
      case "available":
        return canAffordSubmarine(tier) ? (
          <div className="h-4 w-4 rounded-full bg-blue-400" />
        ) : (
          <div className="h-4 w-4 rounded-full bg-slate-500" />
        )
      case "locked":
        return <Lock className="h-4 w-4 text-slate-500" />
      default:
        return null
    }
  }

  const getStatusText = (tier: number) => {
    const status = getTierStatus(tier)
    switch (status) {
      case "owned":
        return "OWNED"
      case "current":
        return "CURRENT"
      case "available":
        return canAffordSubmarine(tier) ? "AVAILABLE" : "INSUFFICIENT RESOURCES"
      case "locked":
        return "LOCKED"
      default:
        return ""
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Animated Ocean Backdrop */}
      <div className="absolute inset-0">
        <AnimatedOceanBackground 
          className="opacity-80" 
          showParticles={true}
          showSunRays={true}
          showFish={false}
        />
        {/* CSS Water Effects */}
        <CSSWaterEffect 
          className="opacity-60" 
          intensity="high"
        />
        {/* Water caustics overlay */}
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-15 mix-blend-overlay" 
            style={{
              backgroundImage: "url('/water-caustics.png')",
              animation: 'waterCaustics 20s linear infinite',
            }}
          />
        </div>
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      </div>

      {/* Empty space that can be clicked to close */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Store Panel */}
      <div className="relative z-10 w-full max-w-4xl bg-slate-800/95 backdrop-blur-md shadow-2xl border-l border-cyan-500/20"
           onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 p-6">
          <div>
            <h2 className="text-2xl font-bold text-cyan-400">SUBMARINE STORE</h2>
            <p className="text-slate-300">Upgrade your submarine to access deeper waters and larger cargo holds</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-700 p-2 text-slate-300 transition-colors hover:bg-slate-600 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Current Status */}
        <div className="border-b border-slate-700 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400">Current Submarine</h3>
              <p className="text-slate-300">
                Tier {currentTier}: {getSubmarineByTier(currentTier).name}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Your Resources</div>
              <div className="flex gap-4 text-sm">
                <span className="text-slate-300">Ni: {resources.nickel}</span>
                <span className="text-blue-300">Co: {resources.cobalt}</span>
                <span className="text-orange-300">Cu: {resources.copper}</span>
                <span className="text-purple-300">Mn: {resources.manganese}</span>
                <span className="text-cyan-300">OCE: {balance}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submarines Grid */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6">
          <div className="grid gap-4">
            {SUBMARINE_TIERS.map((submarine) => {
              const status = getTierStatus(submarine.tier)
              const canAfford = canAffordSubmarine(submarine.tier)
              const isSelected = selectedTier === submarine.tier

              return (
                <div
                  key={submarine.tier}
                  className={`submarine-card rounded-lg border-2 p-4 transition-all ${getStatusColor(submarine.tier)} ${
                    isSelected ? "ring-2 ring-cyan-400 animated-border" : ""
                  } ${status === "available" && canAfford ? "cursor-pointer hover:border-blue-300 ripple-effect" : ""} ${
                    status === "current" ? "shadow-glow-strong" : status === "available" && canAfford ? "shadow-glow" : ""
                  }`}
                  onClick={() => {
                    if (status === "available" && canAfford) {
                      setSelectedTier(submarine.tier)
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    {/* Submarine Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(submarine.tier)}
                          <SubmarineIcon tier={submarine.tier} size={32} className="mr-1" />
                          <span className="text-lg font-bold text-white">
                            Tier {submarine.tier}: {submarine.name}
                          </span>
                        </div>
                        {submarine.tier >= 8 && (
                          <div className="rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 px-2 py-0.5 text-xs font-bold text-black">
                            LEGENDARY
                          </div>
                        )}
                      </div>

                      <p className="mb-3 text-sm text-slate-300">{submarine.description}</p>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {/* Storage Capacity */}
                        <div className="rounded-md bg-slate-800/50 p-3">
                          <h4 className="mb-2 text-xs font-semibold text-slate-400">STORAGE CAPACITY</h4>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-300">Nickel:</span>
                              <span className="font-mono text-slate-200">{submarine.baseStats.maxCapacity.nickel}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-blue-300">Cobalt:</span>
                              <span className="font-mono text-blue-200">{submarine.baseStats.maxCapacity.cobalt}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-orange-300">Copper:</span>
                              <span className="font-mono text-orange-200">
                                {submarine.baseStats.maxCapacity.copper}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-purple-300">Manganese:</span>
                              <span className="font-mono text-purple-200">
                                {submarine.baseStats.maxCapacity.manganese}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Performance Stats */}
                        <div className="rounded-md bg-slate-800/50 p-3">
                          <h4 className="mb-2 text-xs font-semibold text-slate-400">PERFORMANCE</h4>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-300">Health:</span>
                              <span className="font-mono text-red-300">{submarine.baseStats.health}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-300">Energy:</span>
                              <span className="font-mono text-yellow-300">{submarine.baseStats.energy}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-300">Max Depth:</span>
                              <span className="font-mono text-cyan-300">{submarine.baseStats.depth}m</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-300">Speed:</span>
                              <span className="font-mono text-green-300">x{submarine.baseStats.speed.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Mining Stats */}
                        <div className="rounded-md bg-slate-800/50 p-3">
                          <h4 className="mb-2 text-xs font-semibold text-slate-400">MINING</h4>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-300">Mining Rate:</span>
                              <span className="font-mono text-cyan-300">
                                x{submarine.baseStats.miningRate.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-300">Total Storage:</span>
                              <span className="font-mono text-slate-200">
                                {submarine.baseStats.maxCapacity.nickel +
                                  submarine.baseStats.maxCapacity.cobalt +
                                  submarine.baseStats.maxCapacity.copper +
                                  submarine.baseStats.maxCapacity.manganese}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Upgrade Cost */}
                        {submarine.tier > currentTier && (
                          <div className="rounded-md bg-slate-800/50 p-3">
                            <h4 className="mb-2 text-xs font-semibold text-slate-400">UPGRADE COST</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-300">Nickel:</span>
                                <span
                                  className={`font-mono ${
                                    resources.nickel >= submarine.upgradeCost.nickel ? "text-green-300" : "text-red-300"
                                  }`}
                                >
                                  {submarine.upgradeCost.nickel}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-blue-300">Cobalt:</span>
                                <span
                                  className={`font-mono ${
                                    resources.cobalt >= submarine.upgradeCost.cobalt ? "text-green-300" : "text-red-300"
                                  }`}
                                >
                                  {submarine.upgradeCost.cobalt}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-orange-300">Copper:</span>
                                <span
                                  className={`font-mono ${
                                    resources.copper >= submarine.upgradeCost.copper ? "text-green-300" : "text-red-300"
                                  }`}
                                >
                                  {submarine.upgradeCost.copper}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-purple-300">Manganese:</span>
                                <span
                                  className={`font-mono ${
                                    resources.manganese >= submarine.upgradeCost.manganese
                                      ? "text-green-300"
                                      : "text-red-300"
                                  }`}
                                >
                                  {submarine.upgradeCost.manganese}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-cyan-300">OCE Tokens:</span>
                                <span
                                  className={`font-mono ${
                                    balance >= submarine.upgradeCost.tokens ? "text-green-300" : "text-red-300"
                                  }`}
                                >
                                  {submarine.upgradeCost.tokens}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Special Ability */}
                      {submarine.specialAbility && (
                        <div className="mt-3 rounded-md bg-gradient-to-r from-cyan-900/30 to-blue-900/30 p-3">
                          <h4 className="mb-1 text-xs font-semibold text-cyan-400">SPECIAL ABILITY</h4>
                          <p className="text-sm text-cyan-300">{submarine.specialAbility}</p>
                        </div>
                      )}

                      {/* Status */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(submarine.tier)}
                          <span className="text-sm font-medium text-slate-300">{getStatusText(submarine.tier)}</span>
                        </div>

                        {/* Purchase Button */}
                        {status === "available" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canAfford && !isUpgrading) {
                                onPurchase(submarine.tier)
                              }
                            }}
                            disabled={!canAfford || isUpgrading}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                              canAfford && !isUpgrading
                                ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/30 hover:shadow-cyan-900/50"
                                : "bg-slate-600 text-slate-400 opacity-50"
                            }`}
                          >
                            {isUpgrading ? "Upgrading..." : canAfford ? "Upgrade" : "Insufficient Resources"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <div>
              <span className="text-cyan-400">Tip:</span> Higher tier submarines can access deeper waters and mine more
              efficiently
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-green-400 fill-current" />
                <span>Owned</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-cyan-400 fill-current" />
                <span>Current</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 rounded-full bg-blue-400" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-slate-500" />
                <span>Locked</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
