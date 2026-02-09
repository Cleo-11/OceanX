"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SubmarineStore } from "@/components/submarine-store"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"

type SubmarineStoreClientProps = {
  currentTier: number
  resources: PlayerResources
  balance: number
  walletAddress: string
}

export default function SubmarineStoreClient({ currentTier, resources, balance: initialBalance, walletAddress }: SubmarineStoreClientProps) {
  const router = useRouter()
  const [balance, setBalance] = useState(initialBalance)
  const [isUpgrading, setIsUpgrading] = useState(false)

  const handlePurchase = async (targetTier: number) => {
    if (isUpgrading) return
    setIsUpgrading(true)

    try {
      const EXPRESS_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'https://oceanx.onrender.com'
      let upgradeData: any = null

      // Try Express server first
      try {
        const resp = await fetch(`${EXPRESS_URL}/submarine/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, targetTier }),
        })
        if (resp.ok) {
          upgradeData = await resp.json()
        }
      } catch (err) {
        console.warn('Express upgrade unavailable, trying Next.js API:', err)
      }

      // Fallback to Next.js API route
      if (!upgradeData) {
        const resp = await fetch('/api/submarine/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, targetTier }),
        })
        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}))
          throw new Error(errBody.error || 'Upgrade failed')
        }
        upgradeData = await resp.json()
      }

      if (!upgradeData) throw new Error('Upgrade failed — no response from server')

      const newBalance = upgradeData.balance ?? upgradeData.coins ?? balance
      setBalance(typeof newBalance === 'number' ? newBalance : parseFloat(newBalance) || 0)

      // Redirect to game to use new submarine
      router.push('/game')
    } catch (error) {
      console.error('Purchase failed:', error)
      alert(error instanceof Error ? error.message : 'Purchase failed. Please try again.')
    } finally {
      setIsUpgrading(false)
    }
  }

  return (
    <StyleWrapper>
      <div className="min-h-screen bg-depth-900">
        <SubmarineStore
          isOpen={true}
          onClose={() => {
            router.push("/home")
          }}
          currentTier={currentTier}
          resources={resources}
          balance={balance}
          onPurchase={handlePurchase}
          gameState={"idle"}
        />
      </div>
    </StyleWrapper>
  )
}
