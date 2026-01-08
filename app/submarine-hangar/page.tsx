import { redirect } from "next/navigation"
import SubmarineHangarClient from "./page-client"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"

/**
 * Submarine Hangar - Server Component
 * 
 * This page fetches player data from Supabase and renders the futuristic
 * submarine hangar interface. All submarine data (models, prices, stats)
 * comes from the same Supabase tables as the submarine store.
 * 
 * Data Flow:
 * 1. Authenticate user via JWT cookie
 * 2. Fetch player record (wallet, tier, resources, balance)
 * 3. Pass data to client component for 3D rendering
 */
export default async function SubmarineHangarPage() {
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

  // Pass player data to client component
  return (
    <SubmarineHangarClient
      currentTier={playerRecord.submarine_tier ?? 1}
      resources={{
        nickel: playerRecord.nickel ?? 0,
        cobalt: playerRecord.cobalt ?? 0,
        copper: playerRecord.copper ?? 0,
        manganese: playerRecord.manganese ?? 0,
      }}
      balance={playerRecord.balance ?? 0}
      walletAddress={playerRecord.wallet_address}
      userId={auth.userId}
    />
  )
}
