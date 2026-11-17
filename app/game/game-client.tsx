"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { signOut } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { OceanMiningGame } from "@/components/ocean-mining-game"
import { ErrorBoundary } from "@/components/error-boundary"
import { StyleWrapper } from "@/components/style-wrapper"
import { useGameAction } from "@/hooks/use-game-action"

interface GameClientProps {
  userId: string
  playerData: {
    wallet_address?: string | null
    nickel?: number
    cobalt?: number
    copper?: number
    manganese?: number
    total_ocx_earned?: number
    submarine_tier?: number
    has_completed_tutorial?: boolean | null
  } | null
  walletAddress: string
  /** True only when the wallet has no prior DB record (first-ever sign-in). */
  isNewPlayer?: boolean
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

  console.log("🚢 [GameClient] CSS diagnostics", {
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

export default function GameClient({ userId, playerData, walletAddress, isNewPlayer = false }: GameClientProps) {
  // Explicit state machine for the player's current action (mine / trade /
  // claim / upgrade). See lib/state-machines/game-action.ts.
  const { state: gameState, send: sendGameEvent } = useGameAction()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Resources are saved by the game server as they are mined (server-
  // authoritative); the browser no longer writes resource totals.
  const latestResourcesRef = useRef<{
    nickel: number
    cobalt: number
    copper: number
    manganese: number
  }>({
    nickel: playerData?.nickel ?? 0,
    cobalt: playerData?.cobalt ?? 0,
    copper: playerData?.copper ?? 0,
    manganese: playerData?.manganese ?? 0,
  })
  const router = useRouter()

  useEffect(() => {
    console.log("🎮 [GameClient] Component mounted", {
      pathname: window.location.pathname,
      userId,
      hasPlayerData: !!playerData,
    })
    logCssDiagnostics("mount")

    // Update last_login
    const updateLastLogin = async () => {
      try {
        await supabase
          .from("players")
          .update({ last_login: new Date().toISOString(), is_active: true })
          .eq("user_id", userId)
      } catch (error) {
        console.error("[GameClient] Error updating last_login:", error)
      }
    }
    updateLastLogin()
  }, [userId, playerData])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const handleFullDisconnect = () => {
    handleSignOut()
  }

  return (
    <StyleWrapper>
      <ErrorBoundary>
        <div className="min-h-screen bg-depth-900">
          {/* Render game directly */}
          <OceanMiningGame
            walletConnected={true}
            gameState={gameState}
            sendGameEvent={sendGameEvent}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onFullDisconnect={handleFullDisconnect}
            hasCompletedTutorial={!isNewPlayer}
            initialWalletAddress={walletAddress}
            initialBalance={playerData?.total_ocx_earned ?? 0}
            initialTier={playerData?.submarine_tier ?? 1}
            initialResources={{
              nickel: playerData?.nickel ?? 0,
              cobalt: playerData?.cobalt ?? 0,
              copper: playerData?.copper ?? 0,
              manganese: playerData?.manganese ?? 0,
            }}
            onResourcesChange={(res) => {
              latestResourcesRef.current = res
            }}
          />
        </div>
      </ErrorBoundary>
    </StyleWrapper>
  )
}
