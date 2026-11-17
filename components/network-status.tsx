"use client"

import { useState, useEffect } from "react"
import { WalletManager } from "@/lib/wallet"
import { getChainName, getPrimaryChain, isChainAllowed } from "@/lib/chain-config"

interface NetworkStatusProps {
  onNetworkChange?: (chainId: number) => void
}

export function NetworkStatus({ onNetworkChange }: NetworkStatusProps) {
  const [chainId, setChainId] = useState<number | null>(null)
  const [isAllowed, setIsAllowed] = useState<boolean>(true)
  const [isSwitching, setIsSwitching] = useState(false)
  const [switchError, setSwitchError] = useState<string | null>(null)

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
    setSwitchError(null)
    try {
      const walletManager = WalletManager.getInstance()
      const primaryChain = getPrimaryChain()
      await walletManager.switchNetwork(primaryChain.chainId)
      await checkNetwork()
    } catch (error) {
      console.error("Failed to switch network:", error)
      setSwitchError(`Your wallet did not switch. Switch it to ${getPrimaryChain().name} manually.`)
    } finally {
      setIsSwitching(false)
    }
  }

  if (chainId === null) {
    return null
  }

  const chainName = getChainName(chainId)
  const primaryChain = getPrimaryChain()

  const onPrimary = chainId === primaryChain.chainId

  if (onPrimary) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--ink-dim)]">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--bio)]" />
        Wallet is on {chainName}
      </p>
    )
  }

  return (
    <div role={isAllowed ? "status" : "alert"} className="border-l-2 border-[var(--lamp)] pl-3 text-sm">
      <p>
        Your wallet is on {chainName}. The game uses {primaryChain.name}
        {isAllowed ? ", and will ask to switch before any transaction." : "."}
      </p>
      <button type="button" onClick={handleSwitchNetwork} disabled={isSwitching} className="dive-link mt-1">
        {isSwitching ? "Switching…" : `Switch to ${primaryChain.name}`}
      </button>
      {switchError && <p className="mt-1 text-[var(--ink-dim)]">{switchError}</p>}
    </div>
  )
}
