import { NextRequest, NextResponse } from "next/server"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"
import { SUBMARINE_TIERS } from "@/lib/submarine-tiers"

export const dynamic = "force-dynamic"

/**
 * POST /api/submarine/upgrade
 * 
 * Server-side submarine upgrade using database-tracked OCX (total_ocx_earned).
 * No blockchain transaction required — deducts OCX from the player's DB balance.
 * 
 * Auth: JWT cookie (same as other Next.js API routes)
 * Body: { targetTier: number }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user from JWT cookie
    const auth = await getAuthFromCookies()
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const targetTier = typeof body.targetTier === "number" ? Math.trunc(body.targetTier) : null

    if (!targetTier || targetTier < 1 || targetTier > 15) {
      return NextResponse.json({ error: "Invalid target tier" }, { status: 400 })
    }

    // 2. Fetch player record
    const supabase = createSupabaseAdmin()
    const { data: player, error: fetchErr } = await supabase
      .from("players")
      .select("id, submarine_tier, total_ocx_earned, wallet_address")
      .ilike("wallet_address", auth.walletAddress)
      .single()

    if (fetchErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const currentTier = player.submarine_tier ?? 1

    // 3. Validate sequential upgrade
    if (targetTier !== currentTier + 1) {
      return NextResponse.json(
        { error: "Submarines must be upgraded sequentially" },
        { status: 409 }
      )
    }

    if (currentTier >= 15) {
      return NextResponse.json(
        { error: "Maximum submarine tier already reached" },
        { status: 409 }
      )
    }

    // 4. Get tier definition and cost
    const tierDef = SUBMARINE_TIERS.find((t) => t.tier === targetTier)
    if (!tierDef) {
      return NextResponse.json({ error: "Tier definition not found" }, { status: 404 })
    }

    const upgradeCost = tierDef.upgradeCost.tokens
    const currentBalance = Number(player.total_ocx_earned ?? 0)

    if (currentBalance < upgradeCost) {
      return NextResponse.json(
        {
          error: `Insufficient OCX tokens (have: ${currentBalance}, need: ${upgradeCost})`,
          code: "INSUFFICIENT_OCX",
        },
        { status: 402 }
      )
    }

    // 5. Deduct and upgrade
    const newBalance = currentBalance - upgradeCost
    const timestamp = new Date().toISOString()

    const { data: updated, error: updateErr } = await supabase
      .from("players")
      .update({
        submarine_tier: targetTier,
        total_ocx_earned: newBalance,
        updated_at: timestamp,
      })
      .eq("id", player.id)
      .select("id, submarine_tier, total_ocx_earned")
      .single()

    if (updateErr || !updated) {
      console.error("[submarine/upgrade] Update failed:", updateErr)
      return NextResponse.json({ error: "Failed to apply upgrade" }, { status: 500 })
    }

    console.info("[submarine/upgrade] ✅ Upgrade success:", {
      wallet: auth.walletAddress,
      previousTier: currentTier,
      newTier: targetTier,
      cost: upgradeCost,
      remainingBalance: newBalance,
    })

    return NextResponse.json({
      success: true,
      data: {
        playerId: updated.id,
        wallet: auth.walletAddress,
        previousTier: currentTier,
        newTier: targetTier,
        tierDetails: {
          tier: tierDef.tier,
          name: tierDef.name,
          description: tierDef.description,
          baseStats: tierDef.baseStats,
          upgradeCost: tierDef.upgradeCost,
          color: tierDef.color,
          specialAbility: tierDef.specialAbility,
        },
        coins: newBalance,
        balance: newBalance,
        cost: { tokens: upgradeCost },
        timestamp,
        message: `Submarine upgraded to tier ${targetTier}`,
      },
    })
  } catch (error) {
    console.error("[submarine/upgrade] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
