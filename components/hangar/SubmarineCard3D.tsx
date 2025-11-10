"use client"

import { motion } from "framer-motion"
import SubmarineIcon from "@/components/SubmarineIcon"
import type { SubmarineTier } from "@/lib/submarine-tiers"
import type { PlayerResources } from "@/lib/types"
import { hasEnoughResourcesForUpgrade } from "@/lib/resource-utils"
import { Lock, Star, Zap, Gauge, Battery, Anchor, Drill } from "lucide-react"

/**
 * TESTING MODE: Set to true to unlock ALL submarines for testing
 * TODO: Set back to false before production deployment
 */
const TESTING_MODE_UNLOCK_ALL = false

/**
 * SubmarineCard3D Component
 * 
 * Displays a single submarine in a 3D holographic card with:
 * - Three.js 3D submarine model with rotating display
 * - Detailed stats (storage, performance, mining)
 * - Status indicators (owned, current, available, locked)
 * - Purchase/Upgrade action button
 * 
 * Purchase Logic: Validates resources and calls onPurchase callback
 * which triggers Ethers.js blockchain transaction
 */

interface SubmarineCard3DProps {
  submarine: SubmarineTier
  currentTier: number
  resources: PlayerResources
  balance: number
  isUpgrading: boolean
  onPurchase: (targetTier: number) => void
}

