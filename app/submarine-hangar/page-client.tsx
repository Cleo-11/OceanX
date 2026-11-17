"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"
import { HangarHeader } from "@/components/hangar/HangarHeader"
import { SubmarineCarousel } from "@/components/hangar/SubmarineCarousel"
import { HangarHUD } from "@/components/hangar/HangarHUD"
import { 
  tryOnChainUpgrade, 
  getOCXBalanceReadOnly,
} from "@/lib/contracts"
import { walletManager } from "@/lib/wallet"
import { supabase } from "@/lib/supabase"
import { useTxLifecycle } from "@/hooks/use-tx-lifecycle"
import { classifyTxError, describeTx, explorerTxUrl, txError } from "@/lib/state-machines/tx-lifecycle"

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
  resources,
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

  const handleClose = () => {
    router.push("/home")
  }

  return (
    <StyleWrapper>
      <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950 overflow-hidden">
        {/* Animated Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Light rays from top */}
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-cyan-500/20 via-cyan-500/5 to-transparent transform -skew-x-12 animate-pulse" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-blue-500/20 via-blue-500/5 to-transparent transform skew-x-12 opacity-50" 
               style={{ animationDelay: '1s' }} />
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-cyan-500/20 via-cyan-500/5 to-transparent transform -skew-x-12 opacity-75" 
               style={{ animationDelay: '2s' }} />
          
          {/* Glowing orbs */}
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" 
               style={{ animationDelay: '1.5s' }} />
          
          {/* Scanlines effect */}
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(6,182,212,0.02)_50%)] bg-[length:100%_4px] pointer-events-none" />
        </div>

        {/* Main Hangar Content */}
        <div className="relative z-10 container mx-auto px-4 pb-16">
          {/* Dock HUD (now part of page flow) */}
          <HangarHUD
            balance={balance}
            dbBalance={dbBalance}
            resources={resources}
            currentTier={currentTier}
            walletAddress={walletAddress}
            onClose={handleClose}
            onRefreshBalance={() => { void fetchBalance() }}
          />
          {/* Hangar Header */}
          <HangarHeader currentTier={currentTier} />

          {/* 3D Submarine Carousel */}
          <SubmarineCarousel
            currentTier={currentTier}
            resources={resources}
            balance={balance}
            isUpgrading={isUpgrading}
            onPurchase={handlePurchase}
          />

          {/* Upgrade Status/Error Display */}
          {(upgradeStatus || upgradeError) && (
            <div className="mt-8 max-w-2xl mx-auto">
              {upgradeStatus && (
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-cyan-300 font-medium">{upgradeStatus}</span>
                    {upgradeTxUrl && (
                      <a
                        href={upgradeTxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-sm text-cyan-400 underline hover:text-cyan-300"
                      >
                        View transaction
                      </a>
                    )}
                  </div>
                </div>
              )}
              {upgradeError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <div>
                      <p className="text-red-300 font-medium">Upgrade Failed</p>
                      <p className="text-red-200/80 text-sm mt-1">{upgradeError}</p>
                      {(upgradeError.includes('claim') || upgradeError.includes('Claim') || upgradeError.includes('on-chain')) && (
                        <Link
                          href="/marketplace"
                          className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-600/30 transition-colors"
                        >
                          Go to Marketplace to Claim OCX
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Info Bar */}
          <div className="mt-12 p-6 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-cyan-500/20">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-cyan-400">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span className="font-medium">HANGAR STATUS:</span>
                <span className="text-slate-300">All systems operational</span>
              </div>
              
              <div className="text-slate-400">
                <span className="text-cyan-400">TIP:</span> Higher tier submarines unlock deeper mining zones and increased storage capacity
              </div>
            </div>
          </div>
        </div>
      </div>
    </StyleWrapper>
  )
}
