import { redirect } from "next/navigation"
import OnboardingClient from "./onboarding-client"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"

export default async function OnboardingPage() {
  // Get auth from JWT cookie
  const auth = await getAuthFromCookies()

  // No session - redirect to auth
  if (!auth) {
    redirect("/auth")
  }

  // Use admin client for database operations
  const supabase = createSupabaseAdmin()

  // Check if player already has a username set
  const { data: playerRecord } = await supabase
    .from("players")
    .select("username, wallet_address")
    .eq("wallet_address", auth.walletAddress)
    .maybeSingle()

  // If player already has a custom username (not auto-generated), redirect to home
  if (playerRecord?.username && !playerRecord.username.startsWith("Captain-")) {
    redirect("/home")
  }

  return (
    <OnboardingClient 
      walletAddress={auth.walletAddress}
    />
  )
}
