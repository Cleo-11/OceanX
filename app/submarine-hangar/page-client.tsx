"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"
import { SUBMARINE_TIERS, getSubmarineByTier } from "@/lib/submarine-tiers"
import { 
  tryOnChainUpgrade, 
  getOCXBalanceReadOnly,
} from "@/lib/contracts"
import { walletManager } from "@/lib/wallet"
import { supabase } from "@/lib/supabase"
import { useTxLifecycle } from "@/hooks/use-tx-lifecycle"
import { classifyTxError, describeTx, explorerTxUrl, txError } from "@/lib/state-machines/tx-lifecycle"

const DryDockScene = dynamic(() => import("@/components/game3d/dry-dock-scene").then((m) => m.DryDockScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[var(--abyss)]" />,
})

const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits })
const holdOf = (t: (typeof SUBMARINE_TIERS)[number]) =>
  t.baseStats.maxCapacity.nickel + t.baseStats.maxCapacity.cobalt + t.baseStats.maxCapacity.copper + t.baseStats.maxCapacity.manganese

const UPGRADE_COMPLETE_NOTE = 'Upgrade complete! Loading your new submarine...'

/**
 * Submarine Hangar - Client Component
 * 
 * Futuristic submarine hangar interface with 3D carousel display.
 * Replicates all functionality from submarine-store but with stunning visuals:
 * - Holographic 3D submarine carousel (Three.js)
 * - Floating HUD dashboard
 * - Neon/cyan sci-fi theme
 * - Buy, upgrade, and view details actions
 * 
 * Purchase Logic:
 * - Uses Ethers.js for blockchain transactions (wallet integration)
 * - Verifies transaction on server and updates Supabase
 */

type SubmarineHangarClientProps = {
  currentTier: number
  resources: PlayerResources
  balance: number
  walletAddress: string
  userId: string
}

