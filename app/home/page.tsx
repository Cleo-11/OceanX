import { redirect } from "next/navigation"
import HomePageClient from "./home-page-client"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"

export default async function HomePage() {
  // Get auth from JWT cookie
  const auth = await getAuthFromCookies()

  if (!auth) {
    console.warn("[home/page] No JWT session, redirecting to /auth")
    redirect("/auth")
  }

  // Use admin client for database operations (bypass RLS)
  const supabase = createSupabaseAdmin()

  const { data: playerRecord, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("wallet_address", auth.walletAddress)
    .maybeSingle()

  if (playerError) {
    console.error("[home/page] Error loading player record:", {
      wallet: auth.walletAddress,
      error: playerError.message,
      code: playerError.code,
    })
  }

  console.info("[home/page] Player record check:", {
    wallet: auth.walletAddress,
    hasPlayerRecord: !!playerRecord,
  })

  // Force onboarding if username is missing or still auto-generated
  if (!playerRecord?.username || playerRecord.username.startsWith("Captain-")) {
    redirect("/onboarding")
  }

  return (
    <HomePageClient
      playerData={{
        id: playerRecord?.id ?? auth.walletAddress,
        user_id: playerRecord?.user_id ?? auth.userId,
        wallet_address: auth.walletAddress,
        username: playerRecord?.username ?? "Captain",
        submarine_tier: playerRecord?.submarine_tier ?? 1,
        total_resources_mined: playerRecord?.total_resources_mined ?? 0,
        total_ocx_earned: playerRecord?.total_ocx_earned ?? 0,
        last_login: playerRecord?.last_login ?? new Date().toISOString(),
        nickel: playerRecord?.nickel ?? 0,
        cobalt: playerRecord?.cobalt ?? 0,
        copper: playerRecord?.copper ?? 0,
        manganese: playerRecord?.manganese ?? 0,
      }}
    />
  )
}