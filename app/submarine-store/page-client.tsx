"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SubmarineStore } from "@/components/submarine-store"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"
import {
  tryOnChainUpgrade,
  getUpgradeCostForTier,
  getPlayerOCXBalance,
  getOCXBalanceReadOnly,
} from "@/lib/contracts"
import { walletManager } from "@/lib/wallet"

type SubmarineStoreClientProps = {
  currentTier: number
  resources: PlayerResources
  balance: number
  walletAddress?: string
}

export default function SubmarineStoreClient({ currentTier, resources, balance: initialBalance, walletAddress }: SubmarineStoreClientProps) {
  const router = useRouter()
  const [balance, setBalance] = useState(initialBalance)
  const [isUpgrading, setIsUpgrading] = useState(false)

  /**
   * Fetch on-chain balance from connected wallet
   * This ensures we always have the actual spendable balance
   */
  const fetchWalletBalance = async (walletAddress: string) => {
    try {
      const onChainStr = await getOCXBalanceReadOnly(walletAddress)
      const onChainBalance = parseFloat(onChainStr) || 0
      console.log(`✅ Wallet balance fetched: ${onChainBalance} OCX`)
      setBalance(onChainBalance)
      return onChainBalance
    } catch (err) {
      console.warn('Failed to fetch wallet balance:', err)
      return null
    }
  }

  // Fetch wallet balance on mount and when wallet address changes
  useEffect(() => {
    const loadBalance = async () => {
      const connection = await walletManager.ensureConnected()
      if (connection?.address) {
        await fetchWalletBalance(connection.address)
      } else if (walletAddress) {
        await fetchWalletBalance(walletAddress)
      }
    }
    loadBalance()
  }, [walletAddress])

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
      const costNum = parseFloat(costInOCX) || 0
      console.log(`Upgrade to Tier ${targetTier} costs ${costInOCX} OCX`)

      // Step 2.5: Verify on-chain OCX balance BEFORE attempting the transaction
      let playerOnChainBalance: number
      try {
        const balStr = await getPlayerOCXBalance(connection.address)
        playerOnChainBalance = parseFloat(balStr) || 0
      } catch {
        const balStr = await getOCXBalanceReadOnly(connection.address)
        playerOnChainBalance = parseFloat(balStr) || 0
      }

      if (playerOnChainBalance < costNum) {
        throw new Error(
          `Insufficient on-chain OCX tokens. You have ${playerOnChainBalance.toFixed(1)} OCX on the blockchain but need ${costNum.toFixed(1)} OCX. ` +
          `Go to the Marketplace and use "Claim OCX" to transfer your earned tokens on-chain before upgrading.`
        )
      }

      // Step 3: Try on-chain blockchain transaction first
      const txResult = await tryOnChainUpgrade(targetTier)

      // On-chain transaction is mandatory — no database fallback
      if (!txResult) {
        throw new Error('Blockchain transaction failed. Ensure you have on-chain OCX tokens and sufficient ETH for gas.')
      }

      // On-chain succeeded — sync tier in DB (tokens already deducted on-chain)
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
        console.log('✅ Tier synced to database')
      } else {
        console.warn('Server tier sync failed but blockchain transaction succeeded. Tier will sync on next load.')
      }

      // Refresh balance from wallet (source of truth after purchase)
      await fetchWalletBalance(connection.address)

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
