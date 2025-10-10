"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getSession, getCurrentUser, signOut } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { OceanMiningGame } from "@/components/ocean-mining-game";
import { walletManager } from "@/lib/wallet";
import { ErrorBoundary } from "@/components/error-boundary";
import { StyleWrapper } from "@/components/style-wrapper";
// ...existing code...
import { GameState } from "@/lib/types";

interface PlayerData {
  id: string;
  user_id: string;
  wallet_address: string;
  username: string;
  submarine_tier: number;
  total_resources_mined: number;
  total_ocx_earned: number;
  last_login: string;
  is_active: boolean;
  nickel?: number;
  cobalt?: number;
  copper?: number;
  manganese?: number;
  balance?: number;
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
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  // Removed unused 'user' state
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletPrompt, setWalletPrompt] = useState(false);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // SubmarineStore moved to dedicated route; no local modal state anymore
  const router = useRouter()

  useEffect(() => {
    console.log("🎮 [GamePage] Component mounted", {
      pathname: window.location.pathname,
    })
    logCssDiagnostics("mount")
    initializeGame()
  }, [])

  // After playerData is loaded, check wallet connection
  useEffect(() => {
    if (playerData && playerData.wallet_address) {
      const connection = walletManager.getConnection();
      if (!connection) {
        setWalletPrompt(true);
      } else if (connection.address.toLowerCase() !== playerData.wallet_address.toLowerCase()) {
        setWalletPrompt(true);
      } else {
        setWalletConnected(true);
      }
    }
  }, [playerData]);

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

  // ...existing code...

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

  const handleConnectWallet = async () => {
    try {
      const connection = await walletManager.connectWallet();
      if (!playerData?.wallet_address) {
        alert("No wallet address found in player data. Please reconnect your account.");
        return;
      }
      if (connection.address.toLowerCase() !== playerData.wallet_address.toLowerCase()) {
        alert("Please connect the wallet you registered with: " + playerData.wallet_address);
        return;
      }
      setWalletConnected(true);
      setWalletPrompt(false);
    } catch (e) {
      console.error("Failed to connect wallet:", e);
      alert("Failed to connect wallet. Please try again.");
    }
  };

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


  if (!playerData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-depth-400">No player data found</p>
        </div>
      </div>
    )
  }

  if (walletPrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-ocean-300 mb-4 text-xl font-bold">Connect your wallet to play</p>
          <button
            className="rounded-lg bg-gradient-to-r from-ocean-500 to-abyss-600 px-6 py-3 font-medium text-white shadow-lg hover:from-ocean-600 hover:to-abyss-700"
            onClick={async () => {
              try {
                const connection = await walletManager.connectWallet();
                if (connection.address.toLowerCase() !== playerData.wallet_address.toLowerCase()) {
                  alert("Please connect the wallet you registered with: " + playerData.wallet_address);
                  return;
                }
                setWalletConnected(true);
                setWalletPrompt(false);
              } catch (e) {
                alert("Failed to connect wallet. Please try again.");
              }
            }}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <StyleWrapper>
      <ErrorBoundary>
        <div className="min-h-screen bg-depth-900">
          {/* Submarine Store moved to dedicated route at /submarine-store */}

          {/* Render game directly without submarine selection modal */}
          <OceanMiningGame
            walletConnected={walletConnected}
            gameState={gameState}
            setGameState={setGameState}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onFullDisconnect={handleFullDisconnect}
            onConnectWallet={handleConnectWallet}
          />
        </div>
      </ErrorBoundary>
    </StyleWrapper>
  );
}
