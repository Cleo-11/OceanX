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

    const RESOURCE_TO_OCX_RATE: Record<string, number> = {
      nickel: 0.1,
      cobalt: 0.5,
      copper: 1.0,
      manganese: 2.0,
    }

    // 2–5. Read → price → write, as a compare-and-swap: the UPDATE only matches
    // if the resources and OCX balance are still what we read. Previously a
    // mine (or a second tab) landing between the read and the write was wiped
    // out, and two concurrent trades could both credit the same resources.
    let player: {
      id: string
      total_ocx_earned: number | null
      nickel: number | null
      cobalt: number | null
      copper: number | null
      manganese: number | null
    } | null = null
    let resources = { nickel: 0, cobalt: 0, copper: 0, manganese: 0 }
    let nickelValue = 0
    let cobaltValue = 0
    let copperValue = 0
    let manganeseValue = 0
    let totalOcxEarned = 0
    let newOcxBalance = 0
    let committed = false

    for (let attempt = 0; attempt < 5 && !committed; attempt++) {
      const { data, error: playerError } = await supabase
        .from("players")
        .select("id, total_ocx_earned, nickel, cobalt, copper, manganese")
        .ilike("wallet_address", auth.walletAddress)
        .single()

      if (playerError || !data) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 })
      }
      player = data

      resources = {
        nickel: data.nickel || 0,
        cobalt: data.cobalt || 0,
        copper: data.copper || 0,
        manganese: data.manganese || 0,
      }

      const totalResources = resources.nickel + resources.cobalt + resources.copper + resources.manganese
      if (totalResources <= 0) {
        return NextResponse.json({ error: "No resources to trade" }, { status: 400 })
      }

      nickelValue = Math.floor(resources.nickel * RESOURCE_TO_OCX_RATE.nickel)
      cobaltValue = Math.floor(resources.cobalt * RESOURCE_TO_OCX_RATE.cobalt)
      copperValue = Math.floor(resources.copper * RESOURCE_TO_OCX_RATE.copper)
      manganeseValue = Math.floor(resources.manganese * RESOURCE_TO_OCX_RATE.manganese)
      totalOcxEarned = nickelValue + cobaltValue + copperValue + manganeseValue

      if (totalOcxEarned <= 0) {
        return NextResponse.json({ error: "Resources too few to yield any OCX" }, { status: 400 })
      }

      const currentOcx = Number(data.total_ocx_earned) || 0
      newOcxBalance = currentOcx + totalOcxEarned

      let write = supabase
        .from("players")
        .update({
          nickel: 0,
          cobalt: 0,
          copper: 0,
          manganese: 0,
          total_ocx_earned: newOcxBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
      for (const key of ["nickel", "cobalt", "copper", "manganese", "total_ocx_earned"] as const) {
        const value = data[key]
        write = value === null || value === undefined ? write.is(key, null) : write.eq(key, value)
      }
      const { data: written, error: updateError } = await write.select("id")

      if (updateError) {
        console.error("[api/marketplace/trade-resources] Update failed:", updateError)
        return NextResponse.json({ error: "Failed to update player" }, { status: 500 })
      }
      committed = Array.isArray(written) && written.length === 1
    }

    if (!committed || !player) {
      return NextResponse.json(
        { error: "Your resources changed while trading. Please try again." },
        { status: 409 }
      )
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
