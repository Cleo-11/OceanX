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
        className={`relative flex items-center gap-2 rounded-full border-4 border-yellow-300 bg-gradient-to-br from-cyan-400 via-teal-300 to-blue-400 px-8 py-4 font-extrabold text-white text-lg shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-60 ${isMining ? "animate-bounce" : ""}`}
        style={{
          boxShadow: "0 8px 24px 0 rgba(0, 200, 255, 0.25)",
        }}
      >
        {/* Cartoon pickaxe SVG */}
        <span className="mr-2">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="6" width="4" height="20" rx="2" fill="#fbbf24" stroke="#22223b" strokeWidth="2" />
            <path d="M16 6 Q18 2 28 8 Q18 10 16 6" fill="#60a5fa" stroke="#22223b" strokeWidth="2" />
            <ellipse cx="16" cy="26" rx="3" ry="2" fill="#bae6fd" />
          </svg>
        </span>
        <span className="drop-shadow-lg">
          {isMining ? (
            "MINING..."
          ) : (
            <>
              MINE {resourceIcon} {resourceType.toUpperCase()} ({resourceAmount})
            </>
          )}
        </span>
        {/* Bubbly cartoon effects */}
        <span className="absolute -top-4 left-1/2 -translate-x-1/2">
          <svg width="40" height="16" viewBox="0 0 40 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="8" cy="8" rx="8" ry="6" fill="#bae6fd" opacity="0.5" />
            <ellipse cx="32" cy="8" rx="6" ry="4" fill="#60a5fa" opacity="0.4" />
          </svg>
        </span>
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2">
          <svg width="32" height="12" viewBox="0 0 32 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="16" cy="6" rx="12" ry="5" fill="#fbbf24" opacity="0.3" />
          </svg>
        </span>
      </button>
    </div>
  );
}
