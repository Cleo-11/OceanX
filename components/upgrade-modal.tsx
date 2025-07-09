"use client"

import { useState } from "react"
import type { GameState, PlayerResources } from "@/lib/types"
import { getSubmarineByTier, getNextSubmarineTier } from "@/lib/submarine-tiers"
import { hasEnoughResourcesForUpgrade } from "@/lib/resource-utils"

interface UpgradeModalProps {
  currentTier: number
  resources: PlayerResources
  balance: number
  onUpgrade: () => void
  onClose: () => void
  gameState: GameState
}

export function UpgradeModal({ currentTier, resources, balance, onUpgrade, onClose, gameState }: UpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState(currentTier + 1)

  const currentSubmarine = getSubmarineByTier(currentTier)
  const nextSubmarine = getNextSubmarineTier(currentTier)

  // If there's no next submarine (max tier), show a message
  if (!nextSubmarine) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-xl bg-slate-800 p-6 shadow-2xl">
          <h2 className="mb-4 text-2xl font-bold text-cyan-400">Maximum Tier Reached</h2>
          <p className="mb-6 text-slate-300">
            Your submarine is already at the maximum tier ({currentTier}: {currentSubmarine.name}).
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isUpgrading = gameState === "upgrading"
  const canUpgrade = hasEnoughResourcesForUpgrade(resources, balance, nextSubmarine.upgradeCost)

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-slate-800 p-6 shadow-2xl">
        <h2 className="mb-4 text-2xl font-bold text-cyan-400">Upgrade Submarine</h2>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Current Submarine */}
          <div className="rounded-lg bg-slate-700 p-4">
            <h3 className="mb-2 text-lg font-semibold text-slate-200">Current: {currentSubmarine.name}</h3>
            <p className="mb-4 text-sm text-slate-400">{currentSubmarine.description}</p>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">Health:</span>
                <span className="font-mono text-cyan-400">{currentSubmarine.baseStats.health}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Energy:</span>
                <span className="font-mono text-cyan-400">{currentSubmarine.baseStats.energy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Max Depth:</span>
                <span className="font-mono text-cyan-400">{currentSubmarine.baseStats.depth}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Speed:</span>
                <span className="font-mono text-cyan-400">x{currentSubmarine.baseStats.speed.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Mining Rate:</span>
                <span className="font-mono text-cyan-400">x{currentSubmarine.baseStats.miningRate.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Storage:</span>
                <span className="font-mono text-cyan-400">
                  {currentSubmarine.baseStats.maxCapacity.nickel +
                    currentSubmarine.baseStats.maxCapacity.cobalt +
                    currentSubmarine.baseStats.maxCapacity.copper +
                    currentSubmarine.baseStats.maxCapacity.manganese}
                </span>
              </div>
            </div>
          </div>

          {/* Next Submarine */}
          <div className="rounded-lg bg-slate-700 p-4">
            <h3 className="mb-2 text-lg font-semibold text-cyan-400">Next: {nextSubmarine.name}</h3>
            <p className="mb-4 text-sm text-slate-400">{nextSubmarine.description}</p>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">Health:</span>
                <span className="font-mono text-cyan-400">
                  {nextSubmarine.baseStats.health}
                  <span className="ml-1 text-green-400">
                    (+{nextSubmarine.baseStats.health - currentSubmarine.baseStats.health})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Energy:</span>
                <span className="font-mono text-cyan-400">
                  {nextSubmarine.baseStats.energy}
                  <span className="ml-1 text-green-400">
                    (+{nextSubmarine.baseStats.energy - currentSubmarine.baseStats.energy})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Max Depth:</span>
                <span className="font-mono text-cyan-400">
                  {nextSubmarine.baseStats.depth}m
                  <span className="ml-1 text-green-400">
                    (+{nextSubmarine.baseStats.depth - currentSubmarine.baseStats.depth}m)
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Speed:</span>
                <span className="font-mono text-cyan-400">
                  x{nextSubmarine.baseStats.speed.toFixed(1)}
                  <span className="ml-1 text-green-400">
                    (+{(nextSubmarine.baseStats.speed - currentSubmarine.baseStats.speed).toFixed(1)})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Mining Rate:</span>
                <span className="font-mono text-cyan-400">
                  x{nextSubmarine.baseStats.miningRate.toFixed(1)}
                  <span className="ml-1 text-green-400">
                    (+{(nextSubmarine.baseStats.miningRate - currentSubmarine.baseStats.miningRate).toFixed(1)})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Storage:</span>
                <span className="font-mono text-cyan-400">
                  {nextSubmarine.baseStats.maxCapacity.nickel +
                    nextSubmarine.baseStats.maxCapacity.cobalt +
                    nextSubmarine.baseStats.maxCapacity.copper +
                    nextSubmarine.baseStats.maxCapacity.manganese}
                  <span className="ml-1 text-green-400">
                    (+
                    {nextSubmarine.baseStats.maxCapacity.nickel +
                      nextSubmarine.baseStats.maxCapacity.cobalt +
                      nextSubmarine.baseStats.maxCapacity.copper +
                      nextSubmarine.baseStats.maxCapacity.manganese -
                      (currentSubmarine.baseStats.maxCapacity.nickel +
                        currentSubmarine.baseStats.maxCapacity.cobalt +
                        currentSubmarine.baseStats.maxCapacity.copper +
                        currentSubmarine.baseStats.maxCapacity.manganese)}
                    )
                  </span>
                </span>
              </div>
            </div>

            {nextSubmarine.specialAbility && (
              <div className="mt-3 rounded-md bg-cyan-900/30 p-2 text-xs text-cyan-300">
                <span className="font-bold">SPECIAL:</span> {nextSubmarine.specialAbility}
              </div>
            )}
          </div>
        </div>

        {/* Upgrade Cost */}
        <div className="mb-6 rounded-lg bg-slate-700 p-4">
          <h3 className="mb-3 text-lg font-semibold text-slate-200">Upgrade Cost</h3>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div className="rounded-md bg-slate-800 p-2 text-center">
              <div className="text-xl">🔋</div>
              <div className="text-sm text-slate-300">Nickel</div>
              <div
                className={`font-mono ${resources.nickel >= nextSubmarine.upgradeCost.nickel ? "text-green-400" : "text-red-400"}`}
              >
                {resources.nickel}/{nextSubmarine.upgradeCost.nickel}
              </div>
            </div>

            <div className="rounded-md bg-slate-800 p-2 text-center">
              <div className="text-xl">⚡</div>
              <div className="text-sm text-slate-300">Cobalt</div>
              <div
                className={`font-mono ${resources.cobalt >= nextSubmarine.upgradeCost.cobalt ? "text-green-400" : "text-red-400"}`}
              >
                {resources.cobalt}/{nextSubmarine.upgradeCost.cobalt}
              </div>
            </div>

            <div className="rounded-md bg-slate-800 p-2 text-center">
              <div className="text-xl">🔌</div>
              <div className="text-sm text-slate-300">Copper</div>
              <div
                className={`font-mono ${resources.copper >= nextSubmarine.upgradeCost.copper ? "text-green-400" : "text-red-400"}`}
              >
                {resources.copper}/{nextSubmarine.upgradeCost.copper}
              </div>
            </div>

            <div className="rounded-md bg-slate-800 p-2 text-center">
              <div className="text-xl">🧲</div>
              <div className="text-sm text-slate-300">Manganese</div>
              <div
                className={`font-mono ${resources.manganese >= nextSubmarine.upgradeCost.manganese ? "text-green-400" : "text-red-400"}`}
              >
                {resources.manganese}/{nextSubmarine.upgradeCost.manganese}
              </div>
            </div>

            <div className="rounded-md bg-slate-800 p-2 text-center">
              <div className="text-xl">💰</div>
              <div className="text-sm text-slate-300">OCE Tokens</div>
              <div
                className={`font-mono ${balance >= nextSubmarine.upgradeCost.tokens ? "text-green-400" : "text-red-400"}`}
              >
                {balance}/{nextSubmarine.upgradeCost.tokens}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-600"
            disabled={isUpgrading}
          >
            Cancel
          </button>

          <button
            onClick={onUpgrade}
            disabled={!canUpgrade || isUpgrading}
            className={`rounded-lg px-4 py-2 font-medium text-white shadow-md transition-all ${
              canUpgrade
                ? "bg-gradient-to-r from-teal-600 to-cyan-700 shadow-cyan-900/30 hover:shadow-cyan-900/50"
                : "bg-slate-600 opacity-50"
            }`}
          >
            {isUpgrading ? "Upgrading..." : "Upgrade Submarine"}
          </button>
        </div>
      </div>
    </div>
  )
}
