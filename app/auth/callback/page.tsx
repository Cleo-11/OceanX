"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"

export default function AuthCallbackPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    const completeSignIn = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
      const accessToken = hashParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token")
      const providerError = hashParams.get("error") || params.get("error")

      console.log("[auth/callback/page] Handling callback", {
        hasCode: Boolean(code),
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
        providerError,
      })

      if (providerError) {
        setStatus("error")
        setErrorMessage("Authentication failed. Please try again.")
        return
      }

      try {
        const response = await fetch("/auth/callback/exchange", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: code ?? undefined,
            access_token: accessToken ?? undefined,
            refresh_token: refreshToken ?? undefined,
          }),
        })

        if (!response.ok) {
          const { error } = await response.json().catch(() => ({ error: "unknown_error" }))
          console.error("[auth/callback/page] Exchange endpoint returned error", error)
          setStatus("error")
          setErrorMessage("Unable to complete sign in. Please try again.")
          return
        }

  console.log("[auth/callback/page] Session established, redirecting to /connect-wallet")
  window.location.replace("/connect-wallet")
      } catch (error) {
        console.error("[auth/callback/page] Unexpected error while completing sign in", error)
        setStatus("error")
        setErrorMessage("Unexpected error during sign in. Please try again.")
      }
    }

    completeSignIn()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === "loading" ? (
          <>
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-semibold text-white mb-2">Completing sign in...</h1>
            <p className="text-slate-300">
              Hold tight while we finish connecting your account and redirect you to the game lobby.
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-6" />
            <h1 className="text-2xl font-semibold text-white mb-2">Sign in failed</h1>
            <p className="text-slate-300 mb-4">{errorMessage}</p>
            <a
              href="/auth"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-cyan-500 text-white hover:bg-cyan-600 transition"
            >
              Back to sign in
            </a>
          </>
        )}
      </div>
    </div>
  )
}
