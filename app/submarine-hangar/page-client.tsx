"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"
import { HangarHeader } from "@/components/hangar/HangarHeader"
import { SubmarineCarousel } from "@/components/hangar/SubmarineCarousel"
import { HangarHUD } from "@/components/hangar/HangarHUD"
import { 
  tryOnChainUpgrade, 
  getUpgradeCostForTier,
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
  const [balance, setBalance] = useState(initialBalance)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [upgradeStatus, setUpgradeStatus] = useState<string | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Fetch updated balance from the server
   */
  const fetchBalance = async () => {
    try {
      // First, sync on-chain balance to DB (captures pre-fix OCX)
      try {
        const onChainStr = await getOCXBalanceReadOnly(walletAddress)
        const onChainBalance = parseFloat(onChainStr) || 0
        if (onChainBalance > balance) {
          await supabase
            .from("players")
            .update({ total_ocx_earned: onChainBalance })
            .ilike("wallet_address", walletAddress.toLowerCase())
          setBalance(onChainBalance)
          return // Already have the freshest value
        }
      } catch (syncErr) {
        console.warn("On-chain sync failed, falling back to API:", syncErr)
      }
      
      const response = await fetch('/api/player/balance')
      if (response.ok) {
        const data = await response.json()
        if (typeof data.balance === 'number') {
          setBalance(data.balance)
        }
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error)
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
   * Handle submarine purchase/upgrade
   * 
   * Full blockchain flow:
   * 1. Connect wallet and verify player address
   * 2. Execute on-chain upgrade transaction
   * 3. Wait for transaction confirmation
   * 4. Send transaction hash to server for verification
   * 5. Server verifies on-chain and updates Supabase
   * 6. Redirect to game with new submarine
   */
  const handlePurchase = async (targetTier: number) => {
    try {
      setIsUpgrading(true)
      setUpgradeError(null)
      setUpgradeStatus('Connecting wallet...')

      // Step 1: Ensure wallet is connected — auto-reconnects or prompts MetaMask
      let connection
      try {
        connection = await walletManager.ensureConnected()
      } catch (err) {
        throw new Error('Please connect MetaMask or WalletConnect to authorize this transaction.')
      }

      if (!connection?.address) {
        throw new Error('Wallet not connected. Please connect MetaMask to proceed.')
      }

      // Step 2: Get upgrade cost and display to user
      setUpgradeStatus('Fetching upgrade cost...')
      const costInOCX = await getUpgradeCostForTier(targetTier)
      console.log(`Upgrade to Tier ${targetTier} costs ${costInOCX} OCX`)

      // Step 3: Try on-chain blockchain transaction first (MetaMask popup)
      setUpgradeStatus(`Requesting approval for ${costInOCX} OCX...`)
      const txResult = await tryOnChainUpgrade(targetTier)

      // On-chain transaction is mandatory — no database fallback
      if (!txResult) {
        throw new Error('Blockchain transaction failed. Ensure you have on-chain OCX tokens and sufficient ETH for gas.')
      }

      // On-chain succeeded — sync tier in DB (tokens already deducted on-chain)
      setUpgradeStatus('Transaction confirmed on blockchain! Syncing upgrade...')
      console.log('Transaction hash:', txResult.txHash)

      const syncResp = await fetch('/api/submarine/sync-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTier,
          txHash: txResult.txHash,
        }),
      })
      if (syncResp.ok) {
        const data = await syncResp.json()
        if (data.success && data.data) {
          const newBalance = data.data.balance ?? data.data.coins ?? balance
          setBalance(typeof newBalance === 'number' ? newBalance : parseFloat(newBalance) || 0)
        }
      } else {
        console.warn('Server tier sync failed but blockchain transaction succeeded. Tier will sync on next load.')
      }

      // Refresh balance from chain
      await fetchBalance()

      // Success — redirect to game
      setUpgradeStatus('Upgrade complete! Loading your new submarine...')
      await new Promise(resolve => setTimeout(resolve, 1500))
      router.push('/game')
      router.refresh()
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
      } else if (errorMessage.includes('Insufficient OCX') || errorMessage.includes('Not enough')) {
        errorMessage = 'Insufficient OCX tokens for upgrade'
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
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <div>
                      <p className="text-red-300 font-medium">Upgrade Failed</p>
                      <p className="text-red-200/80 text-sm mt-1">{upgradeError}</p>
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
