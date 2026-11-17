"use client"

import { useEffect, useRef } from "react"
import type { GameState, PlayerResources } from "@/lib/types"
import { getSubmarineByTier, SUBMARINE_TIERS } from "@/lib/submarine-tiers"

interface UpgradeModalProps {
  currentTier: number
  resources: PlayerResources
  /** OCX earned in the game and not yet claimed to the wallet. */
  balance: number
  onUpgrade: (tier: number) => void
  onClose: () => void
  gameState: GameState
  /** Live progress text while an upgrade is in flight (e.g. "Step 1 of 2 — approve..."). */
  statusText?: string
}

const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits })
const hold = (t: (typeof SUBMARINE_TIERS)[number]) =>
  t.baseStats.maxCapacity.nickel + t.baseStats.maxCapacity.cobalt + t.baseStats.maxCapacity.copper + t.baseStats.maxCapacity.manganese

/**
 * Upgrade to the next tier. The UpgradeManager contract only allows one tier
 * at a time, so there is nothing to choose: this shows what changes and what
 * it costs. The OCX is paid from the wallet (the game checks it before asking
 * for any signature).
 */
export function UpgradeModal({ currentTier, balance, onUpgrade, onClose, gameState, statusText }: UpgradeModalProps) {
  const current = getSubmarineByTier(currentTier)
  const next = SUBMARINE_TIERS.find((t) => t.tier === currentTier + 1)
  const isUpgrading = gameState === "upgrading"
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUpgrading) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isUpgrading, onClose])

  const rows = next
    ? [
        { label: "Hull", from: current.baseStats.health, to: next.baseStats.health, unit: "" },
        { label: "Battery", from: current.baseStats.energy, to: next.baseStats.energy, unit: "" },
        { label: "Hold", from: hold(current), to: hold(next), unit: "" },
        { label: "Speed", from: current.baseStats.speed, to: next.baseStats.speed, unit: "×", digits: 1 },
        { label: "Drill", from: current.baseStats.miningRate, to: next.baseStats.miningRate, unit: "×", digits: 1 },
        { label: "Rated depth", from: current.baseStats.depth, to: next.baseStats.depth, unit: " m" },
      ]
    : []

  return (
    <div className="dive-hud fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(4,18,21,0.62)] p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        className="dive-panel w-full max-w-lg bg-[var(--panel-solid)] p-6 outline-none"
      >
        {!next ? (
          <>
            <h2 id="upgrade-title" className="text-xl font-semibold">
              {current.name} is the deepest-rated submarine
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-dim)]">There are no further upgrades.</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={onClose} className="dive-btn dive-btn--quiet">
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-[var(--ink-dim)]">Upgrade from tier {currentTier}</p>
            <h2 id="upgrade-title" className="mt-1 text-2xl font-semibold">
              {next.name}
            </h2>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-[var(--ink-dim)]">{next.description}</p>

            <table className="mt-5 w-full text-sm">
              <caption className="sr-only">What changes</caption>
              <thead>
                <tr className="text-xs text-[var(--ink-dim)]">
                  <th scope="col" className="pb-1 text-left font-normal" />
                  <th scope="col" className="pb-1 text-right font-normal">{current.name}</th>
                  <th scope="col" className="pb-1 text-right font-normal">{next.name}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-[var(--rule)]">
                    <th scope="row" className="py-1.5 text-left font-normal text-[var(--ink-dim)]">{r.label}</th>
                    <td className="py-1.5 text-right text-[var(--ink-dim)]">{fmt(r.from, r.digits)}{r.unit}</td>
                    <td className="py-1.5 text-right">
                      {fmt(r.to, r.digits)}
                      {r.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 flex items-baseline justify-between border-t border-[var(--rule)] pt-4">
              <span className="text-sm text-[var(--ink-dim)]">Cost, paid from your wallet</span>
              <span className="text-xl font-semibold text-[var(--lamp)]">{fmt(next.upgradeCost.tokens)} OCX</span>
            </div>
            {balance > 0 && (
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
                You also have {fmt(balance, 2)} OCX earned in the game. Claim it from the menu first if your wallet is short.
              </p>
            )}

            {isUpgrading && statusText && (
              <p role="status" aria-live="polite" className="mt-4 border-l-2 border-[var(--lamp)] pl-3 text-sm">
                {statusText}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={isUpgrading} className="dive-btn dive-btn--quiet">
                Not now
              </button>
              <button
                type="button"
                onClick={() => onUpgrade(next.tier)}
                disabled={isUpgrading || gameState !== "idle"}
                className="dive-btn dive-btn--warm"
              >
                {isUpgrading ? "Upgrading…" : `Upgrade for ${fmt(next.upgradeCost.tokens)} OCX`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