export default function SubmarineHangarClient({
  currentTier,
  balance: initialBalance,
  walletAddress,
}: SubmarineHangarClientProps) {
  const router = useRouter()
  // balance  = on-chain OCX in wallet (always starts at 0; fetched from chain client-side)
  // dbBalance = off-chain earned OCX in DB (total_ocx_earned; starts from server prop)
  const [balance, setBalance] = useState(0)
  const [dbBalance, setDbBalance] = useState(initialBalance)
  // One explicit lifecycle for the upgrade (lib/state-machines/tx-lifecycle.ts)
  // instead of separate isUpgrading / status-string / error-string flags that
  // could disagree with each other.
  const upgradeTx = useTxLifecycle()
  // The submarine shown in the dock. Starts on the next upgrade.
  const [selectedTier, setSelectedTier] = useState(Math.min(currentTier + 1, SUBMARINE_TIERS.length))
  const [txChainId, setTxChainId] = useState<number | null>(null)
  const upgradeSucceeded = upgradeTx.tx.status === "succeeded"
  // Stay locked after success until the redirect to /game happens.
  const isUpgrading = upgradeTx.isBusy || upgradeSucceeded
  const upgradeStatus = isUpgrading ? describeTx(upgradeTx.tx) : null
  const upgradeError = upgradeTx.tx.status === "failed" ? upgradeTx.tx.error.message : null
  const upgradeTxHash = "txHash" in upgradeTx.tx ? upgradeTx.tx.txHash : undefined
  const upgradeTxUrl = upgradeTxHash && txChainId !== null ? explorerTxUrl(upgradeTxHash, txChainId) : null
  // Latest balances for async handlers (state captured in a closure goes stale)
  const dbBalanceRef = useRef(initialBalance)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Fetch both wallet balance (on-chain) and database balance (earned)
   * Wallet balance = what you can spend
   * DB balance = what you've earned (needs to be claimed)
   */
  const fetchBalance = async (): Promise<{ onChain: number | null; db: number | null }> => {
    let dbVal: number | null = null
    try {
      // Fetch wallet balance (on-chain, spendable)
      const onChainStr = await getOCXBalanceReadOnly(walletAddress)
      const onChainVal = parseFloat(onChainStr) || 0
      setBalance(onChainVal)
      
      // Fetch database balance (earned, may need claiming)
      try {
        const { data } = await supabase
          .from("players")
          .select("total_ocx_earned")
          .ilike("wallet_address", walletAddress.toLowerCase())
          .single()
        
        if (data?.total_ocx_earned !== undefined && data?.total_ocx_earned !== null) {
          dbVal = Number(data.total_ocx_earned) || 0
          setDbBalance(dbVal)
          dbBalanceRef.current = dbVal
        }
      } catch (dbErr) {
        console.warn("Failed to fetch DB balance:", dbErr)
      }
      
      return { onChain: onChainVal, db: dbVal }
    } catch (err) {
      console.warn('Failed to fetch wallet balance:', err)
      // Explicitly set on-chain balance to 0 so it doesn't fall back to the off-chain DB value
      setBalance(0)
      return { onChain: null, db: dbVal }
    }
  }



  /**
   * Setup polling for balance updates
   */
  useEffect(() => {
    // Fetch balance immediately on mount
    fetchBalance()

    // Poll every 5 seconds to keep balance fresh
    pollingIntervalRef.current = setInterval(() => {
      fetchBalance()
    }, 5000)

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  /**
   * Update the earned (off-chain) balance when the server prop changes.
   * `initialBalance` is total_ocx_earned from the DB, so it belongs in
   * `dbBalance` — writing it into `balance` briefly showed earned OCX as
   * spendable on-chain OCX until the next poll corrected it.
   */
  useEffect(() => {
    setDbBalance(initialBalance)
    dbBalanceRef.current = initialBalance
  }, [initialBalance])

  /**
   * OCX cost to upgrade to each tier.
   * Must match UpgradeManager._bootstrapCosts and server/index.js SUBMARINE_TIERS.
   */
  const UPGRADE_COSTS: Record<number, number> = {
    2: 100, 3: 200, 4: 350, 5: 500, 6: 750, 7: 1000, 8: 1500,
    9: 2000, 10: 2750, 11: 3500, 12: 4500, 13: 6000, 14: 7500, 15: 0,
  }

  /**
   * Handle submarine purchase/upgrade.
   *
   * Primary path: off-chain upgrade via /api/submarine/upgrade
   *   - Deducts from total_ocx_earned (pending OCX earned in-game)
   *   - No MetaMask required; uses JWT cookie auth
   *
   * On-chain path (attempted second if off-chain fails for non-budget reasons):
   *   - Requires on-chain OCX in wallet + UpgradeManager registered as transferAgent
   *   - Will fail until the contract owner calls OCXToken.setTransferAgent(upgradeManagerAddr, true)
   */
  const handlePurchase = async (targetTier: number) => {
    // Synchronous re-entrancy guard: START is rejected while an upgrade is in
    // flight, and a finished upgrade is about to navigate away.
    if (upgradeTx.current().status === "succeeded") return
    if (!upgradeTx.send({ type: "START", note: "Verifying balance..." })) return

    try {
      // Refresh balances and decide on the *fresh* values (React state read
      // here would still hold the values from before the refresh).
      const fresh = await fetchBalance()
      const onChainBalance = fresh.onChain ?? 0
      const earnedBalance = fresh.db ?? dbBalanceRef.current

      const costNum = UPGRADE_COSTS[targetTier] ?? 0
      console.log(`Upgrade to Tier ${targetTier} costs ${costNum} OCX`)

      // ── Primary path: off-chain upgrade (deducts from total_ocx_earned) ──────
      if (earnedBalance >= costNum) {
        upgradeTx.send({ type: "AUTHORIZE", note: `Upgrading to Tier ${targetTier}...` })

        const upgradeResp = await fetch('/api/submarine/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetTier }),
        })

        if (upgradeResp.ok) {
          const result = await upgradeResp.json()
          if (result.success) {
            setDbBalance(result.newOcxBalance)
            dbBalanceRef.current = result.newOcxBalance
            upgradeTx.send({ type: "SUCCEED", note: UPGRADE_COMPLETE_NOTE })
            await new Promise(resolve => setTimeout(resolve, 1500))
            router.push('/game')
            router.refresh()
            return
          }
          // Server returned success:false — treat as error below
          throw txError("server", result.error || 'Upgrade failed', true)
        }

        const errBody = await upgradeResp.json().catch(() => ({ error: 'Upgrade failed' }))
        throw txError("server", errBody.error || `Server error ${upgradeResp.status}`, upgradeResp.status >= 500)
      }

      // ── Fallback: on-chain upgrade (requires OCX in wallet + transferAgent setup) ──
      // Check if user has enough on-chain OCX instead
      if (onChainBalance >= costNum) {
        upgradeTx.send({ type: "AUTHORIZE", note: "Connecting wallet..." })
        let connection
        try {
          connection = await walletManager.ensureConnected()
        } catch {
          throw txError("no_wallet", 'Please connect MetaMask or WalletConnect to authorise this transaction.', true)
        }
        if (!connection?.address) {
          throw txError("no_wallet", 'Wallet not connected. Please connect MetaMask to proceed.', true)
        }
        setTxChainId(connection.chainId)

        // approve (if needed) → upgrade; each wallet prompt and each pending
        // transaction is reported through the lifecycle as it happens.
        const txResult = await tryOnChainUpgrade(targetTier, upgradeTx.send)

        if (!txResult) {
          throw txError(
            "reverted",
            'Blockchain transaction failed. Ensure you have on-chain OCX tokens and sufficient ETH for gas.',
            true,
          )
        }

        upgradeTx.send({ type: "MINED", note: "Transaction confirmed on blockchain! Syncing..." })
        const syncResp = await fetch('/api/submarine/sync-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetTier, txHash: txResult.txHash }),
        })
        if (!syncResp.ok) {
          console.warn('Server tier sync failed but blockchain tx succeeded. Tier will sync on next load.')
        }

        await fetchBalance()
        upgradeTx.send({ type: "SUCCEED", txHash: txResult.txHash, note: UPGRADE_COMPLETE_NOTE })
        await new Promise(resolve => setTimeout(resolve, 1500))
        router.push('/game')
        router.refresh()
        return
      }

      // ── Insufficient balance on both paths ────────────────────────────────────
      throw txError(
        "insufficient_balance",
        `Insufficient OCX. You need ${costNum} OCX to upgrade to Tier ${targetTier}, ` +
        `but you only have ${earnedBalance.toFixed(0)} OCX. ` +
        `Mine resources and trade them in the game to earn more OCX.`
      )
    } catch (error) {
      console.error('Purchase failed:', error)
      // One classifier for every wallet/RPC/server failure (rejected, no gas,
      // revert, ...) instead of ad-hoc string matching per screen.
      upgradeTx.send({ type: "FAIL", error: classifyTxError(error, 'Purchase failed') })
    }
  }

  const selected = getSubmarineByTier(selectedTier)
  const current = getSubmarineByTier(currentTier)
  const nextTier = currentTier + 1
  const selectedCost = UPGRADE_COSTS[selectedTier] ?? 0
  const stats = [
    { label: "Hold", from: holdOf(current), to: holdOf(selected), unit: "" },
    { label: "Battery", from: current.baseStats.energy, to: selected.baseStats.energy, unit: "" },
    { label: "Hull", from: current.baseStats.health, to: selected.baseStats.health, unit: "" },
    { label: "Speed", from: current.baseStats.speed, to: selected.baseStats.speed, unit: "×", digits: 1 },
    { label: "Drill", from: current.baseStats.miningRate, to: selected.baseStats.miningRate, unit: "×", digits: 1 },
    { label: "Rated depth", from: current.baseStats.depth, to: selected.baseStats.depth, unit: " m" },
  ]

  return (
    <StyleWrapper>
      <main className="dive">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--rule)] px-6 py-4 sm:px-10">
          <div className="flex items-baseline gap-6">
            <button type="button" onClick={() => router.push("/home")} className="text-lg font-semibold tracking-tight">
              AbyssX
            </button>
            <h1 className="text-lg text-[var(--ink-dim)]">Hangar</h1>
          </div>
          <dl className="flex gap-6 text-sm">
            <div className="flex gap-2">
              <dt className="text-[var(--ink-dim)]">In your wallet</dt>
              <dd>{fmt(balance, 2)} OCX</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-[var(--ink-dim)]">Earned in the game</dt>
              <dd>{fmt(dbBalance, 2)} OCX</dd>
            </div>
          </dl>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_26rem]">
          {/* The dock */}
          <section aria-labelledby="dock-title" className="relative h-[52dvh] min-h-[360px] lg:h-[calc(100dvh-4.25rem)]">
            <DryDockScene hullColor={selected.color} tier={selected.tier} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-6 sm:px-10">
              <p className="text-sm text-[var(--ink-dim)]">
                Tier {selected.tier}
                {selected.tier === currentTier && ", your submarine"}
                {selected.tier < currentTier && ", already passed"}
              </p>
              <h2 id="dock-title" className="dive-display mt-1 text-[clamp(2rem,4.5vw,3.5rem)]">
                {selected.name}
              </h2>
              <p className="mt-2 max-w-[52ch] leading-relaxed text-[var(--ink-dim)]">{selected.description}</p>
            </div>
          </section>

          {/* Details and the tier list */}
          <aside className="border-l border-[var(--rule)] lg:h-[calc(100dvh-4.25rem)] lg:overflow-y-auto">
            <section aria-label="Compared with your submarine" className="px-6 py-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[var(--ink-dim)]">
                    <th scope="col" className="pb-1 text-left font-normal" />
                    <th scope="col" className="pb-1 text-right font-normal">Yours</th>
                    <th scope="col" className="pb-1 text-right font-normal">{selected.tier === currentTier ? "" : selected.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.label} className="border-t border-[var(--rule)]">
                      <th scope="row" className="py-1.5 text-left font-normal text-[var(--ink-dim)]">{s.label}</th>
                      <td className="py-1.5 text-right text-[var(--ink-dim)]">{fmt(s.from, s.digits)}{s.unit}</td>
                      <td className="py-1.5 text-right">{selected.tier === currentTier ? "" : `${fmt(s.to, s.digits)}${s.unit}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6">
                {selected.tier === nextTier ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePurchase(selected.tier)}
                      disabled={isUpgrading}
                      className="dive-btn dive-btn--warm w-full py-3 text-base"
                    >
                      {isUpgrading ? "Upgrading…" : `Upgrade for ${fmt(selectedCost)} OCX`}
                    </button>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--ink-dim)]">
                      Paid from the OCX you have earned in the game. If that is short, your wallet pays instead and asks
                      you to approve the transaction.
                    </p>
                  </>
                ) : selected.tier === currentTier ? (
                  <p className="text-sm text-[var(--ink-dim)]">This is your submarine.</p>
                ) : selected.tier < currentTier ? (
                  <p className="text-sm text-[var(--ink-dim)]">You have already upgraded past this one.</p>
                ) : (
                  <p className="text-sm text-[var(--ink-dim)]">
                    Upgrades go one tier at a time. Reach tier {selected.tier - 1} first.
                  </p>
                )}

                {upgradeStatus && (
                  <p role="status" aria-live="polite" className="mt-4 border-l-2 border-[var(--lamp)] pl-3 text-sm">
                    {upgradeStatus}
                    {upgradeTxUrl && (
                      <a href={upgradeTxUrl} target="_blank" rel="noopener noreferrer" className="dive-link ml-2">
                        View transaction
                      </a>
                    )}
                  </p>
                )}
                {upgradeError && (
                  <div role="alert" className="mt-4 border-l-2 border-[var(--danger)] pl-3 text-sm">
                    <p>{upgradeError}</p>
                    <button type="button" onClick={() => { void fetchBalance() }} className="dive-link mt-1 text-[var(--ink-dim)]">
                      Refresh balances
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section aria-labelledby="fleet-title" className="border-t border-[var(--rule)] px-6 py-6">
              <h2 id="fleet-title" className="text-sm font-medium text-[var(--ink-dim)]">All submarines</h2>
              <ol className="mt-2">
                {SUBMARINE_TIERS.map((t) => {
                  const isSelected = t.tier === selectedTier
                  const status =
                    t.tier === currentTier ? "Yours" : t.tier < currentTier ? "Passed" : t.tier === nextTier ? `${fmt(UPGRADE_COSTS[t.tier] ?? 0)} OCX` : "Locked"
                  return (
                    <li key={t.tier}>
                      <button
                        type="button"
                        onClick={() => setSelectedTier(t.tier)}
                        aria-current={isSelected ? "true" : undefined}
                        className={`grid w-full grid-cols-[2rem_1fr_auto] items-baseline gap-2 border-t border-[var(--rule)] py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lamp)] ${
                          isSelected ? "text-[var(--ink)]" : "text-[var(--ink-dim)] hover:text-[var(--ink)]"
                        }`}
                      >
                        <span>{t.tier}</span>
                        <span className={isSelected ? "font-semibold" : ""}>
                          {isSelected && <span aria-hidden className="mr-2 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-[var(--bio)]" />}
                          {t.name}
                        </span>
                        <span className={t.tier === nextTier ? "text-[var(--lamp)]" : ""}>{status}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          </aside>
        </div>
      </main>
    </StyleWrapper>
  )
}
