"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { Anchor, ArrowLeft, Wallet, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { walletManager } from "@/lib/wallet"
import { apiClient } from "@/lib/api"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ConnectWalletPage() {
  const [user, setUser] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [step, setStep] = useState<"loading" | "connect" | "linking" | "complete">("loading")
  const router = useRouter()

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/auth")
        return
      }

      setUser(session.user)

      // Check if user already has a wallet connected
      const { data: profile } = await supabase
        .from("players")
        .select("wallet_address")
        .eq("user_id", session.user.id)
        .single()

      if (profile?.wallet_address) {
        setWalletAddress(profile.wallet_address)
        setWalletConnected(true)
        setStep("complete")
      } else {
        setStep("connect")
      }
    } catch (error) {
      console.error("Auth check error:", error)
      setError("Failed to verify authentication")
      setStep("connect")
    }
  }

  const handleConnectWallet = async () => {
    if (!user) {
      setError("Please authenticate first")
      return
    }

    setIsConnecting(true)
    setError("")
    setStep("linking")

    try {
      // Connect wallet
      const connection = await walletManager.connectWallet()

      // Create authentication message
      const message = `Welcome to OceanX!\n\nLink your wallet to your account.\n\nUser: ${user.email}\nWallet: ${connection.address}\nTimestamp: ${Date.now()}`

      // Sign message
      const signature = await walletManager.signMessage(message)

      // Create or update player profile in Supabase
      const { data: existingPlayer } = await supabase.from("players").select("*").eq("user_id", user.id).single()

      let playerData
      if (existingPlayer) {
        // Update existing player with wallet
        const { data, error } = await supabase
          .from("players")
          .update({
            wallet_address: connection.address.toLowerCase(),
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .select()
          .single()

        if (error) throw error
        playerData = data
      } else {
        // Create new player profile
        const { data, error } = await supabase
          .from("players")
          .insert({
            user_id: user.id,
            wallet_address: connection.address.toLowerCase(),
            username: user.email?.split("@")[0] || "Player",
            submarine_tier: 0,
            total_ocx_earned: 0,
            total_resources_mined: 0,
            last_reward_claim: new Date().toISOString(),
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) throw error
        playerData = data
      }

      // Authenticate with game backend
      const authResponse = await apiClient.connectWallet(connection.address, signature, message)

      if (authResponse.success) {
        setWalletConnected(true)
        setWalletAddress(connection.address)
        setStep("complete")

        // Auto-redirect to game after 2 seconds
        setTimeout(() => {
          router.push("/game")
        }, 2000)
      } else {
        throw new Error(authResponse.error || "Backend authentication failed")
      }
    } catch (error) {
      console.error("Wallet connection failed:", error)
      setError(`Failed to connect wallet: ${error instanceof Error ? error.message : "Unknown error"}`)
      setStep("connect")
      walletManager.disconnect()
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    walletManager.disconnect()
    router.push("/")
  }

  const handleContinueToGame = () => {
    router.push("/game")
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </button>

          <div className="flex items-center justify-center mb-4">
            <Anchor className="w-8 h-8 text-cyan-400 mr-2" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              OceanX
            </h1>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400">Link your Web3 wallet to start your deep sea mining adventure</p>
        </div>

        {/* User Info */}
        {user && (
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4 mb-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Signed in as</p>
                <p className="text-white font-medium">{user.email}</p>
              </div>
              <button onClick={handleSignOut} className="text-xs text-slate-400 hover:text-white transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Wallet Connection Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-500/30 text-red-200 text-sm flex items-start">
              <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {step === "connect" && (
            <div className="text-center">
              <Wallet className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-slate-400 mb-6">
                Connect your Web3 wallet to store your progress and trade resources on the blockchain.
              </p>

              <button
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Wallet className="w-5 h-5 mr-2" />}
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>

              <div className="mt-4 text-xs text-slate-500 space-y-1">
                <p>• MetaMask or compatible wallet required</p>
                <p>• Sepolia testnet supported</p>
                <p>• Your wallet will be linked to your account</p>
              </div>
            </div>
          )}

          {step === "linking" && (
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Linking Wallet</h3>
              <p className="text-slate-400 mb-4">
                Please sign the message in your wallet to complete the linking process.
              </p>
              <div className="text-sm text-slate-500">
                This creates a secure connection between your account and wallet.
              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Wallet Connected!</h3>
              <p className="text-slate-400 mb-4">Your wallet has been successfully linked to your account.</p>

              {walletAddress && (
                <div className="bg-slate-700/50 rounded-lg p-3 mb-6">
                  <p className="text-xs text-slate-400 mb-1">Connected Wallet</p>
                  <p className="text-sm text-cyan-400 font-mono break-all">{walletAddress}</p>
                </div>
              )}

              <button
                onClick={handleContinueToGame}
                className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-teal-700 transition-all"
              >
                Continue to Game
                <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          Your wallet information is securely stored and encrypted
        </p>
      </div>
    </div>
  )
}
