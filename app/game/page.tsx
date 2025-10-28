"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getCurrentUser, signOut } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { OceanMiningGame } from "@/components/ocean-mining-game";
// import { walletManager } from "@/lib/wallet";
import { ErrorBoundary } from "@/components/error-boundary";
import { StyleWrapper } from "@/components/style-wrapper";
// ...existing code...
import { GameState } from "@/lib/types";

// Note: We no longer require pre-existing player data for gameplay

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

  console.log("🚢 [GamePage] CSS diagnostics", {
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

export default function GamePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  // Optional: we no longer require pre-existing player data to play
  // Wallet connection is not required for gameplay
  const [gameState, setGameState] = useState<GameState>("idle");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const savingRef = useRef(false)
  const latestResourcesRef = useRef<{ nickel: number; cobalt: number; copper: number; manganese: number }>({ nickel: 0, cobalt: 0, copper: 0, manganese: 0 })
  // SubmarineStore moved to dedicated route; no local modal state anymore
  const router = useRouter()

  useEffect(() => {
    console.log("🎮 [GamePage] Component mounted", {
      pathname: window.location.pathname,
    })
    logCssDiagnostics("mount")
    initializeGame()
  }, [])

  // No need to check wallet connection for gameplay

  const initializeGame = async () => {
    try {
      // Fetch user (optional), but do not redirect from here
      const { user } = await getCurrentUser()
      if (user) {
        // Try to load player record for display, but don't block gameplay
          await supabase
          .from("players")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle()
  // We don't require this data to render the game; ignoring if missing
        // Best-effort: update last_login
        await supabase.from("players").upsert({ user_id: user.id, last_login: new Date().toISOString(), is_active: true }, { onConflict: "user_id" })
      }
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

  // Removed connect wallet handler; not used in game

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-ocean-400 animate-spin mx-auto mb-4" />
          <p className="text-depth-400">Loading your submarine...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Game Loading Error</h2>

          <Alert className="mb-6 border-red-500/30 bg-red-900/50">
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleRetry}
              className="bg-gradient-to-r from-ocean-500 to-abyss-600 hover:from-ocean-600 hover:to-abyss-700 text-white"
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="border-depth-600 text-depth-300 hover:bg-depth-800 bg-transparent"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    )
  }


  // Always render the game; no wallet/auth redirects from here

  return (
    <StyleWrapper>
      <ErrorBoundary>
        <div className="min-h-screen bg-depth-900">
          {/* Submarine Store moved to dedicated route at /submarine-store */}

          {/* Render game directly without submarine selection modal */}
          <OceanMiningGame
            walletConnected={true}
            gameState={gameState}
            setGameState={setGameState}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onFullDisconnect={handleFullDisconnect}
            onResourcesChange={(res) => {
              latestResourcesRef.current = res
              if (!savingRef.current) {
                savingRef.current = true
                setTimeout(async () => {
                  try {
                    const { user } = await getCurrentUser()
                    if (!user) return
                    const totals = res.nickel + res.cobalt + res.copper + res.manganese
                    const payload: Record<string, any> = {
                      user_id: user.id,
                      last_login: new Date().toISOString(),
                      total_resources_mined: totals,
                      nickel: res.nickel,
                      cobalt: res.cobalt,
                      copper: res.copper,
                      manganese: res.manganese,
                      is_active: true,
                    }
                    let { error } = await supabase.from("players").upsert(payload, { onConflict: "user_id" })
                    if (error) {
                      console.warn("[GamePage] Upsert with resource columns failed; falling back to totals only", error?.message)
                      await supabase.from("players").upsert(
                        { user_id: user.id, last_login: new Date().toISOString(), total_resources_mined: totals, is_active: true },
                        { onConflict: "user_id" }
                      )
                    }
                  } finally {
                    savingRef.current = false
                  }
                }, 1500)
              }
            }}
          />
        </div>
      </ErrorBoundary>
    </StyleWrapper>
  );
}
