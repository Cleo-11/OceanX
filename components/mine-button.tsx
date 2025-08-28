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
  const isMining = gameState === "mining";
  const resourceColor = getResourceColor(resourceType);
  const resourceIcon = getResourceEmoji(resourceType);

  return (
    <div className="pointer-events-auto absolute bottom-8 left-1/2 z-30 -translate-x-1/2 transform">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`relative flex items-center gap-2 rounded-full border-2 border-cyan-400 bg-gradient-to-br from-cyan-500 via-teal-400 to-blue-500 px-6 py-2 font-bold text-white text-base shadow-lg hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-60 ${isMining ? "animate-pulse" : ""}`}
        style={{
          boxShadow: "0 4px 16px 0 rgba(0, 200, 255, 0.18)",
        }}
      >
        {/* Sleek pickaxe icon */}
        <span className="mr-1">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="6" width="4" height="14" rx="2" fill="#fbbf24" stroke="#22223b" strokeWidth="1.5" />
            <path d="M16 6 Q18 2 28 8 Q18 10 16 6" fill="#60a5fa" stroke="#22223b" strokeWidth="1.5" />
            <ellipse cx="16" cy="20" rx="2.2" ry="1.2" fill="#bae6fd" />
          </svg>
        </span>
        <span className="drop-shadow">
          {isMining ? (
            "MINING..."
          ) : (
            <>
              MINE {resourceIcon} {resourceType.toUpperCase()} ({resourceAmount})
            </>
          )}
        </span>
      </button>
    </div>
  );
}
