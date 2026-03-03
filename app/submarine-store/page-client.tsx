"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SubmarineStore } from "@/components/submarine-store"
import { StyleWrapper } from "@/components/style-wrapper"
import type { PlayerResources } from "@/lib/types"
import {
  tryOnChainUpgrade,
  getUpgradeCostForTier,
  getOCXBalanceReadOnly,
} from "@/lib/contracts"
import { walletManager } from "@/lib/wallet"
import { supabase } from "@/lib/supabase"

type SubmarineStoreClientProps = {
  currentTier: number
  resources: PlayerResources
  balance: number
  walletAddress?: string
}

export default function SubmarineStoreClient({ currentTier, resources, balance: initialBalance, walletAddress }: SubmarineStoreClientProps) {
  const router = useRouter()
  const [balance, setBalance] = useState(initialBalance)
  const [dbBalance, setDbBalance] = useState(initialBalance)
  const [isUpgrading, setIsUpgrading] = useState(false)

  /**
   * Fetch both wallet and database balances
   */
  const fetchWalletBalance = async (walletAddress: string) => {
    try {
      const onChainStr = await getOCXBalanceReadOnly(walletAddress)
      const onChainBalance = parseFloat(onChainStr) || 0
      console.log(`✅ Wallet balance fetched: ${onChainBalance} OCX`)
      setBalance(onChainBalance)
      
      // Also fetch DB balance
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

      // Step 2.5: Verify wallet balance BEFORE attempting the transaction
      if (balance < costNum) {
        // Check if user has earned but unclaimed OCX
        const unclaimedOCX = Math.max(0, dbBalance - balance)
        
        if (unclaimedOCX > 0) {
          throw new Error(
            `Insufficient on-chain OCX tokens. You have ${balance.toFixed(1)} OCX in your wallet but need ${costNum.toFixed(1)} OCX. ` +
            `You have ${unclaimedOCX.toFixed(1)} OCX earned but not yet claimed. ` +
            `Go to the Marketplace and click "Claim OCX" to transfer your earned tokens to your wallet, then try upgrading again.`
          )
        } else {
          throw new Error(
            `Insufficient OCX tokens. You have ${balance.toFixed(1)} OCX but need ${costNum.toFixed(1)} OCX. ` +
            `Go to the Marketplace to trade resources and earn more OCX.`
          )
        }
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
