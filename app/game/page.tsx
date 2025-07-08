"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { OceanMiningGame } from "@/components/ocean-mining-game"
import { apiClient } from "@/lib/api"
import type { GameState } from "@/lib/types"
import { Loader2 } from "lucide-react"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function GamePage() {
  const [user, setUser] = useState<any>(null)
  const [player, setPlayer] = useState<any>(null)
  const [gameState, setGameState] = useState<GameState>("idle")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const router = useRouter()

  useEffect(() => {
    checkAuthAndLoadGame()
  }, [])

  const checkAuthAndLoadGame = async () => {
    try {
      // Check Supabase authentication
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/auth")
        return
      }

      setUser(session.user)

      // Get player profile with wallet
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", session.user.id)
        .single()

      if (playerError || !playerData?.wallet_address) {
        router.push("/connect-wallet")
        return
      }

      setPlayer(playerData)

      // Test backend connection and join game
      const healthResponse = await apiClient.healthCheck()
      if (!healthResponse.success) {
        throw new Error("Backend server is not responding")
      }

      // Create auth message and join game
      const message = `Welcome to OceanX!\n\nSign this message to authenticate your wallet.\n\nWallet: ${playerData.wallet_address}\nTimestamp: ${Date.now()}`

      // For now, we'll skip the signature requirement in game mode since the user is already authenticated
      // In a production environment, you might want to implement a session-based auth system
      const joinResponse = await apiClient.joinGame(playerData.wallet_address, "authenticated", message)

      if (!joinResponse.success) {
        throw new Error("Failed to join game session")
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Game initialization error:", error)
      setError(error instanceof Error ? error.message : "Failed to initialize game")
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your deep sea adventure...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-400 mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <div className="space-y-2">
            <button
              onClick={checkAuthAndLoadGame}
              className="w-full px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Player data not found</p>
        </div>
      </div>
    )
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-slate-900">
      <OceanMiningGame
        walletConnected={true}
        gameState={gameState}
        setGameState={setGameState}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onFullDisconnect={handleDisconnect}
      />
    </main>
  )
}
