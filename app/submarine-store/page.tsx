import { redirect } from "next/navigation"
import SubmarineStoreClient from "./page-client"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"

export default async function SubmarineStorePage() {
  // Get auth from JWT cookie
  const auth = await getAuthFromCookies()

  if (!auth) {
    redirect("/auth")
  }

  // Use admin client for database operations
  const supabase = createSupabaseAdmin()

  // Fetch player data by wallet address (case-insensitive)
  const { data: playerRecord } = await supabase
    .from("players")
    .select("*")
    .ilike("wallet_address", auth.walletAddress)
    .maybeSingle()

  if (!playerRecord || !playerRecord.wallet_address) {
    redirect("/home")
  }

  return (
    <SubmarineStoreClient
      currentTier={playerRecord.submarine_tier ?? 1}
      resources={{
        nickel: playerRecord.nickel ?? 0,
        cobalt: playerRecord.cobalt ?? 0,
        copper: playerRecord.copper ?? 0,
        manganese: playerRecord.manganese ?? 0,
      }}
      balance={playerRecord.total_ocx_earned ?? 0}
      walletAddress={playerRecord.wallet_address}
    />
  )
}
