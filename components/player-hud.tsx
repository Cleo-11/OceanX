import type { PlayerStats, PlayerResources } from "@/lib/types"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { motion } from "framer-motion"

interface PlayerHUDProps {
  stats: PlayerStats;
  tier: number;
  resources?: PlayerResources; // Live resources for instant UI updates
}

export function PlayerHUD({ stats, tier, resources }: PlayerHUDProps) {
  const submarineData = getSubmarineByTier(tier);
  return (
    <motion.div
      className="absolute left-4 top-4 z-20 rounded-2xl bg-gradient-to-br from-slate-900/70 to-cyan-900/60 p-6 shadow-xl backdrop-blur-lg border border-cyan-400/20"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, type: "spring" }}
      style={{ boxShadow: "0 4px 32px 0 #22d3ee33, 0 1.5px 8px 0 #38bdf822" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-cyan-400 drop-shadow">SUBMARINE STATUS</h2>
        <motion.div
          className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs font-bold text-cyan-400 shadow-cyan-400/30 shadow"
          whileHover={{ scale: 1.08, rotate: 2 }}
          whileTap={{ scale: 0.95, rotate: -2 }}
        >
          TIER {tier}: {submarineData.name}
        </motion.div>
      </div>
      <div className="space-y-2">
        <StatBar 
          label="ENERGY" 
          value={stats.energy} 
          maxValue={submarineData.baseStats.energy} 
          color={stats.energy <= 0 ? "bg-red-500" : stats.energy <= 20 ? "bg-orange-500" : "bg-yellow-500"} 
          pulse={stats.energy <= 0}
        />
        
        <div className="mt-4 border-t border-cyan-400/20 pt-2">
          <h3 className="mb-2 text-sm font-bold text-cyan-400">CARGO</h3>
          <div className="grid grid-cols-2 gap-2">
            <ResourceBar
              label="NICKEL"
              value={resources?.nickel ?? 0}
              maxValue={stats.maxCapacity.nickel}
              color="bg-slate-400"
            />
            <ResourceBar
              label="COBALT"
              value={resources?.cobalt ?? 0}
              maxValue={stats.maxCapacity.cobalt}
              color="bg-blue-500"
            />
            <ResourceBar
              label="COPPER"
              value={resources?.copper ?? 0}
              maxValue={stats.maxCapacity.copper}
              color="bg-orange-500"
            />
            <ResourceBar
              label="MANGANESE"
              value={resources?.manganese ?? 0}
              maxValue={stats.maxCapacity.manganese}
              color="bg-purple-500"
            />
          </div>
        </div>
        <motion.div className="flex items-center justify-between" whileHover={{ scale: 1.04 }}>
          <span className="text-sm text-slate-300">DEPTH</span>
          <span className="font-mono text-sm text-cyan-400">{stats.depth}m</span>
        </motion.div>
        <motion.div className="flex items-center justify-between" whileHover={{ scale: 1.04 }}>
          <span className="text-sm text-slate-300">SPEED</span>
          <span className="font-mono text-sm text-cyan-400">x{stats.speed.toFixed(1)}</span>
        </motion.div>
        <motion.div className="flex items-center justify-between" whileHover={{ scale: 1.04 }}>
          <span className="text-sm text-slate-300">MINING RATE</span>
          <span className="font-mono text-sm text-cyan-400">x{stats.miningRate.toFixed(1)}</span>
        </motion.div>
        {submarineData.specialAbility && (
          <motion.div className="mt-2 rounded-md bg-cyan-900/30 p-2 text-xs text-cyan-300" whileHover={{ scale: 1.05 }}>
            <span className="font-bold">SPECIAL:</span> {submarineData.specialAbility}
          </motion.div>
        )}
      </div>
    </motion.div>

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
