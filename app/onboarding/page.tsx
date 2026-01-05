import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import OnboardingClient from "./onboarding-client"
import type { Database } from "@/lib/types"

export default async function OnboardingPage() {
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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // No session - redirect to auth
  if (!session) {
    redirect("/auth")
  }

  // Check if player already has a username set
  const { data: playerRecord } = await supabase
    .from("players")
    .select("username, wallet_address")
    .eq("user_id", session.user.id)
    .maybeSingle()

  // If player already has a custom username (not auto-generated), redirect to home
  if (playerRecord?.username && !playerRecord.username.startsWith("Captain-")) {
    redirect("/home")
  }

  // Get wallet address from user metadata
  const walletAddress = playerRecord?.wallet_address || 
    session.user.user_metadata?.wallet_address || 
    ""

  return (
    <OnboardingClient 
      walletAddress={walletAddress}
    />
  )
}
