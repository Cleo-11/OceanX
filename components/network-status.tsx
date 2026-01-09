"use client"

import { useState, useEffect } from "react"
import { WalletManager } from "@/lib/wallet"
import { getChainName, getPrimaryChain, isChainAllowed } from "@/lib/chain-config"
import { AlertCircle, CheckCircle2 } from "lucide-react"

interface NetworkStatusProps {
  onNetworkChange?: (chainId: number) => void
}

export function NetworkStatus({ onNetworkChange }: NetworkStatusProps) {
  const [chainId, setChainId] = useState<number | null>(null)
  const [isAllowed, setIsAllowed] = useState<boolean>(true)
  const [isSwitching, setIsSwitching] = useState(false)

  useEffect(() => {
    checkNetwork()

    // Listen for network changes
    if (typeof window !== "undefined" && window.ethereum) {
      const handleChainChanged = (chainIdHex: string) => {
        const newChainId = parseInt(chainIdHex, 16)
        setChainId(newChainId)
        setIsAllowed(isChainAllowed(newChainId))
        onNetworkChange?.(newChainId)
      }

      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        window.ethereum?.removeListener("chainChanged", handleChainChanged)
      }
    }

    // Return undefined if no cleanup needed
    return undefined
  }, [onNetworkChange])

  async function checkNetwork() {
    try {
      const walletManager = WalletManager.getInstance()
      const currentChainId = await walletManager.getCurrentChainId()
      setChainId(currentChainId)
      setIsAllowed(isChainAllowed(currentChainId))
    } catch (error) {
      console.error("Failed to check network:", error)
    }
  }

  async function handleSwitchNetwork() {
    setIsSwitching(true)
    try {
      const walletManager = WalletManager.getInstance()
      const primaryChain = getPrimaryChain()
      await walletManager.switchNetwork(primaryChain.chainId)
      await checkNetwork()
    } catch (error) {
      console.error("Failed to switch network:", error)
      alert("Failed to switch network. Please switch manually in your wallet.")
    } finally {
      setIsSwitching(false)
    }
  }

  if (chainId === null) {
    return null
  }

  const chainName = getChainName(chainId)
  const primaryChain = getPrimaryChain()

  if (isAllowed) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/30">
        <CheckCircle2 className="w-4 h-4" />
        <span>Connected to {chainName}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm bg-yellow-500/10 px-4 py-3 rounded-lg border border-yellow-500/30">
      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-yellow-400 font-medium">Wrong Network</p>
        <p className="text-yellow-300/80 text-xs mt-0.5">
          You're on {chainName}. Please switch to {primaryChain.name}.
        </p>
      </div>
      <button
        onClick={handleSwitchNetwork}
        disabled={isSwitching}
        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {isSwitching ? "Switching..." : "Switch Network"}
      </button>
    </div>
  )
}
