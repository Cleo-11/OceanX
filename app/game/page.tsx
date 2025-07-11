"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getSession, getCurrentUser, signOut } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { OceanMiningGame } from "@/components/ocean-mining-game";
import { AlertDialogContent } from "@/components/ui/alert-dialog";
import { GameState } from "@/lib/types";

interface PlayerData {
  id: string
  user_id: string
  wallet_address: string
  username: string
  submarine_tier: number
  total_resources_mined: number
  total_ocx_earned: number
  last_login: string
  is_active: boolean
}

export default function GamePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  const [user, setUser] = useState<any>(null)
  const [walletConnected, setWalletConnected] = useState(true); // Assume true if authenticated
  const [gameState, setGameState] = useState<GameState>("idle");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter()

  useEffect(() => {
    initializeGame()
  }, [])

  const initializeGame = async () => {
    try {
      // Check authentication
      const { session } = await getSession()
      if (!session) {
        router.push("/auth")
        return
      }

      const { user } = await getCurrentUser()
      if (!user) {
        router.push("/auth")
        return
      }

      setUser(user)

      // Get player data
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (playerError || !playerData) {
        // Player doesn't exist or no wallet connected
        router.push("/connect-wallet")
        return
      }

      if (!playerData.wallet_address) {
        // No wallet connected
        router.push("/connect-wallet")
        return
      }

      setPlayerData(playerData)

      // Update last login
      await supabase.from("players").update({ last_login: new Date().toISOString() }).eq("user_id", user.id)
    } catch (error) {
      console.error("Error initializing game:", error)
      setError("Failed to load game data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const handleRetry = () => {
    setError("")
    setIsLoading(true)
    initializeGame()
  }

  const handleFullDisconnect = () => {
    handleSignOut();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your submarine...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Game Loading Error</h2>

          <Alert className="mb-6 border-red-500/30 bg-red-900/50">
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleRetry}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 bg-transparent"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!playerData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">No player data found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <OceanMiningGame
        walletConnected={walletConnected}
        gameState={gameState}
        setGameState={setGameState}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onFullDisconnect={handleFullDisconnect}
      />
    </div>
  )
}
