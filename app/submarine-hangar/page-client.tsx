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
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [upgradeStatus, setUpgradeStatus] = useState<string | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Fetch both wallet balance (on-chain) and database balance (earned)
   * Wallet balance = what you can spend
   * DB balance = what you've earned (needs to be claimed)
   */
  const fetchBalance = async () => {
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
        
        if (data?.total_ocx_earned !== undefined) {
          setDbBalance(data.total_ocx_earned)
        }
      } catch (dbErr) {
        console.warn("Failed to fetch DB balance:", dbErr)
      }
      
      return onChainVal
    } catch (err) {
      console.warn('Failed to fetch wallet balance:', err)
      // Explicitly set on-chain balance to 0 so it doesn't fall back to the off-chain DB value
      setBalance(0)
      return null
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
   * Update balance when initial balance prop changes
   */
  useEffect(() => {
    setBalance(initialBalance)
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
    try {
      setIsUpgrading(true)
      setUpgradeError(null)
      setUpgradeStatus('Verifying balance...')

      // Refresh balances before checking
      await fetchBalance()

      const costNum = UPGRADE_COSTS[targetTier] ?? 0
      console.log(`Upgrade to Tier ${targetTier} costs ${costNum} OCX`)

      // ── Primary path: off-chain upgrade (deducts from total_ocx_earned) ──────
      if (dbBalance >= costNum) {
        setUpgradeStatus(`Upgrading to Tier ${targetTier}...`)

        const upgradeResp = await fetch('/api/submarine/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetTier }),
        })

        if (upgradeResp.ok) {
          const result = await upgradeResp.json()
          if (result.success) {
            setDbBalance(result.newOcxBalance)
            setUpgradeStatus('Upgrade complete! Loading your new submarine...')
            await new Promise(resolve => setTimeout(resolve, 1500))
            router.push('/game')
            router.refresh()
            return
          }
          // Server returned success:false — treat as error below
          throw new Error(result.error || 'Upgrade failed')
        }

        const errBody = await upgradeResp.json().catch(() => ({ error: 'Upgrade failed' }))
        throw new Error(errBody.error || `Server error ${upgradeResp.status}`)
      }

      // ── Fallback: on-chain upgrade (requires OCX in wallet + transferAgent setup) ──
      // Check if user has enough on-chain OCX instead
      if (balance >= costNum) {
        setUpgradeStatus('Connecting wallet...')
        let connection
        try {
          connection = await walletManager.ensureConnected()
        } catch {
          throw new Error('Please connect MetaMask or WalletConnect to authorise this transaction.')
        }
        if (!connection?.address) {
          throw new Error('Wallet not connected. Please connect MetaMask to proceed.')
        }

        setUpgradeStatus(`Requesting on-chain approval for ${costNum} OCX...`)
        const txResult = await tryOnChainUpgrade(targetTier)

        if (!txResult) {
          throw new Error('Blockchain transaction failed. Ensure you have on-chain OCX tokens and sufficient ETH for gas.')
        }

        setUpgradeStatus('Transaction confirmed on blockchain! Syncing...')
        const syncResp = await fetch('/api/submarine/sync-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetTier, txHash: txResult.txHash }),
        })
        if (!syncResp.ok) {
          console.warn('Server tier sync failed but blockchain tx succeeded. Tier will sync on next load.')
        }

        await fetchBalance()
        setUpgradeStatus('Upgrade complete! Loading your new submarine...')
        await new Promise(resolve => setTimeout(resolve, 1500))
        router.push('/game')
        router.refresh()
        return
      }

      // ── Insufficient balance on both paths ────────────────────────────────────
      throw new Error(
        `Insufficient OCX. You need ${costNum} OCX to upgrade to Tier ${targetTier}, ` +
        `but you only have ${dbBalance.toFixed(0)} OCX. ` +
        `Mine resources and trade them in the game to earn more OCX.`
      )
    } catch (error) {
      console.error('Purchase failed:', error)

      let errorMessage = 'Purchase failed'
      if (error instanceof Error) {
        errorMessage = error.message
      }

      if (errorMessage.includes('user rejected') || errorMessage.includes('ACTION_REJECTED')) {
        errorMessage = 'Transaction cancelled by user'
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees'
      } else if (errorMessage.includes('No Web3 wallet') || errorMessage.includes('MetaMask')) {
        errorMessage = 'Please install MetaMask or another Web3 wallet'
      }

      setUpgradeError(errorMessage)
      setUpgradeStatus(null)
    } finally {
      setIsUpgrading(false)
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
            onRefreshBalance={fetchBalance}
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