export function SubmarineCard3D({
  submarine,
  currentTier,
  resources,
  balance,
  isUpgrading,
  onPurchase,
}: SubmarineCard3DProps) {
  const getTierStatus = () => {
    // TESTING MODE: Treat all submarines as available when testing
    if (TESTING_MODE_UNLOCK_ALL) {
      if (submarine.tier === currentTier) return "current"
      return "available"
    }
    
    if (submarine.tier < currentTier) return "owned"
    if (submarine.tier === currentTier) return "current"
    if (submarine.tier === currentTier + 1) return "available"
    return "locked"
  }

  const status = getTierStatus()
  const canAfford = submarine.tier > currentTier && hasEnoughResourcesForUpgrade(resources, balance, submarine.upgradeCost)

  const getStatusConfig = () => {
    switch (status) {
      case "owned":
        return {
          color: "from-green-500 to-emerald-600",
          borderColor: "border-green-500/50",
          icon: <Star className="w-5 h-5 text-green-400 fill-current" />,
          text: "OWNED",
          textColor: "text-green-400"
        }
      case "current":
        return {
          color: "from-cyan-500 to-blue-600",
          borderColor: "border-cyan-400",
          icon: <Zap className="w-5 h-5 text-cyan-400 fill-current" />,
          text: "ACTIVE",
          textColor: "text-cyan-400"
        }
      case "available":
        return canAfford
          ? {
              color: "from-blue-500 to-indigo-600",
              borderColor: "border-blue-400/50",
              icon: <div className="w-5 h-5 rounded-full bg-blue-400 animate-pulse" />,
              text: "AVAILABLE",
              textColor: "text-blue-400"
            }
          : {
              color: "from-slate-700 to-slate-800",
              borderColor: "border-slate-600",
              icon: <Lock className="w-5 h-5 text-slate-500" />,
              text: "INSUFFICIENT FUNDS",
              textColor: "text-slate-400"
            }
      case "locked":
        return {
          color: "from-slate-800 to-slate-900",
          borderColor: "border-slate-700",
          icon: <Lock className="w-5 h-5 text-slate-500" />,
          text: "LOCKED",
          textColor: "text-slate-500"
        }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-5xl">
        {/* Main Card Container */}
        <div className={`relative rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 
                         backdrop-blur-xl border-2 ${statusConfig.borderColor} 
                         shadow-2xl overflow-hidden`}>
          {/* Animated border glow */}
          <div className={`absolute inset-0 bg-gradient-to-r ${statusConfig.color} opacity-10 animate-pulse pointer-events-none`} />
          
          {/* Legendary Badge */}
          {submarine.tier >= 8 && (
            <div className="absolute top-6 left-6 z-10">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full blur-lg opacity-75 animate-pulse" />
                <div className="relative px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 
                                text-black font-bold text-sm uppercase tracking-wider shadow-lg">
                  ★ LEGENDARY ★
                </div>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-6 right-6 z-10">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 backdrop-blur-md 
                             border ${statusConfig.borderColor} ${statusConfig.textColor}`}>
              {statusConfig.icon}
              <span className="font-bold text-sm uppercase tracking-wider">{statusConfig.text}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 p-8">
            {/* Left Column - SVG Icon (replaces 3D model) */}
            <div className="relative">
              <div className="relative h-96 rounded-2xl bg-slate-950/50 border border-cyan-500/20 overflow-hidden flex items-center justify-center">
                {/* SVG Submarine Icon centered in holographic card */}
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 12 }}
                  className="flex items-center justify-center w-full h-full p-6"
                >
                  <div className="rounded-xl p-4 bg-gradient-to-b from-cyan-900/10 to-transparent backdrop-blur-sm">
                    <SubmarineIcon tier={submarine.tier} size={240} />
                  </div>
                </motion.div>

                {/* removed holographic overlay per request - clean icon display */}
              </div>

              {/* Submarine Name */}
              <div className="mt-4 text-center">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {submarine.name}
                </h3>
                <p className="text-sm text-slate-400 mt-1">{submarine.description}</p>
              </div>

              {/* Special Ability */}
              {submarine.specialAbility && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 p-4 rounded-xl bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Special Ability</span>
                  </div>
                  <p className="text-sm text-cyan-300">{submarine.specialAbility}</p>
                </motion.div>
              )}
            </div>

            {/* Right Column - Stats and Actions */}
            <div className="flex flex-col justify-between">
              {/* Stats Grid */}
              <div className="space-y-4">
                {/* Performance Stats */}
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-700/50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Gauge className="w-4 h-4" />
                    Performance
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <StatItem label="Health" value={submarine.baseStats.health} color="text-red-400" />
                    <StatItem label="Energy" value={submarine.baseStats.energy} color="text-yellow-400" />
                    <StatItem label="Max Depth" value={`${submarine.baseStats.depth}m`} color="text-cyan-400" />
                    <StatItem label="Speed" value={`x${submarine.baseStats.speed.toFixed(1)}`} color="text-green-400" />
                  </div>
                </div>

                {/* Mining Stats */}
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-700/50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Drill className="w-4 h-4" />
                    Mining Capabilities
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <StatItem label="Mining Rate" value={`x${submarine.baseStats.miningRate.toFixed(1)}`} color="text-cyan-400" />
                    <StatItem 
                      label="Total Storage" 
                      value={
                        submarine.baseStats.maxCapacity.nickel +
                        submarine.baseStats.maxCapacity.cobalt +
                        submarine.baseStats.maxCapacity.copper +
                        submarine.baseStats.maxCapacity.manganese
                      } 
                      color="text-blue-400" 
                    />
                  </div>
                </div>

                {/* Storage Capacity */}
                <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-700/50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Anchor className="w-4 h-4" />
                    Storage Capacity
                  </h4>
                  <div className="space-y-2">
                    <StorageBar label="Nickel" value={submarine.baseStats.maxCapacity.nickel} color="bg-slate-500" />
                    <StorageBar label="Cobalt" value={submarine.baseStats.maxCapacity.cobalt} color="bg-blue-500" />
                    <StorageBar label="Copper" value={submarine.baseStats.maxCapacity.copper} color="bg-orange-500" />
                    <StorageBar label="Manganese" value={submarine.baseStats.maxCapacity.manganese} color="bg-purple-500" />
                  </div>
                </div>

                {/* Upgrade Cost */}
                {submarine.tier > currentTier && (
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-700/50">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Battery className="w-4 h-4" />
                      Upgrade Cost
                    </h4>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">OCE Tokens:</span>
                      <span className={`text-2xl font-bold ${
                        balance >= submarine.upgradeCost.tokens ? "text-green-400" : "text-red-400"
                      }`}>
                        {submarine.upgradeCost.tokens.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {status === "available" && (
                <motion.button
                  whileHover={{ scale: (canAfford || TESTING_MODE_UNLOCK_ALL) && !isUpgrading ? 1.02 : 1 }}
                  whileTap={{ scale: (canAfford || TESTING_MODE_UNLOCK_ALL) && !isUpgrading ? 0.98 : 1 }}
                  onClick={() => {
                    // TESTING MODE: Allow purchasing any submarine
                    if ((canAfford || TESTING_MODE_UNLOCK_ALL) && !isUpgrading) {
                      onPurchase(submarine.tier)
                    }
                  }}
                  disabled={!(canAfford || TESTING_MODE_UNLOCK_ALL) || isUpgrading}
                  className={`mt-4 w-full py-4 rounded-xl font-bold text-lg uppercase tracking-wider
                    transition-all duration-300 relative overflow-hidden
                    ${(canAfford || TESTING_MODE_UNLOCK_ALL) && !isUpgrading
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70"
                      : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
                    }`}
                >
                  {isUpgrading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Upgrading...
                    </span>
                  ) : (canAfford || TESTING_MODE_UNLOCK_ALL) ? (
                    TESTING_MODE_UNLOCK_ALL ? "Deploy Submarine (Testing)" : "Deploy Submarine"
                  ) : (
                    "Insufficient Resources"
                  )}
                  
                  {(canAfford || TESTING_MODE_UNLOCK_ALL) && !isUpgrading && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                                    transform -skew-x-12 -translate-x-full group-hover:translate-x-full 
                                    transition-transform duration-700" />
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Decorative corner elements */}
        <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400 opacity-50" />
        <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400 opacity-50" />
        <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400 opacity-50" />
        <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400 opacity-50" />
      </div>
    </motion.div>
  )
}

function StatItem({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  )
}

function StorageBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-24">{label}:</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
      <span className="text-sm font-mono text-slate-300 w-16 text-right">{value}</span>
    </div>
  )
}
