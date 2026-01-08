import { redirect } from "next/navigation"
import MarketplaceClient from "./marketplace-client"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"

export default async function MarketplacePage() {
  // Get auth from JWT cookie
  const auth = await getAuthFromCookies()

  if (!auth) {
    redirect("/auth")
  }

  // Use admin client for database operations
  const supabase = createSupabaseAdmin()

  // Fetch player data by wallet address
  const { data: playerRecord } = await supabase
    .from("players")
    .select("*")
    .eq("wallet_address", auth.walletAddress)
    .maybeSingle()

  if (!playerRecord || !playerRecord.wallet_address) {
    redirect("/home")
  }

  return (
    <MarketplaceClient
      playerData={{
        id: playerRecord.id,
        user_id: playerRecord.user_id,
        wallet_address: playerRecord.wallet_address,
        username: playerRecord.username ?? "Captain",
        submarine_tier: playerRecord.submarine_tier ?? 1,
        total_resources_mined: playerRecord.total_resources_mined ?? 0,
        total_ocx_earned: playerRecord.total_ocx_earned ?? 0,
        last_login: playerRecord.last_login ?? new Date().toISOString(),
      }}
    />
  )
}
