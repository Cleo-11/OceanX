"use client"

import { motion } from "framer-motion"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { Waves, Anchor } from "lucide-react"

/**
 * HangarHeader Component
 * 
 * Displays the main hangar title and current submarine information
 * with animated entrance effects
 */

interface HangarHeaderProps {
  currentTier: number
}

export function HangarHeader({ currentTier }: HangarHeaderProps) {
  const currentSubmarine = getSubmarineByTier(currentTier)

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="text-center mb-12"
    >
      {/* Main Title */}
      <div className="relative inline-block mb-6">
        <div className="absolute inset-0 bg-cyan-500/20 blur-2xl animate-pulse" />
        <h2 className="relative text-6xl font-black bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-300 
                       bg-clip-text text-transparent tracking-tight">
          HANGAR BAY
        </h2>
      </div>

      {/* Subtitle */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <div className="h-px w-20 bg-gradient-to-r from-transparent to-cyan-500/50" />
        <div className="flex items-center gap-2 text-slate-400">
          <Anchor className="w-4 h-4" />
          <span className="text-sm uppercase tracking-widest">Deep Sea Operations Center</span>
          <Waves className="w-4 h-4" />
        </div>
        <div className="h-px w-20 bg-gradient-to-l from-transparent to-cyan-500/50" />
      </div>

      {/* Current Submarine Display */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="inline-block mt-6"
      >
        <div className="relative group">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl 
                          group-hover:blur-2xl transition-all duration-500" />
          
          {/* Card */}
          <div className="relative px-8 py-4 rounded-2xl bg-slate-900/50 backdrop-blur-md 
                          border border-cyan-500/30 shadow-xl">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Currently Deployed</div>
            <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text">
              {currentSubmarine.name}
            </div>
            <div className="mt-2 flex items-center justify-center gap-3 text-sm">
              <span className="text-slate-500">Classification:</span>
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-medium">
                TIER {currentTier}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Decorative Elements */}
      <div className="mt-8 flex items-center justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '0.6s' }} />
      </div>
    </motion.div>
  )
}
