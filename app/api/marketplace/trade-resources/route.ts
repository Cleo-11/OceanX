import { NextResponse } from "next/server"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/**
 * POST /api/marketplace/trade-resources
 *
 * Converts all player resources → OCX off-chain (database only, no blockchain).
 * Uses JWT cookie auth — NO MetaMask signature required.
 */
export async function POST() {
  try {
    // 1. Authenticate from JWT cookie
    const auth = await getAuthFromCookies()
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    // 2. Fetch current player data
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, wallet_address, submarine_tier, total_ocx_earned, nickel, cobalt, copper, manganese")
      .ilike("wallet_address", auth.walletAddress)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // 3. Read current resources
    const resources = {
      nickel: player.nickel || 0,
      cobalt: player.cobalt || 0,
      copper: player.copper || 0,
      manganese: player.manganese || 0,
    }

    const totalResources = resources.nickel + resources.cobalt + resources.copper + resources.manganese
    if (totalResources <= 0) {
      return NextResponse.json({ error: "No resources to trade" }, { status: 400 })
    }

    // 4. Calculate OCX value
    const RESOURCE_TO_OCX_RATE: Record<string, number> = {
      nickel: 0.1,
      cobalt: 0.5,
      copper: 1.0,
      manganese: 2.0,
    }

    const nickelValue = Math.floor(resources.nickel * RESOURCE_TO_OCX_RATE.nickel)
    const cobaltValue = Math.floor(resources.cobalt * RESOURCE_TO_OCX_RATE.cobalt)
    const copperValue = Math.floor(resources.copper * RESOURCE_TO_OCX_RATE.copper)
    const manganeseValue = Math.floor(resources.manganese * RESOURCE_TO_OCX_RATE.manganese)
    const totalOcxEarned = nickelValue + cobaltValue + copperValue + manganeseValue

    if (totalOcxEarned <= 0) {
      return NextResponse.json({ error: "Resources too few to yield any OCX" }, { status: 400 })
    }

    // 5. Update DB: zero resources + credit total_ocx_earned
    const currentOcx = Number(player.total_ocx_earned) || 0
    const newOcxBalance = currentOcx + totalOcxEarned

    const { error: updateError } = await supabase
      .from("players")
      .update({
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
        total_ocx_earned: newOcxBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", player.id)

    if (updateError) {
      console.error("[api/marketplace/trade-resources] Update failed:", updateError)
      return NextResponse.json({ error: "Failed to update player" }, { status: 500 })
    }

    console.info("[api/marketplace/trade-resources] ✅ Trade success:", {
      wallet: auth.walletAddress,
      ocxEarned: totalOcxEarned,
      newBalance: newOcxBalance,
    })

    return NextResponse.json({
      success: true,
      wallet: auth.walletAddress,
      resourcesTraded: resources,
      ocxEarned: totalOcxEarned,
      newOcxBalance,
      breakdown: {
        nickel: { amount: resources.nickel, rate: RESOURCE_TO_OCX_RATE.nickel, value: nickelValue },
        cobalt: { amount: resources.cobalt, rate: RESOURCE_TO_OCX_RATE.cobalt, value: cobaltValue },
        copper: { amount: resources.copper, rate: RESOURCE_TO_OCX_RATE.copper, value: copperValue },
        manganese: { amount: resources.manganese, rate: RESOURCE_TO_OCX_RATE.manganese, value: manganeseValue },
      },
    })
  } catch (err) {
    console.error("[api/marketplace/trade-resources] Error:", err)
    return NextResponse.json({ error: "Trade failed" }, { status: 500 })
  }
}
