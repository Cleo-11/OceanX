import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/lib/types"

// Service role client for bypassing RLS
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    // Get user session from cookies
    const supabase = createServerComponentClient<Database>({ cookies })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const userId = session.user.id
    const email = session.user.email

    // Check if player already exists
    const { data: existingPlayer, error: checkError } = await supabaseAdmin
      .from("players")
      .select("id, user_id, wallet_address, nickel, cobalt, copper, manganese")
      .eq("user_id", userId)
      .maybeSingle()

    if (checkError) {
      console.error("[api/player/ensure] Error checking player:", checkError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (existingPlayer) {
      console.info("[api/player/ensure] Player already exists:", {
        userId,
        playerId: existingPlayer.id,
      })
      return NextResponse.json({ player: existingPlayer, created: false })
    }

    // Create new player using service role (bypasses RLS)
    const username = email?.split("@")[0] || `player_${userId.slice(0, 8)}`

    const { data: newPlayer, error: createError } = await supabaseAdmin
      .from("players")
      .insert({
        user_id: userId,
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
      .select("id, user_id, wallet_address, nickel, cobalt, copper, manganese")
      .single()

    if (createError) {
      console.error("[api/player/ensure] Failed to create player:", createError)
      return NextResponse.json(
        { error: `Failed to create player: ${createError.message}` },
        { status: 500 }
      )
    }

    console.info("[api/player/ensure] Created new player:", {
      userId,
      playerId: newPlayer.id,
      username,
    })

    return NextResponse.json({ player: newPlayer, created: true })
  } catch (error) {
    console.error("[api/player/ensure] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
