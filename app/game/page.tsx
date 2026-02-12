import { redirect } from "next/navigation"
import GameClient from "./game-client"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"

export default async function GamePage() {
  // Get auth from JWT cookie
  const auth = await getAuthFromCookies()

  if (!auth) {
    console.warn("[game/page] No JWT session, redirecting to /auth")
    redirect("/auth")
  }

  console.info("[game/page] Session found for wallet:", {
    wallet: auth.walletAddress,
  })

  // Use admin client for database operations
  const supabase = createSupabaseAdmin()

  // Load player data by wallet address (case-insensitive)
  let { data: playerData, error: playerError } = await supabase
    .from("players")
    .select("wallet_address, nickel, cobalt, copper, manganese, total_ocx_earned, submarine_tier, has_completed_tutorial")
    .ilike("wallet_address", auth.walletAddress)
    .maybeSingle()

  if (playerError) {
    console.error("[game/page] Error loading player data:", playerError)
  }

  // If no player record exists, create one
  if (!playerData) {
    console.warn("[game/page] No player record found, creating...")
    
    const username = `Captain-${auth.walletAddress.slice(2, 8)}`

    const { data: newPlayer, error: createError } = await supabase
      .from("players")
      .insert({
        user_id: auth.userId,
        username,
        wallet_address: auth.walletAddress,
        submarine_tier: 1,
        coins: 0,
        total_resources_mined: 0,
        total_ocx_earned: 0,
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
        has_completed_tutorial: false,
        is_active: true,
        last_login: new Date().toISOString(),
      })
      .select("wallet_address, nickel, cobalt, copper, manganese, total_ocx_earned, submarine_tier, has_completed_tutorial")
      .single()

    if (createError) {
      console.error("[game/page] Failed to create player:", createError)
    } else {
      console.info("[game/page] Player created successfully")
      playerData = newPlayer
    }
  }

  console.info("[game/page] Player data loaded:", {
    wallet: auth.walletAddress,
    hasPlayerData: !!playerData,
  })

  return <GameClient userId={auth.userId} playerData={playerData} walletAddress={auth.walletAddress} />
}
