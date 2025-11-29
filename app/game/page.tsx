"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { signOut } from "@/lib/supabase"
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  // Optional: we no longer require pre-existing player data to play
  // Wallet connection is not required for gameplay
  const [gameState, setGameState] = useState<GameState>("idle");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const latestResourcesRef = useRef<{ nickel: number; cobalt: number; copper: number; manganese: number }>({ nickel: 0, cobalt: 0, copper: 0, manganese: 0 })
  // SubmarineStore moved to dedicated route; no local modal state anymore
  const router = useRouter()

  useEffect(() => {
    console.log("🎮 [GamePage] Component mounted", {
      pathname: window.location.pathname,
    })
    logCssDiagnostics("mount")
    initializeGame()
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // No need to check wallet connection for gameplay

  const initializeGame = async () => {
    try {
      console.info("[GamePage] Starting initialization...")
      
      // Get session directly without refresh attempt
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error("[GamePage] Session error:", sessionError)
        setError("Authentication error. Please sign in again.")
        return
      }
      
      if (!session || !session.user) {
        console.warn("[GamePage] No session found, checking if user is still authenticated...")
        
        // Try to get user directly as a fallback
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          console.error("[GamePage] No user found:", userError)
          setError("Not authenticated. Please sign in.")
          return
        }
        
        // User exists, use it
        console.info("[GamePage] User found via getUser:", {
          userId: user.id,
          email: user.email,
        })
        
        setCurrentUserId(user.id)
        await loadPlayerData(user.id)
        return
      }
      
      const user = session.user
      
      console.info("[GamePage] Session verified:", {
        userId: user.id,
        email: user.email,
      })
      
      // Store user ID for later use in resource saves
      setCurrentUserId(user.id)
      
      await loadPlayerData(user.id)
    } catch (error) {
      console.error("Error initializing game:", error)
      setError("Failed to load game data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const loadPlayerData = async (userId: string) => {
    try {
      // Try to load player record for display, but don't block gameplay
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
      
      if (playerError) {
        console.error("[GamePage] Error loading player data:", playerError)
      } else if (playerData) {
        console.info("[GamePage] Player data loaded:", {
          hasWallet: !!playerData.wallet_address,
          walletAddress: playerData.wallet_address?.slice(0, 10) + "...",
          hasNickelColumn: 'nickel' in playerData,
          hasCobaltColumn: 'cobalt' in playerData,
          hasCopperColumn: 'copper' in playerData,
          hasManganeseColumn: 'manganese' in playerData,
          currentResources: {
            nickel: playerData.nickel,
            cobalt: playerData.cobalt,
            copper: playerData.copper,
            manganese: playerData.manganese,
          }
        })
      } else {
        console.warn("[GamePage] No player record found - may need to create one")
      }
      
      // Best-effort: update last_login
      await supabase.from("players").update({ last_login: new Date().toISOString(), is_active: true }).eq("user_id", userId)
    } catch (error) {
      console.error("[GamePage] Error loading player data:", error)
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
          {/* Saving indicator */}
          {isSaving && (
            <div className="fixed top-4 right-4 z-50 bg-depth-800 border border-ocean-500 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
              <Loader2 className="w-4 h-4 text-ocean-400 animate-spin" />
              <span className="text-sm text-ocean-300">Saving resources...</span>
            </div>
          )}
          
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
              
              // Clear any existing timeout
              if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
              }
              
              // Debounce save to avoid too many DB calls, but make it faster (500ms instead of 1500ms)
              saveTimeoutRef.current = setTimeout(async () => {
                if (savingRef.current) return
                
                // Use stored user ID instead of calling getCurrentUser()
                if (!currentUserId) {
                  console.warn("[GamePage] No user ID available, skipping resource save")
                  return
                }
                
                savingRef.current = true
                setIsSaving(true)
                try {
                  const totals = res.nickel + res.cobalt + res.copper + res.manganese
                  
                  console.info("[GamePage] 💾 Saving resources to database", {
                    userId: currentUserId,
                    resources: res,
                    total: totals,
                  })
                  
                  const payload = {
                    last_login: new Date().toISOString(),
                    total_resources_mined: totals,
                    nickel: res.nickel,
                    cobalt: res.cobalt,
                    copper: res.copper,
                    manganese: res.manganese,
                    is_active: true,
                  }
                  
                  const { data, error } = await supabase
                    .from("players")
                    .update(payload)
                    .eq("user_id", currentUserId)
                    .select()
                  
                  if (error) {
                    console.error("[GamePage] ❌ Failed to save resources:", {
                      error: error.message,
                      code: error.code,
                      details: error.details,
                      hint: error.hint,
                    })
                    
                    // Show alert to user
                    alert(`Failed to save resources: ${error.message}\n\nPlease check the console and run the migration in Supabase.`)
                  } else if (data && data.length > 0) {
                    console.info("[GamePage] ✅ Resources saved successfully", {
                      updatedRows: data.length,
                      savedData: {
                        nickel: data[0].nickel,
                        cobalt: data[0].cobalt,
                        copper: data[0].copper,
                        manganese: data[0].manganese,
                        total: data[0].total_resources_mined,
                      },
                    })
                  } else {
                    console.warn("[GamePage] ⚠️ Update succeeded but no rows returned - player record may not exist")
                  }
                } catch (err) {
                  console.error("[GamePage] ❌ Unexpected error saving resources:", err)
                } finally {
                  savingRef.current = false
                  setIsSaving(false)
                }
              }, 500) // Reduced from 1500ms to 500ms for faster saves
            }}
          />
        </div>
      </ErrorBoundary>
    </StyleWrapper>
  );
}
