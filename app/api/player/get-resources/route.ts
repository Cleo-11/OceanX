import { NextResponse } from "next/server"
import { createSupabaseAdmin, getAuthFromCookies } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/**
 * GET /api/player/get-resources
 * Fetches current player resources from database
 */
export async function GET() {
  try {
    // 1. Authenticate user from JWT cookie
    const auth = await getAuthFromCookies()
    if (!auth) {
      console.warn("[get-resources] No JWT session")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Use admin client to fetch player resources
    const supabase = createSupabaseAdmin()

    const { data: playerData, error: fetchError } = await supabase
      .from("players")
      .select("nickel, cobalt, copper, manganese")
      .eq("wallet_address", auth.walletAddress)
      .single()

    if (fetchError) {
      console.error("[get-resources] Database error:", fetchError)
      return NextResponse.json(
        { error: "Failed to fetch resources", details: fetchError.message },
        { status: 500 }
      )
    }

    if (!playerData) {
      console.warn("[get-resources] No player record found")
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      )
    }

    console.info("[get-resources] ✅ Resources fetched:", {
      wallet: auth.walletAddress,
      resources: playerData,
    })

    return NextResponse.json({
      success: true,
      data: {
        nickel: playerData.nickel ?? 0,
        cobalt: playerData.cobalt ?? 0,
        copper: playerData.copper ?? 0,
        manganese: playerData.manganese ?? 0,
      },
    })
  } catch (error) {
    console.error("[get-resources] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    )
  }
}
