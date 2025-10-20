"use client"

import { useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { UserHome } from "@/components/user-home"
import { StyleWrapper } from "@/components/style-wrapper"

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

function logCssDiagnostics(context: string) {
  if (typeof window === "undefined") {
    return
  }

  const body = document.body
  const computedStyle = window.getComputedStyle(body)
  const stylesheets = Array.from(document.styleSheets).map((sheet, index) => {
    try {
      return sheet.href ? `${index}: ${sheet.href}` : `${index}: inline`
    } catch (error) {
      return `${index}: <inaccessible>`
    }
  })

  console.log("🏡 [HomePageClient] CSS diagnostics", {
    context,
    pathname: window.location.pathname,
    stylesheetCount: document.styleSheets.length,
    stylesheets,
    bodyClasses: Array.from(body.classList),
    background: computedStyle.backgroundColor,
    fontFamily: computedStyle.fontFamily,
    hasTailwindVars: computedStyle.getPropertyValue("--tw-ring-inset") !== "",
    hasGlobalVars: computedStyle.getPropertyValue("--background") !== "",
  })
}

export default function HomePageClient({ playerData }: HomePageClientProps) {
  const router = useRouter()

  useEffect(() => {
    console.log("🏠 [HomePageClient] Component mounted", {
      username: playerData.username,
      submarineTier: playerData.submarine_tier,
      pathname: window.location.pathname,
    })
    logCssDiagnostics("mount")
  }, [playerData])

  const handlePlayClick = useCallback(() => {
    router.push("/game")
  }, [router])

  const handleSubmarineStoreClick = useCallback(() => {
    if (typeof window !== "undefined") {
      console.debug("[HomePageClient] Submarine hangar click - navigating to /submarine-hangar", { pathname: window.location.pathname })
    }
    router.push("/submarine-hangar")
  }, [router])

  return (
    <StyleWrapper>
      <UserHome
        playerData={playerData}
        onPlayClick={handlePlayClick}
        onSubmarineStoreClick={handleSubmarineStoreClick}
      />
    </StyleWrapper>
  )
}
