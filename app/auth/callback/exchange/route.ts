import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/lib/types"

export const dynamic = "force-dynamic"

type ExchangeRequestBody = {
  code?: string
  access_token?: string
  refresh_token?: string
}

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })

  let payload: ExchangeRequestBody

  try {
    payload = await request.json()
  } catch (parseError) {
    console.error("[auth/callback/exchange] Failed to parse request body", parseError)
    return NextResponse.json({ success: false, error: "invalid_payload" }, { status: 400 })
  }

  const { code, access_token: accessToken, refresh_token: refreshToken } = payload

  try {
    if (code) {
      console.log("[auth/callback/exchange] Exchanging authorization code for session")
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error || !data.session) {
        console.error("[auth/callback/exchange] Code exchange failed", {
          message: error?.message,
          status: error?.status,
        })
        return NextResponse.json({ success: false, error: "session_error" }, { status: 400 })
      }
    } else if (accessToken && refreshToken) {
      console.log("[auth/callback/exchange] Setting session from OAuth tokens")
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error || !data.session) {
        console.error("[auth/callback/exchange] Failed to set session from tokens", {
          message: error?.message,
        })
        return NextResponse.json({ success: false, error: "session_error" }, { status: 400 })
      }
    } else {
      console.warn("[auth/callback/exchange] Missing credentials in request payload")
      return NextResponse.json({ success: false, error: "missing_credentials" }, { status: 400 })
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      console.error("[auth/callback/exchange] Session not available after persistence check")
      return NextResponse.json({ success: false, error: "session_not_persisted" }, { status: 500 })
    }

    console.log("[auth/callback/exchange] Session established", {
      userId: session.user.id,
      expiresAt: session.expires_at,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[auth/callback/exchange] Unexpected error", error)
    return NextResponse.json({ success: false, error: "unexpected_error" }, { status: 500 })
  }
}