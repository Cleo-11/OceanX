import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "")

  console.log("[auth/callback] Incoming request", {
    hasCode: Boolean(code),
    hasError: Boolean(error),
    errorDescription,
    origin: requestUrl.origin,
  })

  if (error) {
    console.error("[auth/callback] OAuth provider returned error", {
      error,
      errorDescription,
    })
    return NextResponse.redirect(`${siteUrl}/auth?error=auth_error`)
  }

  if (!code) {
    console.warn("[auth/callback] No authorization code present, redirecting to /auth")
    return NextResponse.redirect(`${siteUrl}/auth?error=missing_code`)
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

  try {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error("[auth/callback] Failed exchanging code for session", {
        message: exchangeError.message,
        status: exchangeError.status,
      })
      return NextResponse.redirect(`${siteUrl}/auth?error=session_error`)
    }

    if (!data.session) {
      console.error("[auth/callback] Supabase returned no session after exchange")
      return NextResponse.redirect(`${siteUrl}/auth?error=no_session`)
    }

    console.log("[auth/callback] Session exchange successful", {
      userId: data.session.user.id,
      expiresAt: data.session.expires_at,
    })

    // Sanity check that cookie-based session is available
    const {
      data: { session: verifiedSession },
    } = await supabase.auth.getSession()

    if (!verifiedSession) {
      console.error("[auth/callback] Session not persisted after exchange")
      return NextResponse.redirect(`${siteUrl}/auth?error=session_not_persisted`)
    }

    console.log("[auth/callback] Session verified, redirecting to /connect-wallet")
    return NextResponse.redirect(`${siteUrl}/connect-wallet`)
  } catch (callbackError) {
    console.error("[auth/callback] Unexpected error", callbackError)
    return NextResponse.redirect(`${siteUrl}/auth?error=unexpected_error`)
  }
}
