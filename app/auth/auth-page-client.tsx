"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { NetworkStatus } from "@/components/network-status"
import { 
  signInWithEthereum, 
  signInWithCoinbase, 
  signInWithWalletConnect,
  isEthereumAvailable, 
  isCoinbaseAvailable,
  isWalletConnectAvailable,
  ACTIVE_CHAIN
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
    return <main className="dive" />
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

      if (data?.success) {
        console.log("✅ Ethereum wallet authenticated:", address, "isNewUser:", isNewUser)
        // Wait for cookies to be fully processed by browser
        await new Promise(resolve => setTimeout(resolve, 300))
        // Use replace to ensure cookies are included in next request
        window.location.replace(isNewUser ? "/onboarding" : "/home")
        return // Prevent further execution
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

      if (data?.success) {
        console.log("✅ Coinbase Wallet authenticated:", address, "isNewUser:", isNewUser)
        // Wait for cookies to be fully processed by browser
        await new Promise(resolve => setTimeout(resolve, 300))
        // Use replace to ensure cookies are included in next request
        window.location.replace(isNewUser ? "/onboarding" : "/home")
        return // Prevent further execution
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

      if (data?.success) {
        console.log("✅ WalletConnect authenticated:", address, "isNewUser:", isNewUser)
        // Wait for cookies to be fully processed by browser
        await new Promise(resolve => setTimeout(resolve, 300))
        // Use replace to ensure cookies are included in next request
        window.location.replace(isNewUser ? "/onboarding" : "/home")
        return // Prevent further execution
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

  const wallets = [
    {
      id: "ethereum",
      name: "MetaMask",
      detail: isEthereumAvailable() ? "Browser extension" : "Not installed in this browser",
      available: isEthereumAvailable(),
      onClick: handleEthereumAuth,
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      detail: isCoinbaseAvailable() ? "Browser extension" : "Not installed in this browser",
      available: isCoinbaseAvailable(),
      onClick: handleCoinbaseAuth,
    },
    ...(walletConnectEnabled
      ? [{ id: "walletconnect", name: "WalletConnect", detail: "Scan a QR code with a phone wallet", available: true, onClick: handleWalletConnectAuth }]
      : []),
  ]

  return (
    <main className="dive flex min-h-[100dvh] flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <button type="button" onClick={() => router.push("/")} className="text-lg font-semibold tracking-tight">
          AbyssX
        </button>
      </header>

      <div className="flex flex-1 items-center px-6 pb-16 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <h1 className="dive-display text-4xl">Sign in with your wallet</h1>
          <p className="mt-3 leading-relaxed text-[var(--ink-dim)]">
            Your wallet is your account. You will be asked to sign a message to prove the address is yours; it costs
            nothing and sends no transaction.
          </p>

          {error && (
            <p role="alert" className="mt-6 border-l-2 border-[var(--danger)] pl-3 text-sm">
              {error}
            </p>
          )}

          {mounted && isEthereumAvailable() && (
            <div className="mt-6">
              <NetworkStatus />
            </div>
          )}

          <ul className="mt-8 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {wallets.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={w.onClick}
                  disabled={isLoading || !w.available}
                  className="group flex w-full items-center justify-between gap-4 py-4 text-left disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lamp)]"
                >
                  <span>
                    <span className="block font-semibold">{w.name}</span>
                    <span className="block text-sm text-[var(--ink-dim)]">{w.detail}</span>
                  </span>
                  <span className="text-sm text-[var(--bio)] group-disabled:text-[var(--ink-faint)]">
                    {loadingWallet === w.id ? "Check your wallet…" : w.available ? "Connect" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {!hasAnyWallet && !walletConnectEnabled && (
            <p className="mt-6 text-sm leading-relaxed text-[var(--ink-dim)]">
              You need a wallet to play. Install{" "}
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="dive-link">
                MetaMask
              </a>{" "}
              or{" "}
              <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer" className="dive-link">
                Coinbase Wallet
              </a>
              , then reload this page.
            </p>
          )}

          <p className="mt-8 text-xs leading-relaxed text-[var(--ink-dim)]">
            The game runs on {ACTIVE_CHAIN.name}, a test network. New here? Signing in creates your account and your
            first submarine.
          </p>
        </div>
      </div>
    </main>
  )
}

export default function AuthPageClient() {
  return (
    <Suspense fallback={<main className="dive" />}>
      <AuthPageContent />
    </Suspense>
  )
}
