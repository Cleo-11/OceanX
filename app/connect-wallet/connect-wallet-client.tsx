"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { Wallet, CheckCircle, Loader2, AlertCircle, ArrowLeft, Anchor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase, signOut } from "@/lib/supabase"
import { sanitizeReturnTo } from '@/lib/utils'
import { StyleWrapper } from "@/components/style-wrapper"

// Avoid conflicting Window.ethereum declarations across lib.dom and other ambient
// types by keeping the global declaration broad. Consumers can cast to a
// specific provider interface where needed.
declare global {
  interface Window {
    // Keep as `any` here to prevent "Subsequent property declarations must have the same type"
    // Type usages should perform a local cast, e.g. `const prov = window.ethereum as EthereumProvider`.
    ethereum?: any
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

      // Note: Server component already handles redirect if wallet is linked
      // This is just a safety check in case we're on the client after a wallet link
      if (playerRecord?.wallet_address) {
        console.info(`${logPrefix} Wallet already linked (client-side check)`, {
          userId: user.id,
        })
        // Server should have redirected, but just in case, do it client-side
        if (typeof window !== "undefined") {
          window.location.href = "/home"
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
  }, [user.id])

  useEffect(() => {
    void verifyWalletStatus()
  }, [verifyWalletStatus])

  const connectWallet = async () => {
    if (typeof window === 'undefined') {
      setError("Please wait for page to load completely.")
      setStep("error")
      return
    }

    if (!window.ethereum) {
      console.warn(`${logPrefix} window.ethereum missing`, { userId: user.id })
      setError("MetaMask is not installed. Please install MetaMask extension to continue.")
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

      if (!Array.isArray(accounts) || accounts.length === 0) {
        console.warn(`${logPrefix} No accounts returned from provider`, { userId: user.id })
        throw new Error("No accounts found. Please make sure MetaMask is unlocked.")
      }

      const address = (accounts as string[])[0]
      console.info(`${logPrefix} Wallet connection approved`, { userId: user.id, address })
      setWalletAddress(address)
      setStep("linking")

      await linkWalletToAccount(address)
    } catch (err: unknown) {
      console.error("Error connecting wallet:", err)
      if (typeof err === "object" && err !== null && "code" in err && (err as { code?: number }).code === 4001) {
        console.warn(`${logPrefix} Wallet connection rejected by user`, { userId: user.id })
        setError("Wallet connection was rejected. Please try again and approve the connection in MetaMask.")
      } else if (err instanceof Error) {
        setError(err.message || "Failed to connect wallet")
      } else {
        setError("Failed to connect wallet. Please make sure MetaMask is installed and unlocked.")
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
        throw new Error(
          `This wallet is already linked to another account (${existingPlayerByWallet.username || 'Unknown User'}). ` +
          `Please use a different wallet or contact support if you believe this is an error.`
        )
      }

      // Player row should already exist from auth trigger
      // We only need to UPDATE the wallet_address (and refresh last_login)
      const playerData = {
        wallet_address: address,
        username: fallbackUsername,
        last_login: new Date().toISOString(),
        is_active: true,
        submarine_tier: existingPlayer?.submarine_tier ?? 1,
        total_resources_mined: existingPlayer?.total_resources_mined ?? 0,
        total_ocx_earned: existingPlayer?.total_ocx_earned ?? 0,
      }

      const { error: updateError } = await supabase
        .from("players")
        .update(playerData)
        .eq("user_id", user.id)

      if (updateError) {
        console.error(`${logPrefix} Player update failed`, {
          userId: user.id,
          message: updateError.message,
          code: updateError.code,
          details: updateError.details,
        })
        throw updateError
      }

      console.info(`${logPrefix} Wallet linked successfully`, {
        userId: user.id,
        address,
      })

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
            {typeof window !== 'undefined' && !window.ethereum && (
              <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-200 text-sm mb-2">
                  ⚠️ MetaMask not detected
                </p>
                <p className="text-yellow-300 text-xs mb-3">
                  Please install the MetaMask browser extension to continue.
                </p>
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ocean-400 hover:text-ocean-300 underline text-sm"
                >
                  Download MetaMask →
                </a>
              </div>
            )}
            <Button
              onClick={connectWallet}
              disabled={isLoading || (typeof window !== 'undefined' && !window.ethereum)}
              className="bg-gradient-to-r from-ocean-500 to-abyss-600 hover:from-ocean-600 hover:to-abyss-700 text-white px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </StyleWrapper>
  )
}
