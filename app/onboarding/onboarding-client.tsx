"use client"

import { useState } from "react"

interface OnboardingClientProps {
  walletAddress: string
}

export default function OnboardingClient({ walletAddress }: OnboardingClientProps) {
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const validateUsername = (name: string): string | null => {
    if (name.length < 3) {
      return "Use at least 3 characters."
    }
    if (name.length > 20) {
      return "Use 20 characters or fewer."
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return "Use only letters, numbers, underscores and hyphens."
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateUsername(username)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/player/set-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to set username")
      }

      // Success - redirect to home
      window.location.href = "/home"
    } catch (err) {
      console.error("Error setting username:", err)
      setError(err instanceof Error ? err.message : "Failed to set username")
    } finally {
      setIsLoading(false)
    }
  }

  const shortenedAddress = walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : null

  return (
    <main className="dive flex min-h-[100dvh] flex-col">
      <header className="px-6 py-5 sm:px-10">
        <span className="text-lg font-semibold tracking-tight">AbyssX</span>
      </header>
      <div className="flex flex-1 items-center px-6 pb-16 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <h1 className="dive-display text-4xl">Name your diver</h1>
          <p className="mt-3 leading-relaxed text-[var(--ink-dim)]">
            This is the name other divers see on the leaderboard.
            {shortenedAddress && <> It belongs to wallet {shortenedAddress}.</>}
          </p>

          <form onSubmit={handleSubmit} className="mt-8" noValidate>
            <label htmlFor="username" className="block text-sm font-medium">
              Diver name
            </label>
            <input
              id="username"
              type="text"
              autoComplete="nickname"
              autoFocus
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setError("")
              }}
              maxLength={20}
              disabled={isLoading}
              aria-invalid={!!error}
              aria-describedby="username-help username-error"
              className="dive-input mt-2 text-base"
            />
            <p id="username-help" className="mt-2 text-xs text-[var(--ink-dim)]">
              3 to 20 characters: letters, numbers, underscores and hyphens.
            </p>
            {error && (
              <p id="username-error" role="alert" className="mt-3 border-l-2 border-[var(--danger)] pl-3 text-sm">
                {error}
              </p>
            )}
            <button type="submit" disabled={isLoading || username.trim().length < 3} className="dive-btn mt-6 w-full py-3 text-base">
              {isLoading ? "Saving…" : "Save and continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
