import type { PlayerStats, PlayerResources } from "@/lib/types"
import { getSubmarineByTier } from "@/lib/submarine-tiers"

interface PlayerHUDProps {
  stats: PlayerStats
  resources: PlayerResources
  tier: number
}

export function PlayerHUD({ stats, resources, tier }: PlayerHUDProps) {
  const submarineData = getSubmarineByTier(tier)

  return (
    <div className="absolute left-4 top-4 z-20 rounded-lg bg-slate-900/70 p-4 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-cyan-400">SUBMARINE STATUS</h2>
        <div className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-cyan-400">
          TIER {tier}: {submarineData.name}
        </div>
      </div>

      <div className="space-y-2">
        <StatBar 
          label="ENERGY" 
          value={stats.energy} 
          maxValue={submarineData.baseStats.energy} 
          color={stats.energy <= 0 ? "bg-red-500" : stats.energy <= 20 ? "bg-orange-500" : "bg-yellow-500"} 
          pulse={stats.energy <= 0}
        />

        <div className="mt-4 border-t border-slate-700 pt-2">
          <h3 className="mb-2 text-sm font-bold text-cyan-400">CARGO</h3>
          <div className="grid grid-cols-2 gap-2">
            <ResourceBar
              label="NICKEL"
              value={stats.capacity.nickel}
              maxValue={stats.maxCapacity.nickel}
              color="bg-slate-400"
            />
            <ResourceBar
              label="COBALT"
              value={stats.capacity.cobalt}
              maxValue={stats.maxCapacity.cobalt}
              color="bg-blue-500"
            />
            <ResourceBar
              label="COPPER"
              value={stats.capacity.copper}
              maxValue={stats.maxCapacity.copper}
              color="bg-orange-500"
            />
            <ResourceBar
              label="MANGANESE"
              value={stats.capacity.manganese}
              maxValue={stats.maxCapacity.manganese}
              color="bg-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">DEPTH</span>
          <span className="font-mono text-sm text-cyan-400">{stats.depth}m</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">SPEED</span>
          <span className="font-mono text-sm text-cyan-400">x{stats.speed.toFixed(1)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">MINING RATE</span>
          <span className="font-mono text-sm text-cyan-400">x{stats.miningRate.toFixed(1)}</span>
        </div>

        {submarineData.specialAbility && (
          <div className="mt-2 rounded-md bg-cyan-900/30 p-2 text-xs text-cyan-300">
            <span className="font-bold">SPECIAL:</span> {submarineData.specialAbility}
          </div>
        )}
      </div>
    </div>
  )
}

interface StatBarProps {
  label: string
  value: number
  maxValue: number
  color: string
  pulse?: boolean
}

function StatBar({ label, value, maxValue, color, pulse = false }: StatBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100))

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="font-mono text-sm text-cyan-400">
          {value}/{maxValue}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-700">
        <div 
          className={`h-full rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  )
}

interface ResourceBarProps {
  label: string
  value: number
  maxValue: number
  color: string
}

function ResourceBar({ label, value, maxValue, color }: ResourceBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100))

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-300">{label}</span>
        <span className="font-mono text-xs text-cyan-400">
          {value}/{maxValue}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-700">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
