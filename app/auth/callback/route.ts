import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  // Get site URL from environment variable
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch (error) {
      console.error("Error exchanging code for session:", error)
      return NextResponse.redirect(`${siteUrl}/auth?error=auth_error`)
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${siteUrl}/connect-wallet`)
}
