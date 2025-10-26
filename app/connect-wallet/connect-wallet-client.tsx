"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { Wallet, CheckCircle, Loader2, AlertCircle, ArrowLeft, Anchor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase, signOut } from "@/lib/supabase"
import { sanitizeReturnTo } from '@/lib/utils'
import { StyleWrapper } from "@/components/style-wrapper"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

// Minimal typing for the injected Ethereum provider to avoid `any`.
declare global {
  interface EthereumProvider {
    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  }
  interface Window {
    ethereum?: EthereumProvider
  }
}

type ConnectionStep = "checking" | "connect" | "linking" | "complete" | "error"

type ExistingPlayer = {
  username: string | null
  submarine_tier: number | null
  total_resources_mined: number | null
  total_ocx_earned: number | null
}

interface ConnectWalletClientProps {
  user: Pick<User, "id" | "user_metadata"> & { email: string | null }
  existingPlayer: ExistingPlayer | null
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
    } catch {
      return `${index}: <inaccessible>`
    }
  })

  console.log("🛰️ [ConnectWalletClient] CSS diagnostics", {
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

export default function ConnectWalletClient({ user, existingPlayer }: ConnectWalletClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<ConnectionStep>("checking")
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [pendingWalletAddress, setPendingWalletAddress] = useState<string>("")
  const [pendingOldUserId, setPendingOldUserId] = useState<string>("")
  const [pendingLinking, setPendingLinking] = useState(false)
  const redirectGuard = useRef(false)
  const logPrefix = "[connect-wallet/client]"

  useEffect(() => {
    console.log("🔐 [ConnectWalletClient] Component mounted", {
      userId: user.id,
      step,
      pathname: window.location.pathname,
      referrer: document.referrer,
      visibilityState: document.visibilityState,
      time: new Date().toISOString(),
    })
    logCssDiagnostics("mount")
    return () => {
      console.log("🔐 [ConnectWalletClient] Component unmounted", {
        userId: user.id,
        time: new Date().toISOString(),
      })
    }
  }, [])

  const fallbackUsername = useMemo(() => {
    return (
      existingPlayer?.username ||
      (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ||
      user.email?.split("@")[0] ||
      "Anonymous"
    )
  }, [existingPlayer?.username, user.email, user.user_metadata?.full_name])

  const verifyWalletStatus = useCallback(async () => {
    console.info(`${logPrefix} Verifying wallet status`, { userId: user.id })

    try {
      const { data: playerRecord, error: playerError } = await supabase
        .from("players")
        .select("wallet_address")
        .eq("user_id", user.id)
        .maybeSingle()

      if (playerError && playerError.code !== "PGRST116") {
        console.error(`${logPrefix} Error returned from wallet status lookup`, {
          userId: user.id,
          code: playerError.code,
          message: playerError.message,
        })
        throw playerError
      }

      if (playerRecord?.wallet_address) {
        console.info(`${logPrefix} Wallet already linked, redirecting to /home`, {
          userId: user.id,
        })

        // Prevent repeated redirects: only perform the client navigation once per mount
        if (!redirectGuard.current) {
          redirectGuard.current = true
          // Use replace to avoid polluting history; if already on /home, do nothing
          try {
            if (typeof window !== "undefined" && window.location.pathname !== "/home") {
              router.replace("/home")
            } else {
              console.info(`${logPrefix} Already on /home, skipping router.replace`)
            }
          } catch (e) {
            console.error(`${logPrefix} Failed to router.replace('/home')`, e)
            // As a fallback perform a hard navigation
            if (typeof window !== "undefined") window.location.href = "/home"
          }
        } else {
          console.info(`${logPrefix} Redirect already attempted; skipping duplicate`) 
        }

        return
      }

      console.info(`${logPrefix} No wallet linked, transitioning to connect step`, {
        userId: user.id,
      })
      setStep("connect")
    } catch (err) {
      console.error("Error verifying wallet status:", err)
      setError("Failed to verify wallet status. Please try again.")
      setStep("error")
    }
  }, [router, user.id])

  useEffect(() => {
    void verifyWalletStatus()
  }, [verifyWalletStatus])

  const connectWallet = async () => {
    if (!window.ethereum) {
      console.warn(`${logPrefix} window.ethereum missing`, { userId: user.id })
      setError("MetaMask is not installed. Please install MetaMask to continue.")
      setStep("error")
      return
    }

    console.info(`${logPrefix} Requesting wallet connection`, { userId: user.id })
    setIsLoading(true)
    setError("")

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      if (!accounts?.length) {
        console.warn(`${logPrefix} No accounts returned from provider`, { userId: user.id })
        throw new Error("No accounts found")
      }

      const address = accounts[0]
      console.info(`${logPrefix} Wallet connection approved`, { userId: user.id, address })
      setWalletAddress(address)
      setStep("linking")

      await linkWalletToAccount(address)
    } catch (err: unknown) {
      console.error("Error connecting wallet:", err)
      if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 4001) {
        console.warn(`${logPrefix} Wallet connection rejected by user`, { userId: user.id })
        setError("Wallet connection was rejected. Please try again.")
      } else if (err instanceof Error) {
        setError(err.message || "Failed to connect wallet")
      } else {
        setError("Failed to connect wallet")
      }
      setStep("error")
    } finally {
      setIsLoading(false)
    }
  }

  const linkWalletToAccount = async (address: string) => {
    console.info(`${logPrefix} Linking wallet to account`, { userId: user.id, address })

    try {
      const { data: existingPlayerByWallet, error: lookupError } = await supabase
        .from("players")
        .select("user_id, username")
        .eq("wallet_address", address)
        .maybeSingle()

      if (lookupError && lookupError.code !== "PGRST116") {
        console.error(`${logPrefix} Wallet lookup error`, {
          userId: user.id,
          code: lookupError.code,
          message: lookupError.message,
        })
        throw lookupError
      }

      if (existingPlayerByWallet && existingPlayerByWallet.user_id !== user.id) {
        console.warn(`${logPrefix} Wallet already linked to another user`, {
          userId: user.id,
          existingUserId: existingPlayerByWallet.user_id,
        })
        setPendingWalletAddress(address)
        setPendingOldUserId(existingPlayerByWallet.user_id)
        setShowTransferDialog(true)
        setStep("connect")
        return
      }

      // Player row should already exist from auth trigger
      // We only need to UPDATE the wallet_address (and refresh last_login)
      // If the row doesn't exist (legacy/edge case), upsert will create it
      const playerData = {
        user_id: user.id,
        wallet_address: address,
        username: fallbackUsername,
        last_login: new Date().toISOString(),
        is_active: true,
        submarine_tier: existingPlayer?.submarine_tier ?? 1,
        total_resources_mined: existingPlayer?.total_resources_mined ?? 0,
        total_ocx_earned: existingPlayer?.total_ocx_earned ?? 0,
      }

      const { error: upsertError } = await supabase.from("players").upsert(playerData, {
        onConflict: "user_id",
      })

      if (upsertError) {
        console.error(`${logPrefix} Player upsert failed`, {
          userId: user.id,
          message: upsertError.message,
          code: upsertError.code,
          details: upsertError.details,
        })
        throw upsertError
      }

      console.info(`${logPrefix} Wallet linked successfully`, {
        userId: user.id,
        address,
      })
      setPendingWalletAddress("")
      setPendingOldUserId("")
      setShowTransferDialog(false)
      setPendingLinking(false)

      setStep("complete")

      setTimeout(async () => {
        console.info(`${logPrefix} Navigating after successful link`, {
          userId: user.id,
        })

        try {
          // Prefer a validated returnTo query param when present
          const params = new URLSearchParams(window.location.search)
          const returnToRaw = params.get('returnTo')
          const validated = sanitizeReturnTo(returnToRaw)
          let target = validated || '/home'

          try {
            // Extract pending id from returnTo query if present
            const targetUrl = new URL(target, window.location.origin)
            const pendingId = targetUrl.searchParams.get('pending')
            if (pendingId) {
              try {
                const execResp = await fetch(`/api/hangar/pending/${encodeURIComponent(pendingId)}/execute`, { method: 'POST' })
                if (!execResp.ok) {
                  console.warn(`${logPrefix} Pending execute failed`, await execResp.text())
                }
                // Remove pending param from redirect target
                targetUrl.searchParams.delete('pending')
                target = targetUrl.pathname + targetUrl.search
              } catch (execErr) {
                console.error(`${logPrefix} Error executing pending action`, execErr)
              }
            }
                  } catch {
                    // ignore malformed URL; fall back to raw returnTo
                  }

          router.replace(target)
        } catch (e) {
          console.warn(`${logPrefix} Failed to parse returnTo, falling back to /home`, e)
          router.replace('/home')
        }
      }, 1000)
    } catch (err) {
      console.error("Error linking wallet:", err)
      if (err instanceof Error) {
        setError(err.message || "Failed to link wallet to account")
      } else {
        setError("Failed to link wallet to account")
      }
      setStep("error")
    }
  }

  const handleConfirmTransfer = async () => {
    console.info(`${logPrefix} Confirming wallet transfer`, {
      userId: user.id,
      pendingOldUserId,
      pendingWalletAddress,
    })
    setPendingLinking(true)
    setShowTransferDialog(false)
    try {
      if (!pendingOldUserId) {
        throw new Error("Could not determine the previous account for this wallet.")
      }

      await supabase
        .from("players")
        .update({ wallet_address: null })
        .eq("user_id", pendingOldUserId)

      console.info(`${logPrefix} Previous wallet link cleared`, {
        userId: user.id,
        previousUserId: pendingOldUserId,
      })

      await linkWalletToAccount(pendingWalletAddress)
      setPendingWalletAddress("")
      setPendingOldUserId("")
      setPendingLinking(false)
      setShowTransferDialog(false)
    } catch (err) {
      console.error("Error transferring wallet:", err)
      if (err instanceof Error) {
        setError(err.message || "Failed to transfer wallet")
      } else {
        setError("Failed to transfer wallet")
      }
      setStep("error")
      setPendingLinking(false)
      setShowTransferDialog(false)
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
            <Loader2 className="w-12 h-12 text-ocean-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Checking Status</h3>
            <p className="text-depth-400">Verifying your authentication...</p>
          </div>
        )
      case "connect":
        return (
          <div className="text-center py-8">
            <Wallet className="w-16 h-16 text-ocean-400 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-white mb-4">Connect Your Wallet</h3>
            <p className="text-depth-400 mb-6 max-w-md mx-auto">
              Connect your MetaMask wallet to start playing AbyssX. Your wallet will be securely linked to your account.
            </p>
            <Button
              onClick={connectWallet}
              disabled={isLoading}
              className="bg-gradient-to-r from-ocean-500 to-abyss-600 hover:from-ocean-600 hover:to-abyss-700 text-white px-8 py-3 text-lg"
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
            <Loader2 className="w-12 h-12 text-ocean-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Linking Wallet</h3>
            <p className="text-depth-400 mb-4">Connecting your wallet to your account...</p>
            {walletAddress && (
              <Badge variant="secondary" className="bg-depth-700 text-depth-300">
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
            <p className="text-depth-400 mb-4">Your wallet has been successfully linked to your account.</p>
            {walletAddress && (
              <Badge variant="secondary" className="bg-depth-700 text-depth-300 mb-6">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </Badge>
            )}
            <p className="text-sm text-depth-500">Redirecting to game...</p>
          </div>
        )
      case "error":
        return (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-white mb-4">Connection Failed</h3>
            <p className="text-depth-400 mb-6">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => {
                  setError("")
                  setStep("connect")
                }}
                className="bg-gradient-to-r from-ocean-500 to-abyss-600 hover:from-ocean-600 hover:to-abyss-700 text-white"
              >
                Try Again
              </Button>
              <Button variant="outline" onClick={handleSignOut} className="border-depth-600 text-depth-300 bg-transparent">
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
    <StyleWrapper className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/auth")}
            className="inline-flex items-center text-depth-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Auth
          </Button>

          <div className="flex items-center justify-center mb-4">
            <Anchor className="w-8 h-8 text-ocean-400 mr-2" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-ocean-400 to-abyss-400 bg-clip-text text-transparent">
              AbyssX
            </h1>
          </div>

          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${step !== "checking" ? "bg-green-400" : "bg-ocean-400"}`} />
            <div className="w-8 h-0.5 bg-depth-600" />
            <div
              className={`w-3 h-3 rounded-full ${
                step === "complete"
                  ? "bg-green-400"
                  : step === "linking" || step === "connect"
                    ? "bg-ocean-400"
                    : "bg-depth-600"
              }`}
            />
            <div className="w-8 h-0.5 bg-depth-600" />
            <div className={`w-3 h-3 rounded-full ${step === "complete" ? "bg-green-400" : "bg-depth-600"}`} />
          </div>
        </div>

        <Card className="bg-depth-800/50 backdrop-blur-sm border border-depth-700">
          <CardContent className="p-6">
            {renderStepContent()}
          </CardContent>
        </Card>

        <AlertDialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <AlertDialogContent className="bg-depth-900 border border-depth-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Wallet Already Linked</AlertDialogTitle>
              <AlertDialogDescription className="text-depth-300">
                This wallet is currently linked to another account. Would you like to transfer it to this account?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-depth-700 text-depth-300">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmTransfer}
                disabled={pendingLinking}
                className="bg-gradient-to-r from-ocean-500 to-abyss-600 hover:from-ocean-600 hover:to-abyss-700"
              >
                {pendingLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Transfer Wallet"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </StyleWrapper>
  )
}
