"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"
import { HangarHeader } from "@/components/hangar/HangarHeader"
import { SubmarineCarousel } from "@/components/hangar/SubmarineCarousel"
import { HangarHUD } from "@/components/hangar/HangarHUD"
import { 
  executeSubmarineUpgrade, 
  getUpgradeCostForTier 
} from "@/lib/contracts"

/**
 * TESTING MODE: Set to true to use simplified testing API
 * TODO: Set back to false before production deployment
 */
const TESTING_MODE_SIMPLE_API = false

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
  balance,
  walletAddress,
}: SubmarineHangarClientProps) {
  const router = useRouter()
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [upgradeStatus, setUpgradeStatus] = useState<string | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)

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
      
      // TESTING MODE: Use simplified API that bypasses pending actions
      if (TESTING_MODE_SIMPLE_API) {
        setUpgradeStatus('Upgrading submarine (testing mode)...')
        
        const resp = await fetch('/api/hangar/test-upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetTier }),
        })
        
        const data = await resp.json()
        
        if (!resp.ok || !data.ok) {
          throw new Error(data?.error || 'Failed to upgrade submarine')
        }
        
        setUpgradeStatus('Upgrade complete! Loading your new submarine...')
        
        // Wait a moment to show success message
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Redirect to game to see new submarine
        router.push('/game')
        router.refresh()
        return
      }
      
      // Original production code below (only runs when TESTING_MODE_SIMPLE_API = false)
      // Step 1: Create a server-side pending action. If wallet is connected perform on-chain tx now,
      // otherwise redirect user to connect-wallet to link and resume.
      let pendingId: string | null = null
      try {
        const resp = await fetch('/api/hangar/pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionType: 'purchase', payload: { targetTier } }),
        })
        const data = await resp.json()
        if (!resp.ok || !data.id) {
          throw new Error(data?.error || 'Failed to create pending action')
        }

        pendingId = data.id
      } catch (e) {
        console.error('Failed to create pending action', e)
        setUpgradeError('Failed to start purchase flow. Please try again.')
        setIsUpgrading(false)
        return
      }

      // If we already have a connected wallet address, proceed to do the on-chain tx now and
      // confirm it server-side. Otherwise redirect to connect-wallet and resume flow after linking.
      const id = pendingId as string
      if (!walletAddress) {
        const returnTo = `/submarine-hangar?pending=${encodeURIComponent(id)}`
        router.push(`/connect-wallet?returnTo=${encodeURIComponent(returnTo)}`)
        return
      }
      
      // Step 2: Get upgrade cost and display to user
      setUpgradeStatus('Fetching upgrade cost...')
      const costInOCX = await getUpgradeCostForTier(targetTier)
      console.log(`Upgrade to Tier ${targetTier} costs ${costInOCX} OCX`)
      
      // Step 3: Execute blockchain transaction
      setUpgradeStatus(`Requesting approval for ${costInOCX} OCX...`)
      
      const txResult = await executeSubmarineUpgrade(targetTier)

      setUpgradeStatus('Transaction submitted! Waiting for confirmation...')
      console.log('Transaction hash:', txResult.txHash)

      // POST txHash to server confirm endpoint so server can verify
      try {
  const id = pendingId as string
  const confirmResp = await fetch(`/api/hangar/pending/${encodeURIComponent(id)}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txHash: txResult.txHash }),
        })
        if (!confirmResp.ok) {
          const errText = await confirmResp.text()
          console.warn('Confirm endpoint returned error', errText)
        }
      } catch (err) {
        console.error('Failed to POST txHash to confirm endpoint', err)
      }

      // Ask server to execute/verify the pending action now
      try {
  const execResp = await fetch(`/api/hangar/pending/${encodeURIComponent(id)}/execute`, { method: 'POST' })
        if (!execResp.ok) {
          const errText = await execResp.text()
          console.warn('Execute endpoint returned error', errText)
          setUpgradeError('Server failed to verify the transaction. Please contact support or try again.')
          setIsUpgrading(false)
          return
        }
      } catch (err) {
        console.error('Failed to call execute endpoint', err)
      }
      
      // NOTE: After redirecting to /connect-wallet and returning, the real
      // upgrade flow should resume here and perform server verification.
      // That resume mechanism is left as a TODO (e.g. pending action saved server-side)
      
      // Step 5: Success! Redirect to game
      setUpgradeStatus('Upgrade complete! Loading your new submarine...')
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Redirect to game to see new submarine
      router.push('/game')
      router.refresh()
      
    } catch (error) {
      console.error('Purchase failed:', error)
      
      let errorMessage = 'Purchase failed'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      // Handle common errors with user-friendly messages
      if (errorMessage.includes('user rejected')) {
        errorMessage = 'Transaction cancelled by user'
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient OCX tokens for upgrade'
      } else if (errorMessage.includes('No Web3 wallet')) {
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
