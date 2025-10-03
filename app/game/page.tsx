"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getSession, getCurrentUser, signOut } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { OceanMiningGame } from "@/components/ocean-mining-game";
import { SubmarineSelection } from "@/components/submarine-selection";
import { SubmarineStore } from "@/components/submarine-store";
import { walletManager } from "@/lib/wallet";
import { ErrorBoundary } from "@/components/error-boundary";
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

export default function GamePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  // Removed unused 'user' state
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletPrompt, setWalletPrompt] = useState(false);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSubmarineSelection, setShowSubmarineSelection] = useState(false);
  const [selectedSubmarineTier, setSelectedSubmarineTier] = useState<number | null>(null);
  const [hasSelectedSubmarine, setHasSelectedSubmarine] = useState(false);
  const [showSubmarineStore, setShowSubmarineStore] = useState(false);
  const router = useRouter()

  useEffect(() => {
    initializeGame()
  }, [])

  // Set initial submarine tier and show modal after player data loads
  useEffect(() => {
    if (playerData && selectedSubmarineTier === null) {
      setSelectedSubmarineTier(playerData.submarine_tier || 1);
      setShowSubmarineSelection(true);
      setHasSelectedSubmarine(false);
    }
  }, [playerData]);

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
        // Check if user wants to open submarine store
        const shouldOpenStore = sessionStorage.getItem("openSubmarineStore");
        if (shouldOpenStore === "true") {
          sessionStorage.removeItem("openSubmarineStore");
          // Small delay to ensure game is loaded first
          setTimeout(() => {
            setShowSubmarineStore(true);
          }, 1000);
        }
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

  if (walletPrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-cyan-300 mb-4 text-xl font-bold">Connect your wallet to play</p>
          <button
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-3 font-medium text-white shadow-lg hover:from-teal-600 hover:to-cyan-700"
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
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-900">
        {/* Submarine Selection Modal */}
        <SubmarineSelection
          isOpen={showSubmarineSelection && !hasSelectedSubmarine}
          onClose={() => {
            // Prevent closing without selection
            if (selectedSubmarineTier === null && playerData?.submarine_tier) {
              setSelectedSubmarineTier(playerData.submarine_tier);
            }
            setShowSubmarineSelection(false);
          }}
          onSelectSubmarine={(tier) => {
            setSelectedSubmarineTier(tier);
            setShowSubmarineSelection(false);
            setHasSelectedSubmarine(true);
          }}
          initialSelectedTier={playerData?.submarine_tier || 1}
        />

        {/* Submarine Store Modal */}
        <SubmarineStore
          isOpen={showSubmarineStore}
          onClose={() => setShowSubmarineStore(false)}
          currentTier={selectedSubmarineTier || playerData?.submarine_tier || 1}
          resources={{
            nickel: playerData?.nickel || 0,
            cobalt: playerData?.cobalt || 0,
            copper: playerData?.copper || 0,
            manganese: playerData?.manganese || 0
          }}
          balance={playerData?.balance || 0}
          onPurchase={(targetTier) => {
            // Handle submarine purchase logic here
            console.log('Purchasing submarine tier:', targetTier);
            // TODO: Implement purchase logic
            setShowSubmarineStore(false);
          }}
          gameState={gameState}
        />

        {/* Only render game after submarine is selected */}
        {selectedSubmarineTier !== null && hasSelectedSubmarine && (
          <OceanMiningGame
            walletConnected={walletConnected}
            gameState={gameState}
            setGameState={setGameState}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onFullDisconnect={handleFullDisconnect}
            onConnectWallet={handleConnectWallet}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
