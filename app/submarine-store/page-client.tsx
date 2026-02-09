"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SubmarineStore } from "@/components/submarine-store"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"
import {
  tryOnChainUpgrade,
  getUpgradeCostForTier,
} from "@/lib/contracts"
import { walletManager } from "@/lib/wallet"

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

      // Step 2: Get upgrade cost
      const costInOCX = await getUpgradeCostForTier(targetTier)
      console.log(`Upgrade to Tier ${targetTier} costs ${costInOCX} OCX`)

      // Step 3: Try on-chain blockchain transaction first
      const txResult = await tryOnChainUpgrade(targetTier)

      if (txResult) {
        // On-chain succeeded — confirm with server using txHash
        console.log('Transaction hash:', txResult.txHash)
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
          console.warn('Server confirmation with txHash failed:', serverErr)
        }
      } else {
        // On-chain failed (no on-chain tokens) — fall back to MetaMask-signed authorization
        const message = `Authorize submarine upgrade to Tier ${targetTier} for account ${connection.address}`
        const signer = connection.signer
        const signature = await signer.signMessage(message)

        // Try Express API with signed auth
        let serverSuccess = false
        try {
          const EXPRESS_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'https://oceanx.onrender.com'
          const serverResp = await fetch(`${EXPRESS_URL}/submarine/upgrade`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-wallet-address': connection.address,
              'x-auth-signature': signature,
              'x-auth-message': message,
            },
            body: JSON.stringify({
              walletAddress: connection.address,
              targetTier,
            }),
          })
          if (serverResp.ok) {
            const data = await serverResp.json()
            const newBalance = data.balance ?? data.coins ?? balance
            setBalance(typeof newBalance === 'number' ? newBalance : parseFloat(newBalance) || 0)
            serverSuccess = true
          }
        } catch (expressErr) {
          console.warn('Express signed upgrade failed:', expressErr)
        }

        if (!serverSuccess) {
          // Fallback to Next.js API
          const resp = await fetch('/api/submarine/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: connection.address,
              targetTier,
            }),
          })
          if (resp.ok) {
            const data = await resp.json()
            const newBalance = data.balance ?? data.coins ?? balance
            setBalance(typeof newBalance === 'number' ? newBalance : parseFloat(newBalance) || 0)
          } else {
            const errData = await resp.json().catch(() => ({}))
            throw new Error(errData.error || 'Upgrade failed on server')
          }
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
