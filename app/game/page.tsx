import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { createClient } from "@supabase/supabase-js"
import GameClient from "./game-client"
import type { Database } from "@/lib/types"

// Service role client for bypassing RLS when creating players
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function GamePage() {
  const supabase = createServerComponentClient<Database>({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    console.warn("[game/page] No session, redirecting to /auth")
    redirect("/auth")
  }

  console.info("[game/page] Session found for user:", {
    userId: session.user.id,
    email: session.user.email,
  })

  // Load player data using service role (more reliable)
  let { data: playerData, error: playerError } = await supabaseAdmin
    .from("players")
    .select("wallet_address, nickel, cobalt, copper, manganese")
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (playerError) {
    console.error("[game/page] Error loading player data:", playerError)
  }

  // If no player record exists, create one using service role
  if (!playerData) {
    console.warn("[game/page] No player record found, creating with service role...")
    
    const username = session.user.email?.split("@")[0] || `player_${session.user.id.slice(0, 8)}`

    const { data: newPlayer, error: createError } = await supabaseAdmin
      .from("players")
      .insert({
        user_id: session.user.id,
        username,
        wallet_address: null,
        submarine_tier: 1,
        coins: 0,
        total_resources_mined: 0,
        total_ocx_earned: 0,
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
        is_active: true,
        last_login: new Date().toISOString(),
      })
      .select("wallet_address, nickel, cobalt, copper, manganese")
      .single()

    if (createError) {
      console.error("[game/page] Failed to create player:", createError)
    } else {
      console.info("[game/page] Player created successfully")
      playerData = newPlayer
    }
  }

  console.info("[game/page] Player data loaded:", {
    userId: session.user.id,
    hasPlayerData: !!playerData,
    hasWallet: !!playerData?.wallet_address,
  })

  return <GameClient userId={session.user.id} playerData={playerData} />
}
