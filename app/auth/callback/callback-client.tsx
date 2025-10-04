"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

export default function CallbackClient() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      console.log("[callback-client] Handling OAuth callback")
      console.log("[callback-client] Current URL:", window.location.href)
      console.log("[callback-client] Hash:", window.location.hash)
      console.log("[callback-client] Search:", window.location.search)

      try {
        // First, try to handle the OAuth callback using Supabase's built-in handler
        // This works for both PKCE (query params) and implicit (hash fragments) flows
        const { data, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("[callback-client] Error getting session:", sessionError)
          router.push(`/auth?error=session_error`)
          return
        }

        if (data.session) {
          console.log("[callback-client] Session already exists", {
            userId: data.session.user.id,
          })
          console.log("[callback-client] Redirecting to /connect-wallet")
          
          // Use window.location for more reliable redirect
          window.location.href = '/connect-wallet'
          return
        }

        // If no session yet, check for hash fragments (OAuth implicit flow)
        if (window.location.hash) {
          console.log("[callback-client] Hash fragment detected, parsing...")
          
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          const hashError = hashParams.get('error')
          const hashErrorDescription = hashParams.get('error_description')

          if (hashError) {
            console.error("[callback-client] OAuth error in hash:", hashError, hashErrorDescription)
            router.push(`/auth?error=${hashError}`)
            return
          }

          if (accessToken) {
            console.log("[callback-client] Access token found in hash, setting session")
            
            const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            })

            if (setSessionError) {
              console.error("[callback-client] Error setting session:", setSessionError)
              router.push('/auth?error=session_error')
              return
            }

            console.log("[callback-client] Session set successfully", {
              userId: sessionData.session?.user?.id
            })

            console.log("[callback-client] Redirecting to /connect-wallet")
            window.location.href = '/connect-wallet'
            return
          }
        }

        // Check for authorization code in query params (PKCE flow)
        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')
        const queryError = searchParams.get('error')
        const queryErrorDescription = searchParams.get('error_description')

        if (queryError) {
          console.error("[callback-client] OAuth error in query:", queryError, queryErrorDescription)
          router.push(`/auth?error=${queryError}`)
          return
        }

        if (code) {
          console.log("[callback-client] Authorization code found, exchanging for session")
          
          const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            console.error("[callback-client] Error exchanging code:", exchangeError)
            router.push('/auth?error=session_error')
            return
          }

          console.log("[callback-client] Code exchange successful", {
            userId: sessionData.session?.user?.id
          })

          console.log("[callback-client] Redirecting to /connect-wallet")
          window.location.href = '/connect-wallet'
          return
        }

        // No code, no hash, no session - something went wrong
        console.error("[callback-client] No authorization code or hash found")
        router.push('/auth?error=missing_code')
        
      } catch (error) {
        console.error("[callback-client] Unexpected error:", error)
        router.push('/auth?error=unexpected_error')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
        <p className="text-white text-lg mb-2">Completing sign in...</p>
        <p className="text-slate-400 text-sm">Please wait while we verify your authentication</p>
      </div>
    </div>
  )
}
