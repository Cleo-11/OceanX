"use client"

import type { GameState, ResourceType } from "@/lib/types"
import { getResourceColor, getResourceEmoji } from "@/lib/resource-utils"

interface MineButtonProps {
  onClick: () => void
  disabled: boolean
  gameState: GameState
  resourceType: ResourceType
  resourceAmount: number
}

export function MineButton({ onClick, disabled, gameState, resourceType, resourceAmount }: MineButtonProps) {
  const isMining = gameState === "mining"
  const resourceColor = getResourceColor(resourceType)
  const resourceIcon = getResourceEmoji(resourceType)

  return (
    <div className="pointer-events-auto absolute bottom-8 left-1/2 z-20 -translate-x-1/2 transform">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`relative rounded-full bg-gradient-to-r from-cyan-600 to-teal-600 p-1 font-bold text-white shadow-lg shadow-cyan-900/30 transition-all hover:shadow-cyan-900/50 disabled:opacity-70 ${
          isMining ? "animate-pulse" : ""
        }`}
        style={{
          background: isMining ? undefined : `linear-gradient(to right, ${resourceColor}, #0d9488)`,
        }}
      >
        <div className="rounded-full bg-slate-900/80 px-8 py-4 backdrop-blur-sm">
          {isMining ? (
            "MINING..."
          ) : (
            <>
              MINE {resourceIcon} {resourceType.toUpperCase()} ({resourceAmount})
            </>
          )}
        </div>

        {/* Decorative elements */}
        <div className="absolute -left-4 top-1/2 h-1 w-8 -translate-y-1/2 transform rounded-full bg-cyan-500/50" />
        <div className="absolute -right-4 top-1/2 h-1 w-8 -translate-y-1/2 transform rounded-full bg-cyan-500/50" />
      </button>
    </div>
  )
}
