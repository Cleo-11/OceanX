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
  } | null
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

export default function GameClient({ userId, playerData }: GameClientProps) {
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
            initialResources={{
              nickel: playerData?.nickel ?? 0,
              cobalt: playerData?.cobalt ?? 0,
              copper: playerData?.copper ?? 0,
              manganese: playerData?.manganese ?? 0,
            }}
            onResourcesChange={(res) => {
              latestResourcesRef.current = res

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
                  const totals = res.nickel + res.cobalt + res.copper + res.manganese

                  console.info("[GameClient] 💾 Saving resources to database", {
                    userId,
                    resources: res,
                    total: totals,
                  })

                  // Use API route to bypass RLS
                  const response = await fetch("/api/player/save-resources", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      nickel: res.nickel,
                      cobalt: res.cobalt,
                      copper: res.copper,
                      manganese: res.manganese,
                    }),
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
              }, 500) // 500ms debounce for faster saves
            }}
          />
        </div>
      </ErrorBoundary>
    </StyleWrapper>
  )
}
