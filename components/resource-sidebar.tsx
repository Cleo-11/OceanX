"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { GameState, PlayerStats, PlayerResources, ResourceType } from "@/lib/types"
import { UserProfile } from "./user-profile"
import { HOLD_COLORS } from "./player-hud"

interface ResourceSidebarProps {
  isOpen: boolean
  resources: PlayerResources
  balance: number
  onTradeAll: () => void
  onClaimOcx?: () => void
  gameState: GameState
  playerStats: PlayerStats
  walletAddress: string
  walletConnected: boolean
  onDisconnect?: () => void
}

/**
 * Prices paid by "Sell the hold" (/api/marketplace/trade-resources). Each
 * resource's total is rounded down to a whole OCX there, so mirror that.
 */
const SELL_PRICE: Record<ResourceType, number> = { nickel: 0.1, cobalt: 0.5, copper: 1, manganese: 2 }
const ROWS: { type: ResourceType; label: string }[] = [
  { type: "nickel", label: "Nickel" },
  { type: "cobalt", label: "Cobalt" },
  { type: "copper", label: "Copper" },
  { type: "manganese", label: "Manganese" },
]
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 })

export function ResourceSidebar({
  isOpen,
  resources,
  balance,
  onTradeAll,
  onClaimOcx,
  gameState,
  playerStats,
  walletAddress,
  walletConnected,
  onDisconnect,
}: ResourceSidebarProps) {
  const router = useRouter()
  const [tab, setTab] = useState<"hold" | "profile">("hold")
  const isTrading = gameState === "trading" || gameState === "resourceTraded"
  const isClaiming = gameState === "claiming" || gameState === "claimed"
  // One action at a time (lib/state-machines/game-action.ts).
  const isBusy = gameState !== "idle"

  const used = ROWS.reduce((sum, r) => sum + resources[r.type], 0)
  const saleValue = ROWS.reduce((sum, r) => sum + Math.floor(resources[r.type] * SELL_PRICE[r.type]), 0)

  return (
    <aside
      aria-label="Dive menu"
      aria-hidden={!isOpen}
      className={`dive-hud pointer-events-auto fixed right-0 top-0 z-50 flex h-full w-[22rem] max-w-[92vw] flex-col border-l border-[var(--rule)] bg-[var(--panel-solid)] transition-transform duration-300 motion-reduce:transition-none ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div role="tablist" aria-label="Menu sections" className="flex gap-6 border-b border-[var(--rule)] px-5 pt-4">
        <button type="button" role="tab" aria-selected={tab === "hold"} className="dive-tab" onClick={() => setTab("hold")}>
          Hold and wallet
        </button>
        <button type="button" role="tab" aria-selected={tab === "profile"} className="dive-tab" onClick={() => setTab("profile")}>
          Profile
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === "hold" ? (
          <>
            <section aria-labelledby="hold-heading">
              <div className="flex items-baseline justify-between">
                <h2 id="hold-heading" className="text-base font-semibold">
                  Hold
                </h2>
                <span className="text-xs text-[var(--ink-dim)]">price per unit</span>
              </div>
              <ul className="mt-2">
                {ROWS.map(({ type, label }) => (
                  <li key={type} className="dive-row border-b border-[var(--rule)] last:border-0">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: HOLD_COLORS[type] }} />
                      <span className="text-[var(--ink)]">{label}</span>
                      <span className="text-xs text-[var(--ink-dim)]">
                        {fmt(resources[type])} / {fmt(playerStats.maxCapacity[type])}
                      </span>
                    </span>
                    <span className="text-[var(--ink-dim)]">{SELL_PRICE[type]} OCX</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onTradeAll}
                disabled={isBusy || saleValue <= 0}
                className="dive-btn mt-4 w-full"
              >
                {isTrading ? "Selling…" : saleValue > 0 ? `Sell the hold for ${fmt(saleValue)} OCX` : "Nothing to sell yet"}
              </button>
              {used > 0 && saleValue <= 0 && (
                <p className="mt-2 text-xs text-[var(--ink-dim)]">
                  Each resource sells in whole OCX, so a few units of nickel or cobalt are not worth anything yet.
                </p>
              )}
            </section>

            <hr className="dive-rule my-6" />

            <section aria-labelledby="wallet-heading">
              <h2 id="wallet-heading" className="text-base font-semibold">
                OCX
              </h2>
              <div className="dive-row mt-1">
                <span>Earned in the game</span>
                <span className="text-lg text-[var(--ink)]">{fmt(balance)}</span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--ink-dim)]">
                Claiming mints this OCX to your wallet, where you can spend it on upgrades. Your wallet pays the network fee.
              </p>
              {onClaimOcx && (
                <button
                  type="button"
                  onClick={onClaimOcx}
                  disabled={isBusy || !walletConnected || balance <= 0}
                  className="dive-btn dive-btn--warm mt-3 w-full"
                >
                  {isClaiming ? "Claiming…" : balance > 0 ? `Claim ${fmt(balance)} OCX to wallet` : "No OCX to claim"}
                </button>
              )}
            </section>
          </>
        ) : (
          <UserProfile walletAddress={walletAddress} resources={resources} />
        )}
      </div>

      <div className="flex gap-3 border-t border-[var(--rule)] px-5 py-4">
        <button type="button" onClick={() => router.push("/home")} className="dive-btn dive-btn--quiet flex-1">
          Surface to home
        </button>
        {onDisconnect && (
          <button type="button" onClick={onDisconnect} className="dive-btn dive-btn--quiet flex-1">
            Sign out
          </button>
        )}
      </div>
    </aside>
  )
}
