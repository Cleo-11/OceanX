import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import AuthPageClient from "./auth-page-client"
import type { Database } from "@/lib/types"

export default async function AuthPage() {
  const cookieStore = cookies()
  const supabase = createServerComponentClient<Database>({ cookies: () => cookieStore })

  console.log("[auth/page] Checking session")

  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log("[auth/page] Session check result", {
    hasSession: !!session,
    userId: session?.user?.id,
  })

  if (session) {
    console.log("[auth/page] Session found, redirecting to /connect-wallet")
    redirect("/connect-wallet")
  }

  console.log("[auth/page] No session, rendering auth page")
  return <AuthPageClient />
}
