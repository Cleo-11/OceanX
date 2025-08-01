"use client"

import type { GameState, PlayerStats, PlayerResources } from "@/lib/types"
import { ResourceItem } from "./ResourceItem"

interface ResourceSidebarProps {
  isOpen: boolean
  resources: PlayerResources
  balance: number
  onTradeAll: () => void
  gameState: GameState
  playerStats: PlayerStats
  onDisconnect?: () => void
}

export function ResourceSidebar({ isOpen, resources, balance, onTradeAll, gameState, playerStats, onDisconnect }: ResourceSidebarProps) {
  const isTrading = gameState === "trading" || gameState === "resourceTraded"
  const isUpgrading = gameState === "upgrading" || gameState === "upgraded"
  const isDisabled = isTrading || isUpgrading

  // Calculate total storage used and capacity
  const totalUsed = resources.nickel + resources.cobalt + resources.copper + resources.manganese

  const totalCapacity =
    playerStats.maxCapacity.nickel +
    playerStats.maxCapacity.cobalt +
    playerStats.maxCapacity.copper +
    playerStats.maxCapacity.manganese

  const storagePercentage = Math.round((totalUsed / totalCapacity) * 100)

  return (
    <div
      className={`pointer-events-auto absolute right-0 top-0 z-30 h-full w-80 transform bg-slate-900/90 p-6 shadow-lg shadow-cyan-900/20 backdrop-blur-md transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Trade All Button */}
      {storagePercentage === 100 && (
        <button
          onClick={onTradeAll}
          className="mb-4 w-full rounded-lg bg-gradient-to-r from-yellow-500 to-cyan-600 py-3 text-lg font-bold text-white shadow-lg hover:from-yellow-400 hover:to-cyan-500 transition-all"
          disabled={isDisabled}
        >
          Trade All for OCX
        </button>
      )}
      <h2 className="mb-6 text-2xl font-bold text-cyan-400">RESOURCES</h2>

      {/* Storage Overview */}
      <div className="mb-4 rounded-lg bg-slate-800/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-300">Storage:</span>
          <span className="font-mono text-cyan-400">
            {totalUsed}/{totalCapacity}
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full ${
              storagePercentage > 90 ? "bg-red-500" : storagePercentage > 70 ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${storagePercentage}%` }}
          />
        </div>
      </div>

      {/* Inventory */}
      <div className="mb-8">
        <h3 className="mb-3 border-b border-cyan-900/50 pb-1 text-lg font-semibold text-slate-200">Inventory</h3>
        <div className="grid grid-cols-2 gap-4">
          <ResourceItem
            name="Nickel"
            icon="🔋"
            amount={resources.nickel}
            capacity={playerStats.capacity.nickel}
            maxCapacity={playerStats.maxCapacity.nickel}
          />
          <ResourceItem
            name="Cobalt"
            icon="⚡"
            amount={resources.cobalt}
            capacity={playerStats.capacity.cobalt}
            maxCapacity={playerStats.maxCapacity.cobalt}
          />
          <ResourceItem
            name="Copper"
            icon="🔌"
            amount={resources.copper}
            capacity={playerStats.capacity.copper}
            maxCapacity={playerStats.maxCapacity.copper}
          />
          <ResourceItem
            name="Manganese"
            icon="🧲"
            amount={resources.manganese}
            capacity={playerStats.capacity.manganese}
            maxCapacity={playerStats.maxCapacity.manganese}
          />
        </div>
      </div>

      {/* Wallet */}
      <div className="mb-8">
        <h3 className="mb-3 border-b border-cyan-900/50 pb-1 text-lg font-semibold text-slate-200">Wallet</h3>
        <div className="rounded-lg bg-slate-800/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">OCE Balance:</span>
            <span className="font-mono text-lg font-bold text-cyan-400">{balance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Market Prices */}
      <div>
        <h3 className="mb-3 border-b border-cyan-900/50 pb-1 text-lg font-semibold text-slate-200">Market Prices</h3>
        <div className="rounded-lg bg-slate-800/50 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center text-slate-300">
                <span className="mr-2">🔋</span> Nickel
              </span>
              <span className="font-mono text-cyan-400">5-15 OCE</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center text-slate-300">
                <span className="mr-2">⚡</span> Cobalt
              </span>
              <span className="font-mono text-cyan-400">10-25 OCE</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center text-slate-300">
                <span className="mr-2">🔌</span> Copper
              </span>
              <span className="font-mono text-cyan-400">8-20 OCE</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center text-slate-300">
                <span className="mr-2">🧲</span> Manganese
              </span>
              <span className="font-mono text-cyan-400">15-35 OCE</span>
            </div>
          </div>
        </div>
      </div>
      {/* Disconnect Button */}
      {onDisconnect && (
        <button
          onClick={onDisconnect}
          className="mt-8 w-full rounded-lg bg-gradient-to-r from-cyan-700 to-slate-800 py-3 text-lg font-bold text-white shadow-lg hover:from-cyan-600 hover:to-slate-700 transition-all"
          style={{ marginTop: 'auto' }}
        >
          Disconnect
        </button>
      )}
    </div>
  )
}
