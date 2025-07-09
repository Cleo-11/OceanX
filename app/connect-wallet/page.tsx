"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Wallet, CheckCircle, Loader2, AlertCircle, ArrowLeft, Anchor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getSession, getCurrentUser, signOut } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

declare global {
  interface Window {
    ethereum?: any
  }
}

type ConnectionStep = "checking" | "connect" | "linking" | "complete" | "error"

export default function ConnectWalletPage() {
  const [step, setStep] = useState<ConnectionStep>("checking")
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [pendingWalletAddress, setPendingWalletAddress] = useState<string>("")
  const [pendingOldUserId, setPendingOldUserId] = useState<string>("")
  const [pendingLinking, setPendingLinking] = useState(false)

  useEffect(() => {
    checkAuthAndWallet()
  }, [])

  const checkAuthAndWallet = async () => {
    try {
      // Check if user is authenticated
      const { session } = await getSession()
      if (!session) {
        router.push("/auth")
        return
      }

      const { user } = await getCurrentUser()
      setUser(user)

      // Debug log for user.id
      console.log("user.id for wallet lookup (checkAuthAndWallet):", user?.id)

      // Check if user already has a wallet connected
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("wallet_address")
        .eq("user_id", user?.id)
        .single()

      if (playerData?.wallet_address) {
        // User already has wallet connected, redirect to game
        router.push("/game")
        return
      }

      setStep("connect")
    } catch (error) {
      console.error("Error checking auth and wallet:", error)
      setError("Failed to verify authentication status")
      setStep("error")
    }
  }

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to continue.")
      setStep("error")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      if (accounts.length === 0) {
        throw new Error("No accounts found")
      }

      const address = accounts[0]
      setWalletAddress(address)
      setStep("linking")

      // Link wallet to user account
      await linkWalletToAccount(address)
    } catch (error: any) {
      console.error("Error connecting wallet:", error)
      if (error.code === 4001) {
        setError("Wallet connection was rejected. Please try again.")
      } else {
        setError(error.message || "Failed to connect wallet")
      }
      setStep("error")
    } finally {
      setIsLoading(false)
    }
  }

  const linkWalletToAccount = async (address: string) => {
    try {
      // Check if wallet is already linked to another account
      // Debug log for user.id
      console.log("user.id for wallet linking (linkWalletToAccount):", user?.id)
      const { data: existingPlayer, error: checkError } = await supabase
        .from("players")
        .select("user_id, username")
        .eq("wallet_address", address)
        .single()

      if (existingPlayer && existingPlayer.user_id !== user?.id) {
        setPendingWalletAddress(address)
        setPendingOldUserId(existingPlayer.user_id)
        setShowTransferDialog(true)
        setStep("connect") // Go back to connect step while waiting for confirmation
        return
      }

      // Create or update player record
      const playerData = {
        user_id: user?.id,
        wallet_address: address,
        username: user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Anonymous",
        last_login: new Date().toISOString(),
        is_active: true,
        submarine_tier: 1,
        total_resources_mined: 0,
        total_ocx_earned: 0,
      }

      const { error: upsertError } = await supabase.from("players").upsert(playerData, {
        onConflict: "user_id",
      })

      if (upsertError) {
        throw upsertError
      }

      setStep("complete")

      // Redirect to game after a short delay
      setTimeout(() => {
        router.push("/game")
      }, 2000)
    } catch (error: any) {
      console.error("Error linking wallet:", error)
      setError(error.message || "Failed to link wallet to account")
      setStep("error")
    }
  }

  const handleConfirmTransfer = async () => {
    setPendingLinking(true)
    setShowTransferDialog(false)
    try {
      if (!pendingOldUserId) {
        setError("Could not determine the previous account for this wallet.")
        setStep("error")
        setPendingLinking(false)
        return
      }
      // Unlink wallet from old user
      await supabase
        .from("players")
        .update({ wallet_address: null })
        .eq("user_id", pendingOldUserId)

      // Now link to current user
      await linkWalletToAccount(pendingWalletAddress)
    } catch (error: any) {
      setError(error.message || "Failed to transfer wallet")
      setStep("error")
    } finally {
      setPendingLinking(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/")
  }

  const renderStepContent = () => {
    switch (step) {
      case "checking":
        return (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Checking Status</h3>
            <p className="text-slate-400">Verifying your authentication...</p>
          </div>
        )

      case "connect":
        return (
          <div className="text-center py-8">
            <Wallet className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-white mb-4">Connect Your Wallet</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Connect your MetaMask wallet to start playing OceanX. Your wallet will be securely linked to your account.
            </p>
            <Button
              onClick={connectWallet}
              disabled={isLoading}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-3 text-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5 mr-2" />
                  Connect MetaMask
                </>
              )}
            </Button>
          </div>
        )

      case "linking":
        return (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Linking Wallet</h3>
            <p className="text-slate-400 mb-4">Connecting your wallet to your account...</p>
            {walletAddress && (
              <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </Badge>
            )}
          </div>
        )

      case "complete":
        return (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-white mb-4">Wallet Connected!</h3>
            <p className="text-slate-400 mb-4">Your wallet has been successfully linked to your account.</p>
            {walletAddress && (
              <Badge variant="secondary" className="bg-slate-700 text-slate-300 mb-6">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </Badge>
            )}
            <p className="text-sm text-slate-500">Redirecting to game...</p>
          </div>
        )

      case "error":
        return (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-white mb-4">Connection Failed</h3>
            <p className="text-slate-400 mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => {
                  setError("")
                  setStep("connect")
                }}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="border-slate-600 text-slate-300 bg-transparent"
              >
                Sign Out
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/auth")}
            className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Auth
          </Button>

          <div className="flex items-center justify-center mb-4">
            <Anchor className="w-8 h-8 text-cyan-400 mr-2" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              OceanX
            </h1>
          </div>

          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${step !== "checking" ? "bg-green-400" : "bg-cyan-400"}`} />
            <div className="w-8 h-0.5 bg-slate-600" />
            <div
              className={`w-3 h-3 rounded-full ${
                step === "complete"
                  ? "bg-green-400"
                  : step === "linking" || step === "connect"
                    ? "bg-cyan-400"
                    : "bg-slate-600"
              }`}
            />
            <div className="w-8 h-0.5 bg-slate-600" />
            <div className={`w-3 h-3 rounded-full ${step === "complete" ? "bg-green-400" : "bg-slate-600"}`} />
          </div>

          <p className="text-sm text-slate-400">Step 2 of 3: Connect Wallet</p>
        </div>

        {/* Main Card */}
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardContent className="p-6">{renderStepContent()}</CardContent>
        </Card>

        {/* User Info */}
        {user && (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              Signed in as <span className="text-slate-300">{user.user_metadata?.full_name || user.email}</span>
            </p>
          </div>
        )}
      </div>
      <AlertDialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              This wallet is already linked to another account. Do you want to unlink it from the old account and link it to your current account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowTransferDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTransfer} disabled={pendingLinking}>
              {pendingLinking ? "Transferring..." : "Yes, Transfer Wallet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
