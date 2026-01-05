"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Anchor, ArrowLeft, Loader2, AlertCircle, Wallet, ExternalLink, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  signInWithEthereum, 
  signInWithCoinbase, 
  signInWithWalletConnect,
  isEthereumAvailable, 
  isCoinbaseAvailable,
  isWalletConnectAvailable,
  ACTIVE_BASE_CHAIN
} from "@/lib/web3auth"

function AuthPageContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadingWallet, setLoadingWallet] = useState<string | null>(null)
  const [error, setError] = useState<string>("")
  const [mounted, setMounted] = useState(false)


  const router = useRouter()
  const searchParams = useSearchParams()
  const authError = searchParams.get("error")

  useEffect(() => {
    setMounted(true)

    // Handle different error types from the callback
    if (authError) {
      const errorMessages: Record<string, string> = {
        'auth_error': 'Authentication failed. Please try again.',
        'session_error': 'Failed to create session. Please try again.',
        'no_session': 'Session could not be established. Please try again.',
        'session_not_persisted': 'Session not saved properly. Please try again.',
        'unexpected_error': 'An unexpected error occurred. Please try again.',
        'missing_code': 'Invalid authentication callback. Please try again.',
      }
      
      setError(errorMessages[authError] || 'Authentication failed. Please try again.')
      console.error("[auth-page-client] Auth error:", authError)
    }
  }, [authError])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-ocean-400 animate-spin mx-auto mb-4" />
          <p className="text-depth-400">Loading...</p>
        </div>
      </div>
    )
  }

  const handleEthereumAuth = async () => {
    setIsLoading(true)
    setLoadingWallet("ethereum")
    setError("")

    try {
      const { data, error, address, isNewUser } = await signInWithEthereum()
      
      if (error) {
        throw error
      }

      if (data?.session) {
        console.log("✅ Ethereum wallet authenticated:", address, "isNewUser:", isNewUser)
        // Force refresh to pick up the new session cookies
        router.refresh()
        // Small delay to ensure cookies are set before navigation
        setTimeout(() => {
          // Redirect new users to onboarding, returning users to home
          window.location.href = isNewUser ? "/onboarding" : "/home"
        }, 100)
      }
    } catch (error) {
      console.error("Ethereum authentication error:", error)
      setError(error instanceof Error ? error.message : "Ethereum wallet authentication failed")
    } finally {
      setIsLoading(false)
      setLoadingWallet(null)
    }
  }

  const handleCoinbaseAuth = async () => {
    setIsLoading(true)
    setLoadingWallet("coinbase")
    setError("")

    try {
      const { data, error, address, isNewUser } = await signInWithCoinbase()
      
      if (error) {
        throw error
      }

      if (data?.session) {
        console.log("✅ Coinbase Wallet authenticated:", address, "isNewUser:", isNewUser)
        // Force refresh to pick up the new session cookies
        router.refresh()
        setTimeout(() => {
          window.location.href = isNewUser ? "/onboarding" : "/home"
        }, 100)
      }
    } catch (error) {
      console.error("Coinbase Wallet authentication error:", error)
      setError(error instanceof Error ? error.message : "Coinbase Wallet authentication failed")
    } finally {
      setIsLoading(false)
      setLoadingWallet(null)
    }
  }

  const handleWalletConnectAuth = async () => {
    setIsLoading(true)
    setLoadingWallet("walletconnect")
    setError("")

    try {
      const { data, error, address, isNewUser } = await signInWithWalletConnect()
      
      if (error) {
        throw error
      }

      if (data?.session) {
        console.log("✅ WalletConnect authenticated:", address, "isNewUser:", isNewUser)
        // Force refresh to pick up the new session cookies
        router.refresh()
        setTimeout(() => {
          window.location.href = isNewUser ? "/onboarding" : "/home"
        }, 100)
      }
    } catch (error) {
      console.error("WalletConnect authentication error:", error)
      setError(error instanceof Error ? error.message : "WalletConnect authentication failed")
    } finally {
      setIsLoading(false)
      setLoadingWallet(null)
    }
  }

  const hasAnyWallet = isEthereumAvailable() || isCoinbaseAvailable()
  const walletConnectEnabled = isWalletConnectAvailable()

  return (
    <div className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="inline-flex items-center text-depth-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex items-center justify-center mb-4">
            <Anchor className="w-8 h-8 text-ocean-400 mr-2" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-ocean-400 to-abyss-400 bg-clip-text text-transparent">
              AbyssX
            </h1>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-depth-400">
            Sign in with your Web3 wallet to start mining
          </p>
        </div>

        <div className="bg-depth-800/50 backdrop-blur-sm rounded-xl p-6 border border-depth-700">
          {error && (
            <Alert className="mb-4 border-red-500/30 bg-red-900/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-200">{error}</AlertDescription>
            </Alert>
          )}

          {/* Web3 Wallet Authentication Header */}
          <div className="flex items-center justify-center mb-4">
            <Wallet className="w-5 h-5 text-ocean-400 mr-2" />
            <span className="text-sm text-depth-300 font-medium">Web3 Authentication</span>
          </div>
          
          {/* BASE Network Badge */}
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30">
              <div className="w-2 h-2 rounded-full bg-blue-400 mr-2 animate-pulse"></div>
              <span className="text-xs text-blue-400 font-medium">
                Powered by {ACTIVE_BASE_CHAIN.name}
              </span>
            </div>
          </div>

          {/* Ethereum Wallet */}
          <Button
            onClick={handleEthereumAuth}
            disabled={isLoading || !isEthereumAvailable()}
            className="w-full flex items-center justify-center px-4 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3 h-14"
          >
            {loadingWallet === "ethereum" ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <span className="text-2xl mr-3">🦊</span>
            )}
            <div className="flex flex-col items-start">
              <span className="font-semibold">MetaMask</span>
              {!isEthereumAvailable() && (
                <span className="text-xs opacity-75">Not detected</span>
              )}
            </div>
          </Button>

          {/* Coinbase Wallet - Base Native */}
          <Button
            onClick={handleCoinbaseAuth}
            disabled={isLoading || !isCoinbaseAvailable()}
            className="w-full flex items-center justify-center px-4 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3 h-14"
          >
            {loadingWallet === "coinbase" ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <span className="text-2xl mr-3">🔵</span>
            )}
            <div className="flex flex-col items-start">
              <span className="font-semibold">Coinbase Wallet</span>
              <span className="text-xs opacity-75">
                {!isCoinbaseAvailable() ? "Not detected" : "Base native ✨"}
              </span>
            </div>
          </Button>

          {/* WalletConnect - Mobile Wallet Support */}
          {walletConnectEnabled && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-depth-600"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-depth-800 text-depth-500 flex items-center">
                    <Smartphone className="w-3 h-3 mr-1" />
                    Mobile Wallet
                  </span>
                </div>
              </div>
              
              <Button
                onClick={handleWalletConnectAuth}
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-4 bg-gradient-to-r from-sky-500 to-cyan-600 text-white rounded-lg font-medium hover:from-sky-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4 h-14"
              >
                {loadingWallet === "walletconnect" ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <span className="text-2xl mr-3">🔗</span>
                )}
                <div className="flex flex-col items-start">
                  <span className="font-semibold">WalletConnect</span>
                  <span className="text-xs opacity-75">Mobile wallet on {ACTIVE_BASE_CHAIN.name}</span>
                </div>
              </Button>
            </>
          )}

          {/* No wallet detected message */}
          {!hasAnyWallet && !walletConnectEnabled && (
            <div className="mt-4 p-4 rounded-lg bg-depth-700/50 border border-depth-600">
              <p className="text-sm text-depth-300 mb-3">
                No wallet detected. Install one of these to continue:
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 rounded-md bg-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/30 transition-colors"
                >
                  MetaMask <ExternalLink className="w-3 h-3 ml-1" />
                </a>
                <a
                  href="https://www.coinbase.com/wallet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors"
                >
                  Coinbase <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            </div>
          )}

          {/* Security info */}
          <div className="mt-6 pt-4 border-t border-depth-700">
            <div className="flex items-start space-x-2 text-xs text-depth-400">
              <span className="text-ocean-400">🔐</span>
              <p>
                We use <span className="text-ocean-400 font-medium">Sign-In with Ethereum (SIWE)</span> for secure, 
                passwordless authentication. Your wallet signature proves ownership without sharing your private keys.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-depth-500 text-center mt-6">
          By connecting your wallet, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}

export default function AuthPageClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-depth-950 via-depth-900 to-depth-950 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-ocean-400 animate-spin mx-auto mb-4" />
            <p className="text-depth-400">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  )
}
