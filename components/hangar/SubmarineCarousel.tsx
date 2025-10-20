"use client"

import { useState, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { PlayerResources } from "@/lib/types"
import { SUBMARINE_TIERS } from "@/lib/submarine-tiers"
import { SubmarineCard3D } from "./SubmarineCard3D"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * SubmarineCarousel Component
 * 
 * 3D carousel display for submarines with smooth animations.
 * Each submarine is displayed in a holographic card with:
 * - 3D model preview (using Three.js via SubmarineCard3D)
 * - Stats and capabilities
 * - Buy/Upgrade buttons
 * 
 * Data Source: SUBMARINE_TIERS array from Supabase
 */

interface SubmarineCarouselProps {
  currentTier: number
  resources: PlayerResources
  balance: number
  isUpgrading: boolean
  onPurchase: (targetTier: number) => void
}

export function SubmarineCarousel({
  currentTier,
  resources,
  balance,
  isUpgrading,
  onPurchase,
}: SubmarineCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(currentTier - 1)
  const [direction, setDirection] = useState(0)

  const handleNext = () => {
    if (selectedIndex < SUBMARINE_TIERS.length - 1) {
      setDirection(1)
      setSelectedIndex((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (selectedIndex > 0) {
      setDirection(-1)
      setSelectedIndex((prev) => prev - 1)
    }
  }

  const handleSelectTier = (index: number) => {
    setDirection(index > selectedIndex ? 1 : -1)
    setSelectedIndex(index)
  }

  return (
    <div className="relative">
      {/* Tier Navigator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {SUBMARINE_TIERS.map((sub, idx) => {
          const isOwned = sub.tier < currentTier
          const isCurrent = sub.tier === currentTier
          const isSelected = idx === selectedIndex

          return (
            <button
              key={sub.tier}
              onClick={() => handleSelectTier(idx)}
              className={`relative group transition-all duration-300 ${
                isSelected ? "scale-110" : "scale-100 hover:scale-105"
              }`}
            >
              {/* Glow effect for selected */}
              {isSelected && (
                <div className="absolute inset-0 bg-cyan-500 rounded-full blur-md opacity-50 animate-pulse" />
              )}
              
              <div
                className={`relative w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all
                  ${isSelected 
                    ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/50" 
                    : isCurrent
                    ? "bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300"
                    : isOwned
                    ? "bg-green-500/20 border-2 border-green-500/50 text-green-400"
                    : "bg-slate-800 border-2 border-slate-600 text-slate-400"
                  }`}
              >
                {sub.tier}
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 
                              transition-opacity pointer-events-none whitespace-nowrap">
                <div className="bg-slate-900 text-xs text-cyan-300 px-3 py-1 rounded-lg border border-cyan-500/30">
                  {sub.name}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Main Carousel Container */}
      <div className="relative min-h-[700px] flex items-center justify-center">
        {/* Previous Button */}
        <button
          onClick={handlePrev}
          disabled={selectedIndex === 0}
          className={`absolute left-0 z-20 p-4 rounded-full transition-all duration-300
            ${selectedIndex === 0 
              ? "bg-slate-800/30 text-slate-600 cursor-not-allowed" 
              : "bg-slate-800/80 text-cyan-400 hover:bg-slate-700 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/20"
            }`}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        {/* Carousel Content */}
        <div className="relative w-full max-w-6xl h-[700px] overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={selectedIndex}
              custom={direction}
              initial={{ 
                x: direction > 0 ? 1000 : -1000,
                opacity: 0,
                scale: 0.8,
                rotateY: direction > 0 ? 45 : -45
              }}
              animate={{ 
                x: 0, 
                opacity: 1, 
                scale: 1,
                rotateY: 0
              }}
              exit={{ 
                x: direction > 0 ? -1000 : 1000,
                opacity: 0,
                scale: 0.8,
                rotateY: direction > 0 ? -45 : 45
              }}
              transition={{ 
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Suspense fallback={<LoadingFallback />}>
                <SubmarineCard3D
                  submarine={SUBMARINE_TIERS[selectedIndex]}
                  currentTier={currentTier}
                  resources={resources}
                  balance={balance}
                  isUpgrading={isUpgrading}
                  onPurchase={onPurchase}
                />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={selectedIndex === SUBMARINE_TIERS.length - 1}
          className={`absolute right-0 z-20 p-4 rounded-full transition-all duration-300
            ${selectedIndex === SUBMARINE_TIERS.length - 1
              ? "bg-slate-800/30 text-slate-600 cursor-not-allowed" 
              : "bg-slate-800/80 text-cyan-400 hover:bg-slate-700 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/20"
            }`}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

      {/* Navigation Hint */}
      <div className="text-center mt-8">
        <p className="text-sm text-slate-500">
          Use <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600 text-cyan-400">←</kbd>{" "}
          <kbd className="px-2 py-1 bg-slate-800 rounded border border-slate-600 text-cyan-400">→</kbd>{" "}
          or click tier numbers to navigate
        </p>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-cyan-400 animate-pulse">Loading Submarine...</p>
      </div>
    </div>
  )
}
