import { NextResponse } from "next/server"
import { createSupabaseAdmin, getAuthFromCookies } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/**
 * GET /api/player/balance
 * Fetches current player's OCX token balance from database
 */
export async function GET() {
  try {
    // 1. Authenticate user from JWT cookie
    const auth = await getAuthFromCookies()
    if (!auth) {
      console.warn("[get-balance] No JWT session")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Use admin client to fetch player balance
    const supabase = createSupabaseAdmin()

    const { data: playerData, error: fetchError } = await supabase
      .from("players")
      .select("balance, total_ocx_earned")
      .eq("wallet_address", auth.walletAddress)
      .single()

    if (fetchError) {
      console.error("[get-balance] Database error:", fetchError)
      return NextResponse.json(
        { error: "Failed to fetch balance", details: fetchError.message },
        { status: 500 }
      )
    }

    if (!playerData) {
      console.warn("[get-balance] No player record found")
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      )
    }

    console.info("[get-balance] ✅ Balance fetched:", {
      wallet: auth.walletAddress,
      balance: playerData.balance,
    })

    return NextResponse.json({
      success: true,
      balance: playerData.total_ocx_earned ?? playerData.balance ?? 0,
      symbol: "OCX",
    })
  } catch (error) {
    console.error("[get-balance] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
