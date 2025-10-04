"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
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

interface HomePageClientProps {
  playerData: PlayerData
}

export default function HomePageClient({ playerData }: HomePageClientProps) {
  const router = useRouter()

  const handlePlayClick = useCallback(() => {
    router.push("/game")
  }, [router])

  const handleSubmarineStoreClick = useCallback(() => {
    sessionStorage.setItem("openSubmarineStore", "true")
    router.push("/game")
  }, [router])

  return (
    <UserHome
      playerData={playerData}
      onPlayClick={handlePlayClick}
      onSubmarineStoreClick={handleSubmarineStoreClick}
    />
  )
}
