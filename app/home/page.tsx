"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getSession, getCurrentUser } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { UserHome } from "@/components/user-home"

interface PlayerData {
  id: string
  user_id: string
  wallet_address: string
  username: string
  submarine_tier: number
  total_resources_mined: number
  total_ocx_earned: number
  last_login: string
}

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    loadPlayerData()
  }, [])

  const loadPlayerData = async () => {
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
    } catch (error) {
      console.error("Error loading player data:", error)
      setError("Failed to load player data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlayClick = () => {
    router.push("/game")
  }

  const handleSubmarineStoreClick = () => {
    // Store the intent to open submarine store and navigate to game
    sessionStorage.setItem("openSubmarineStore", "true")
    router.push("/game")
  }

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
          <h2 className="text-2xl font-bold text-white mb-4">Loading Error</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={loadPlayerData}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200"
          >
            Try Again
          </button>
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
    <UserHome
      playerData={playerData}
      onPlayClick={handlePlayClick}
      onSubmarineStoreClick={handleSubmarineStoreClick}
    />
  )
}