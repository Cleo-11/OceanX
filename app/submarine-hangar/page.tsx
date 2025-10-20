import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/types"
import SubmarineHangarClient from "./page-client"

/**
 * Submarine Hangar - Server Component
 * 
 * This page fetches player data from Supabase and renders the futuristic
 * submarine hangar interface. All submarine data (models, prices, stats)
 * comes from the same Supabase tables as the submarine store.
 * 
 * Data Flow:
 * 1. Authenticate user session
 * 2. Fetch player record (wallet, tier, resources, balance)
 * 3. Pass data to client component for 3D rendering
 */
export default async function SubmarineHangarPage() {
  const supabase = createServerComponentClient<Database>({ cookies })

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/auth")
  }

  // Fetch player data from Supabase
  const { data: playerRecord } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!playerRecord || !playerRecord.wallet_address) {
    redirect("/connect-wallet")
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
      userId={session.user.id}
    />
  )
}
