import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Database } from "@/lib/types"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const error_description = requestUrl.searchParams.get("error_description")

  // Get site URL from environment variable and remove trailing slash
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, '')

  console.log("[auth/callback] Processing OAuth callback", {
    hasCode: !!code,
    hasError: !!error,
    error_description,
    origin: requestUrl.origin,
    fullUrl: requestUrl.href
  })

  // Handle OAuth errors
  if (error) {
    console.error("[auth/callback] OAuth error:", error, error_description)
    return NextResponse.redirect(`${siteUrl}/auth?error=auth_error`)
  }

  if (code) {
    try {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient<Database>({ 
        cookies: () => cookieStore 
      })

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error("[auth/callback] Error exchanging code for session:", {
          message: exchangeError.message,
          status: exchangeError.status,
          name: exchangeError.name
        })
        return NextResponse.redirect(`${siteUrl}/auth?error=session_error`)
      }

      if (!data?.session) {
        console.error("[auth/callback] No session returned after code exchange")
        return NextResponse.redirect(`${siteUrl}/auth?error=no_session`)
      }

      console.log("[auth/callback] Session exchange successful", {
        userId: data.session.user.id,
        email: data.session.user.email,
        expiresAt: data.session.expires_at
      })

      // Verify the session was actually set
      const { data: { session: verifySession } } = await supabase.auth.getSession()
      
      if (!verifySession) {
        console.error("[auth/callback] Session not persisted after exchange")
        return NextResponse.redirect(`${siteUrl}/auth?error=session_not_persisted`)
      }

      console.log("[auth/callback] Session verified, redirecting to /connect-wallet")
      
      // Redirect to connect-wallet after successful authentication
      return NextResponse.redirect(`${siteUrl}/connect-wallet`)
      
    } catch (error) {
      console.error("[auth/callback] Unexpected error during code exchange:", error)
      return NextResponse.redirect(`${siteUrl}/auth?error=unexpected_error`)
    }
  }

  // No code and no error - redirect to auth
  console.warn("[auth/callback] No code or error in callback, redirecting to auth")
  return NextResponse.redirect(`${siteUrl}/auth?error=missing_code`)
}
