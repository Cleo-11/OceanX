"use client"

import { useState } from "react"
import { Anchor, Loader2, User, Wallet, Check, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface OnboardingClientProps {
  walletAddress: string
}

export default function OnboardingClient({ walletAddress }: OnboardingClientProps) {
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const validateUsername = (name: string): string | null => {
    if (name.length < 3) {
      return "Username must be at least 3 characters"
    }
    if (name.length > 20) {
      return "Username must be 20 characters or less"
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return "Username can only contain letters, numbers, underscores, and hyphens"
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

  const shortenedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Not connected"

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="relative">
            <Anchor className="h-10 w-10 text-cyan-400" />
            <div className="absolute -inset-1 bg-cyan-400/20 blur-xl rounded-full" />
          </div>
          <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            AbyssX
          </span>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Welcome, Captain! 🎉
          </h1>
          <p className="text-slate-400 text-center mb-6">
            Choose your captain name to begin your deep-sea adventure
          </p>

          {/* Wallet Display */}
          <div className="bg-slate-900/50 rounded-lg p-4 mb-6 border border-slate-700">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-cyan-400" />
              <div>
                <p className="text-xs text-slate-500">Connected Wallet</p>
                <p className="text-sm text-white font-mono">{shortenedAddress}</p>
              </div>
              <Check className="h-5 w-5 text-green-400 ml-auto" />
            </div>
          </div>

          {/* Username Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                Captain Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your captain name"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError("")
                  }}
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500"
                  maxLength={20}
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                3-20 characters, letters, numbers, underscores, and hyphens only
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={isLoading || username.length < 3}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Setting up...
                </>
              ) : (
                "Start Adventure"
              )}
            </Button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-4">
            You can change your captain name later in your profile settings
          </p>
        </div>
      </div>
    </div>
  )
}
