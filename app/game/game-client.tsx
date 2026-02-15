"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { signOut } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { OceanMiningGame } from "@/components/ocean-mining-game"
import { ErrorBoundary } from "@/components/error-boundary"
import { StyleWrapper } from "@/components/style-wrapper"
import { GameState } from "@/lib/types"

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

export default function GameClient({ userId, playerData, walletAddress }: GameClientProps) {
  const [gameState, setGameState] = useState<GameState>("idle")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
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
          {/* Saving indicator */}
          {isSaving && (
            <div className="fixed top-4 right-4 z-50 bg-depth-800 border border-ocean-500 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
              <Loader2 className="w-4 h-4 text-ocean-400 animate-spin" />
              <span className="text-sm text-ocean-300">Saving resources...</span>
            </div>
          )}

          {/* Render game directly */}
          <OceanMiningGame
            walletConnected={true}
            gameState={gameState}
            setGameState={setGameState}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onFullDisconnect={handleFullDisconnect}
            hasCompletedTutorial={playerData?.has_completed_tutorial ?? false}
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
              // Calculate deltas (only send increments, never absolute values)
              const prev = latestResourcesRef.current
              const deltas = {
                nickel: Math.max(0, res.nickel - prev.nickel),
                cobalt: Math.max(0, res.cobalt - prev.cobalt),
                copper: Math.max(0, res.copper - prev.copper),
                manganese: Math.max(0, res.manganese - prev.manganese),
              }

              latestResourcesRef.current = res

              // Skip if no positive deltas
              const totalDelta = deltas.nickel + deltas.cobalt + deltas.copper + deltas.manganese
              if (totalDelta <= 0) return

              // Clear any existing timeout
              if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
              }

              // Debounce save to avoid too many DB calls
              saveTimeoutRef.current = setTimeout(async () => {
                if (savingRef.current) return

                savingRef.current = true
                setIsSaving(true)
                try {
                  console.info("[GameClient] 💾 Saving resource deltas to database", {
                    userId,
                    deltas,
                    totalDelta,
                  })

                  // Send validated deltas (not raw values) to server
                  const response = await fetch("/api/player/save-resources", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deltas }),
                  })

                  const result = await response.json()

                  if (!response.ok) {
                    console.error("[GameClient] ❌ Failed to save resources:", result.error)
                  } else {
                    console.info("[GameClient] ✅ Resources saved successfully", result.data)
                  }
                } catch (err) {
                  console.error("[GameClient] ❌ Unexpected error saving resources:", err)
                } finally {
                  savingRef.current = false
                  setIsSaving(false)
                }
              }, 2500) // 2.5s debounce aligns with server rate limit
            }}
          />
        </div>
      </ErrorBoundary>
    </StyleWrapper>
  )
}
