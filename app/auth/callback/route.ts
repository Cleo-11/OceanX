import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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
    origin: requestUrl.origin
  })

  // Handle OAuth errors
  if (error) {
    console.error("[auth/callback] OAuth error:", error, error_description)
    return NextResponse.redirect(`${siteUrl}/auth?error=auth_error`)
  }

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error("[auth/callback] Error exchanging code for session:", exchangeError)
        return NextResponse.redirect(`${siteUrl}/auth?error=auth_error`)
      }

      console.log("[auth/callback] Session exchange successful", {
        userId: data?.session?.user?.id,
        hasSession: !!data?.session
      })

      // Redirect to connect-wallet after successful authentication
      return NextResponse.redirect(`${siteUrl}/connect-wallet`)
    } catch (error) {
      console.error("[auth/callback] Unexpected error during code exchange:", error)
      return NextResponse.redirect(`${siteUrl}/auth?error=auth_error`)
    }
  }

  // No code and no error - redirect to auth
  console.warn("[auth/callback] No code or error in callback, redirecting to auth")
  return NextResponse.redirect(`${siteUrl}/auth`)
}
