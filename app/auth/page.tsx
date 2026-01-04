import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import AuthPageClient from "./auth-page-client"
import type { Database } from "@/lib/types"

export default async function AuthPage() {
  const cookieStore = cookies()
  
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  console.log("[auth/page] Checking session")

  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log("[auth/page] Session check result", {
    hasSession: !!session,
    userId: session?.user?.id,
  })

  if (session) {
    console.log("[auth/page] Session found, redirecting to /home")
    redirect("/home")
  }

  console.log("[auth/page] No session, rendering auth page")
  return <AuthPageClient />
}
