"use client"

import { useState, useEffect } from "react"
import { OceanMiningGame } from "@/components/ocean-mining-game"
import { WalletConnectionModal } from "@/components/wallet-connection-modal"
import { walletManager } from "@/lib/wallet"
import { apiClient } from "@/lib/api"
import type { GameState } from "@/lib/types"

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [gameState, setGameState] = useState<GameState>("idle")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string>("")
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "error">("checking")

  // Check if wallet is already connected on page load
  useEffect(() => {
    checkWalletConnection()
    testBackendConnection()
  }, [])

  const testBackendConnection = async () => {
    try {
      console.log("Testing backend connection...")
      const response = await apiClient.healthCheck()
      if (response.success) {
        console.log("✅ Backend connected successfully")
        setBackendStatus("connected")
      } else {
        console.error("❌ Backend health check failed:", response.error)
        setBackendStatus("error")
        setConnectionError("Backend server is not responding")
      }
    } catch (error) {
      console.error("❌ Backend connection failed:", error)
      setBackendStatus("error")
      setConnectionError("Cannot connect to backend server")
    }
  }

  const checkWalletConnection = async () => {
    try {
      if (typeof window !== "undefined" && window.ethereum) {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          // Wallet is already connected, authenticate with backend
          await handleWalletConnection(accounts[0])
        }
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error)
    }
  }

  const handleConnectWallet = async () => {
    setIsConnecting(true)
    setConnectionError("")
    try {
      // Connect wallet
      const connection = await walletManager.connectWallet()
      await handleWalletConnection(connection.address)
      setShowWalletModal(false)
    } catch (error) {
      console.error("Failed to connect wallet:", error)
      setConnectionError("Failed to connect wallet. Please try again.")
    } finally {
      setIsConnecting(false)
    }
  }

  const handleWalletConnection = async (address: string) => {
    try {
      // Create authentication message
      const message = `Welcome to OceanX!\n\nSign this message to authenticate your wallet.\n\nWallet: ${address}\nTimestamp: ${Date.now()}`

      // Sign message
      const signature = await walletManager.signMessage(message)

      // Authenticate with backend
      const authResponse = await apiClient.connectWallet(address, signature, message)

      if (authResponse.success) {
        setWalletConnected(true)
        setWalletAddress(address)
        setConnectionError("")
        console.log("✅ Wallet authenticated successfully")
        // Join game session after successful authentication
        const joinResponse = await apiClient.joinGame(address, signature, message) // Pass signature and message here
        if (joinResponse.success && joinResponse.data) {
          // Handle session data if needed, though it's primarily handled in OceanMiningGame
        }
      } else {
        throw new Error(authResponse.error || "Authentication failed")
      }
    } catch (error) {
      console.error("Authentication failed:", error)
      setConnectionError(`Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      walletManager.disconnect()
    }
  }

  const handleDisconnectWallet = () => {
    walletManager.disconnect()
    setWalletConnected(false)
    setWalletAddress("")
    setGameState("idle")
    setConnectionError("")
  }

  const getBackendStatusColor = () => {
    switch (backendStatus) {
      case "connected":
        return "text-green-400"
      case "error":
        return "text-red-400"
      default:
        return "text-yellow-400"
    }
  }

  const getBackendStatusText = () => {
    switch (backendStatus) {
      case "connected":
        return "Connected"
      case "error":
        return "Disconnected"
      default:
        return "Checking..."
    }
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-slate-900">
      <OceanMiningGame
        walletConnected={walletConnected}
        gameState={gameState}
        setGameState={setGameState}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {showWalletModal && (
        <WalletConnectionModal
          onConnect={handleConnectWallet}
          onClose={() => setShowWalletModal(false)}
          isConnecting={isConnecting}
        />
      )}

      {/* Connection Error Alert */}
      {connectionError && (
        <div className="absolute left-4 top-4 z-50 max-w-md rounded-lg bg-red-900/80 p-4 text-sm text-red-200 backdrop-blur-sm">
          <div className="font-bold text-red-100">Connection Error</div>
          <div>{connectionError}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={testBackendConnection} className="text-xs text-red-300 hover:text-red-100 underline">
              Retry
            </button>
            <button onClick={() => setConnectionError("")} className="text-xs text-red-300 hover:text-red-100">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Wallet Connection Controls */}
      <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
        {walletConnected ? (
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-slate-800/80 px-3 py-2 text-sm text-cyan-400 backdrop-blur-sm">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
            <button
              onClick={handleDisconnectWallet}
              className="rounded-lg bg-red-600/80 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-red-600"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowWalletModal(true)}
            disabled={isConnecting || backendStatus === "error"}
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2 font-medium text-white shadow-lg shadow-cyan-900/30 transition-all hover:shadow-cyan-900/50 disabled:opacity-50"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>

      {/* Game Status */}
      <div className="absolute left-4 bottom-20 rounded-lg bg-slate-900/70 p-3 text-xs text-slate-300 backdrop-blur-sm">
        <div className="mb-1 font-bold text-cyan-400">OCEANX v0.1</div>
        <div>Network: Sepolia Testnet</div>
        <div className={`Backend: ${getBackendStatusColor()}`}>{getBackendStatusText()}</div>
        {walletConnected && (
          <>
            <div>Wallet: Connected</div>
            <div>Status: {gameState}</div>
          </>
        )}
      </div>

      {/* Network Warning */}
      {typeof window !== "undefined" && window.ethereum && (
        <div className="absolute right-4 bottom-4 rounded-lg bg-amber-900/70 p-3 text-xs text-amber-200 backdrop-blur-sm">
          <div className="font-bold">⚠️ Testnet Mode</div>
          <div>Make sure you're on Sepolia network</div>
        </div>
      )}
    </main>
  )
}
