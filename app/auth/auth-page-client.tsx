"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Anchor, ArrowLeft, Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from "@/lib/supabase"

function AuthPageContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState<string>("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode") || "login"
  const isSignUp = mode === "signup"
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

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const { error } = await signInWithGoogle()
      if (error) {
        throw error
      }
      // OAuth flow will redirect externally
    } catch (error) {
      console.error("Google authentication error:", error)
      setError(error instanceof Error ? error.message : "Google authentication failed")
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      let result
      if (isSignUp) {
        // Validate username
        if (!username || username.trim().length < 3) {
          setError("Username must be at least 3 characters long")
          setIsLoading(false)
          return
        }

        // Validate password match
        if (password !== confirmPassword) {
          setError("Passwords do not match")
          setIsLoading(false)
          return
        }

        // Validate password strength
        if (password.length < 8) {
          setError("Password must be at least 8 characters long")
          setIsLoading(false)
          return
        }

        result = await signUpWithEmail(email, password, username)
        if (!result.error && !result.data.session) {
          setSuccess("Please check your email to confirm your account before signing in.")
          setIsLoading(false)
          return
        }
      } else {
        result = await signInWithEmail(email, password)
      }

      if (result.error) {
        throw result.error
      }

      if (result.data.session) {
        router.push("/connect-wallet")
      }
    } catch (error) {
      console.error("Email authentication error:", error)
      setError(error instanceof Error ? error.message : "Authentication failed")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setError("")
    setSuccess("")
    setEmail("")
    setUsername("")
    setPassword("")
    setConfirmPassword("")
    router.push(`/auth?mode=${isSignUp ? "login" : "signup"}`)
  }

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

          <h2 className="text-2xl font-bold text-white mb-2">{isSignUp ? "Create Account" : "Welcome Back"}</h2>
          <p className="text-depth-400">
            {isSignUp ? "Join the deep sea mining adventure" : "Sign in to continue your journey"}
          </p>
        </div>

        <div className="bg-depth-800/50 backdrop-blur-sm rounded-xl p-6 border border-depth-700">
          {error && (
            <Alert className="mb-4 border-red-500/30 bg-red-900/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-200">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-500/30 bg-green-900/50">
              <AlertDescription className="text-green-200">{success}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-depth-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-depth-800 text-depth-400">or</span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-depth-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-depth-400 w-4 h-4" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-depth-700 border-depth-600 text-white placeholder-depth-400 focus:border-ocean-500 focus:ring-ocean-500"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="username" className="text-depth-300">
                  Username
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                    maxLength={30}
                    className="bg-depth-700 border-depth-600 text-white placeholder-depth-400 focus:border-ocean-500 focus:ring-ocean-500"
                    placeholder="Choose a username (3-30 characters)"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-depth-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-depth-400 w-4 h-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pl-10 pr-10 bg-depth-700 border-depth-600 text-white placeholder-depth-400 focus:border-ocean-500 focus:ring-ocean-500"
                  placeholder={isSignUp ? "Create a password (min 8 characters)" : "Enter your password"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-depth-400" /> : <Eye className="h-4 w-4 text-depth-400" />}
                </Button>
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-depth-300">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-depth-400 w-4 h-4" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="pl-10 pr-10 bg-depth-700 border-depth-600 text-white placeholder-depth-400 focus:border-ocean-500 focus:ring-ocean-500"
                    placeholder="Confirm your password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4 text-depth-400" /> : <Eye className="h-4 w-4 text-depth-400" />}
                  </Button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-ocean-500 to-abyss-600 hover:from-ocean-600 hover:to-abyss-700 text-white font-medium"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button variant="link" onClick={toggleMode} className="text-ocean-400 hover:text-ocean-300 text-sm p-0">
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-depth-500 text-center mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
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
