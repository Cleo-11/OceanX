"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SubmarineStore } from "@/components/submarine-store"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"
import {
  executeSubmarineUpgrade,
  getUpgradeCostForTier,
  connectWallet
} from "@/lib/contracts"

type SubmarineStoreClientProps = {
  currentTier: number
  resources: PlayerResources
  balance: number
  walletAddress?: string
}

export default function SubmarineStoreClient({ currentTier, resources, balance: initialBalance }: SubmarineStoreClientProps) {
  const router = useRouter()
  const [balance, setBalance] = useState(initialBalance)
  const [isUpgrading, setIsUpgrading] = useState(false)

  const handlePurchase = async (targetTier: number) => {
    if (isUpgrading) return
    setIsUpgrading(true)

    try {
      // Step 1: Connect MetaMask wallet — required for blockchain transaction
      let connection
      try {
        connection = await connectWallet()
      } catch (err) {
        throw new Error('Please install MetaMask and connect your wallet to authorize this transaction.')
      }

      if (!connection?.address) {
        throw new Error('Wallet not connected. Please connect MetaMask to proceed.')
      }

      // Step 2: Get upgrade cost
      const costInOCX = await getUpgradeCostForTier(targetTier)
      console.log(`Upgrade to Tier ${targetTier} costs ${costInOCX} OCX`)

      // Step 3: Execute on-chain blockchain transaction (MetaMask popup for approval + upgrade)
      const txResult = await executeSubmarineUpgrade(targetTier)
      console.log('Transaction hash:', txResult.txHash)

      // Step 4: Confirm with server to update DB
      try {
        const EXPRESS_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'https://oceanx.onrender.com'
        const serverResp = await fetch(`${EXPRESS_URL}/submarine/upgrade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: connection.address,
            targetTier,
            txHash: txResult.txHash,
          }),
        })
        if (serverResp.ok) {
          const data = await serverResp.json()
          const newBalance = data.balance ?? data.coins ?? balance
          setBalance(typeof newBalance === 'number' ? newBalance : parseFloat(newBalance) || 0)
        }
      } catch (serverErr) {
        console.warn('Server confirmation failed, trying Next.js API:', serverErr)
        try {
          const resp = await fetch('/api/submarine/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: connection.address,
              targetTier,
              txHash: txResult.txHash,
            }),
          })
          if (resp.ok) {
            const data = await resp.json()
            const newBalance = data.balance ?? data.coins ?? balance
            setBalance(typeof newBalance === 'number' ? newBalance : parseFloat(newBalance) || 0)
          }
        } catch (fallbackErr) {
          console.warn('Fallback server update also failed:', fallbackErr)
        }
      }

      // Redirect to game with new submarine
      router.push('/game')
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

      alert(errorMessage)
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
