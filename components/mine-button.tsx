"use client"

import type { GameState, ResourceType } from "@/lib/types"
import { HOLD_COLORS } from "./player-hud"

interface MineButtonProps {
  onClick: () => void
  disabled: boolean
  gameState: GameState
  resourceType: ResourceType
  resourceAmount: number
}

const DEPOSIT_NAMES: Record<ResourceType, string> = {
  nickel: "Nickel nodules",
  cobalt: "Cobalt crust",
  copper: "Copper nodules",
  manganese: "Manganese nodules",
}

/** Appears when a deposit is within reach of the drill. */
export function MineButton({ onClick, disabled, gameState, resourceType, resourceAmount }: MineButtonProps) {
  const isMining = gameState === "mining"

  return (
    <div className="dive-hud dive-panel pointer-events-auto flex items-center gap-5 py-2.5 pl-4 pr-2.5">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: HOLD_COLORS[resourceType] }} />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-[var(--ink)]">{DEPOSIT_NAMES[resourceType]}</p>
          <p className="text-xs text-[var(--ink-dim)]">{resourceAmount} units in reach</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-keyshortcuts="F"
        className="dive-action flex items-center gap-2.5 px-4 py-2 text-sm font-semibold"
      >
        {isMining ? "Drilling…" : "Mine"}
        {!isMining && <kbd className="dive-key">F</kbd>}
      </button>
    </div>
  )
}
