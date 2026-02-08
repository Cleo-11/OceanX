"use client"

import { useState } from "react"
import type { GameState, PlayerResources } from "@/lib/types"
import { getSubmarineByTier, SUBMARINE_TIERS } from "@/lib/submarine-tiers"
import { hasEnoughResourcesForUpgrade } from "@/lib/resource-utils"


interface UpgradeModalProps {
  currentTier: number
  resources: PlayerResources
  balance: number
  onUpgrade: (tier: number) => void
  onClose: () => void
  gameState: GameState
}


export function UpgradeModal({ currentTier, resources, balance, onUpgrade, onClose, gameState }: UpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState(currentTier + 1)
  const currentSubmarine = getSubmarineByTier(currentTier)
  const availableTiers = SUBMARINE_TIERS.filter(t => t.tier > currentTier)
  const selectedSubmarine = SUBMARINE_TIERS.find(t => t.tier === selectedTier)

  if (availableTiers.length === 0 || !selectedSubmarine) {
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
  const canUpgrade = hasEnoughResourcesForUpgrade(resources, balance, selectedSubmarine.upgradeCost)

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
          {/* Selected Submarine */}
          <div className="rounded-lg bg-slate-700 p-4">
            <h3 className="mb-2 text-lg font-semibold text-cyan-400">Selected: {selectedSubmarine.name}</h3>
            <p className="mb-4 text-sm text-slate-400">{selectedSubmarine.description}</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-300">Health:</span>
                <span className="font-mono text-cyan-400">
                  {selectedSubmarine.baseStats.health}
                  <span className="ml-1 text-green-400">
                    (+{selectedSubmarine.baseStats.health - currentSubmarine.baseStats.health})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Energy:</span>
                <span className="font-mono text-cyan-400">
                  {selectedSubmarine.baseStats.energy}
                  <span className="ml-1 text-green-400">
                    (+{selectedSubmarine.baseStats.energy - currentSubmarine.baseStats.energy})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Max Depth:</span>
                <span className="font-mono text-cyan-400">
                  {selectedSubmarine.baseStats.depth}m
                  <span className="ml-1 text-green-400">
                    (+{selectedSubmarine.baseStats.depth - currentSubmarine.baseStats.depth}m)
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Speed:</span>
                <span className="font-mono text-cyan-400">
                  x{selectedSubmarine.baseStats.speed.toFixed(1)}
                  <span className="ml-1 text-green-400">
                    (+{(selectedSubmarine.baseStats.speed - currentSubmarine.baseStats.speed).toFixed(1)})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Mining Rate:</span>
                <span className="font-mono text-cyan-400">
                  x{selectedSubmarine.baseStats.miningRate.toFixed(1)}
                  <span className="ml-1 text-green-400">
                    (+{(selectedSubmarine.baseStats.miningRate - currentSubmarine.baseStats.miningRate).toFixed(1)})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Storage:</span>
                <span className="font-mono text-cyan-400">
                  {selectedSubmarine.baseStats.maxCapacity.nickel +
                    selectedSubmarine.baseStats.maxCapacity.cobalt +
                    selectedSubmarine.baseStats.maxCapacity.copper +
                    selectedSubmarine.baseStats.maxCapacity.manganese}
                  <span className="ml-1 text-green-400">
                    (+
                    {selectedSubmarine.baseStats.maxCapacity.nickel +
                      selectedSubmarine.baseStats.maxCapacity.cobalt +
                      selectedSubmarine.baseStats.maxCapacity.copper +
                      selectedSubmarine.baseStats.maxCapacity.manganese -
                      (currentSubmarine.baseStats.maxCapacity.nickel +
                        currentSubmarine.baseStats.maxCapacity.cobalt +
                        currentSubmarine.baseStats.maxCapacity.copper +
                        currentSubmarine.baseStats.maxCapacity.manganese)}
                    )
                  </span>
                </span>
              </div>
            </div>
            {selectedSubmarine.specialAbility && (
              <div className="mt-3 rounded-md bg-cyan-900/30 p-2 text-xs text-cyan-300">
                <span className="font-bold">SPECIAL:</span> {selectedSubmarine.specialAbility}
              </div>
            )}
          </div>
        </div>
        {/* Tier selection dropdown */}
        <div className="mb-4">
          <label htmlFor="tier-select" className="block mb-2 text-sm font-medium text-cyan-200">Select Tier to Upgrade To:</label>
          <select
            id="tier-select"
            value={selectedTier}
            onChange={e => setSelectedTier(Number(e.target.value))}
            className="rounded-lg bg-slate-700 px-4 py-2 text-white"
          >
            {availableTiers.map(tier => (
              <option key={tier.tier} value={tier.tier}>
                Tier {tier.tier}: {tier.name}
              </option>
            ))}
          </select>
        </div>
        {/* Upgrade Cost */}
        <div className="mb-6 rounded-lg bg-slate-700 p-4">
          <h3 className="mb-3 text-lg font-semibold text-slate-200">Upgrade Cost</h3>
          <div className="flex justify-center">
            <div className="rounded-md bg-slate-800 p-4 text-center">
              <div className="text-3xl mb-2">�</div>
              <div className="text-sm text-slate-300 mb-1">OCX Tokens</div>
              <div
                className={`font-mono text-2xl font-bold ${balance >= selectedSubmarine.upgradeCost.tokens ? "text-green-400" : "text-red-400"}`}
              >
                {balance}/{selectedSubmarine.upgradeCost.tokens}
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
            onClick={() => onUpgrade(selectedTier)}
            disabled={!canUpgrade || isUpgrading}
            className={`rounded-lg px-4 py-2 font-medium text-white shadow-md transition-all ${
              canUpgrade
                ? "bg-gradient-to-r from-teal-600 to-cyan-700 shadow-cyan-900/30 hover:shadow-cyan-900/50"
                : "bg-slate-600 opacity-50"
            }`}
          >
            {isUpgrading ? "Upgrading..." : `Upgrade to Tier ${selectedTier}`}
          </button>
        </div>
      </div>
    </div>
  )
}
