"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"
import { HangarHeader } from "@/components/hangar/HangarHeader"
import { SubmarineCarousel } from "@/components/hangar/SubmarineCarousel"
import { HangarHUD } from "@/components/hangar/HangarHUD"
import { 
  getOCXBalanceReadOnly
} from "@/lib/contracts"
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
      setUpgradeStatus('Processing upgrade...')

      // Use the DB-based upgrade API (no wallet/blockchain required)
      const EXPRESS_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'https://oceanx.onrender.com'
      let upgradeData: any = null

      // Try Express server first
      try {
        setUpgradeStatus('Requesting upgrade...')
        const expressResp = await fetch(`${EXPRESS_URL}/submarine/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: walletAddress,
            targetTier: targetTier,
          }),
        })
        if (expressResp.ok) {
          upgradeData = await expressResp.json()
        } else {
          const errText = await expressResp.text()
          console.warn('Express upgrade failed:', errText)
        }
      } catch (err) {
        console.warn('Express upgrade unavailable, trying Next.js API:', err)
      }

      // Fallback to Next.js API route
      if (!upgradeData) {
        setUpgradeStatus('Using fallback upgrade path...')
        const nextResp = await fetch('/api/submarine/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: walletAddress,
            targetTier: targetTier,
          }),
        })
        if (!nextResp.ok) {
          const errBody = await nextResp.json().catch(() => ({}))
          throw new Error(errBody.error || 'Upgrade failed')
        }
        upgradeData = await nextResp.json()
      }

      if (!upgradeData) {
        throw new Error('Upgrade failed — no response from server')
      }

      // Update balance from response
      const newBalance = upgradeData.balance ?? upgradeData.coins ?? balance
      setBalance(typeof newBalance === 'number' ? newBalance : parseFloat(newBalance) || 0)

      // Refresh balance from server
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

      if (errorMessage.includes('insufficient') || errorMessage.includes('Not enough')) {
        errorMessage = 'Insufficient OCX tokens for upgrade'
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
