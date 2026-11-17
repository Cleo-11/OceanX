import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAuthFromRequest } from "@/lib/jwt-auth"
import type { Database } from "@/lib/types"

/**
 * POST /api/player/save-resources
 *
 * Resources are now server-authoritative: the game server writes every mined
 * unit to the players row itself (server/lib/authoritativeMining.js). This
 * route used to overwrite nickel/cobalt/copper/manganese with whatever totals
 * the browser sent, which let any client set its own balance.
 *
 * It is kept so older cached clients keep working: any resource numbers in
 * the body are ignored, the player is marked active, and the authoritative
 * totals are returned so the caller can resync.
 */
export async function POST(request: Request) {
  try {
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const auth = await getAuthFromRequest(request)
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (body && ["nickel", "cobalt", "copper", "manganese"].some((key) => key in body)) {
      console.warn("[api/player/save-resources] Ignoring client-supplied resource totals", {
        wallet: auth.walletAddress,
      })
    }

    const { data, error } = await supabaseAdmin
      .from("players")
      .update({ last_login: new Date().toISOString(), is_active: true })
      .eq("wallet_address", auth.walletAddress)
      .select("nickel, cobalt, copper, manganese, total_resources_mined")
      .single()

    if (error) {
      console.error("[api/player/save-resources] Failed to read player:", error)
      return NextResponse.json({ error: `Failed to load resources: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, authoritative: true, data })
  } catch (error) {
    console.error("[api/player/save-resources] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
