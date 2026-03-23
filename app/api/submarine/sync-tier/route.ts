import { NextRequest, NextResponse } from "next/server"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/**
 * POST /api/submarine/sync-tier
 *
 * Updates the player's submarine tier in the DB after a successful on-chain
 * upgrade where tokens were already transferred via the UpgradeManager contract.
 *
 * IMPORTANT: Does NOT touch total_ocx_earned. The submarine purchase was paid
 * with on-chain tokens (wallet balance), which is a separate ledger from
 * total_ocx_earned (unclaimed off-chain credits). Writing the on-chain balance
 * into total_ocx_earned would let the player "claim" tokens they already hold.
 *
 * Body: { targetTier: number, txHash?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const targetTier = typeof body.targetTier === "number" ? Math.trunc(body.targetTier) : null
    const txHash = typeof body.txHash === "string" ? body.txHash.trim() : null

    if (!targetTier || targetTier < 1 || targetTier > 15) {
      return NextResponse.json({ error: "Invalid target tier" }, { status: 400 })
    }

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

    if (targetTier !== currentTier + 1) {
      return NextResponse.json(
        { error: "Submarines must be upgraded sequentially" },
        { status: 409 }
      )
    }

    // Only update the tier — total_ocx_earned is untouched because the purchase
    // was paid on-chain (wallet tokens), not from off-chain credits.
    const timestamp = new Date().toISOString()

    const { data: updated, error: updateErr } = await supabase
      .from("players")
      .update({
        submarine_tier: targetTier,
        updated_at: timestamp,
      })
      .eq("id", player.id)
      .select("id, submarine_tier, total_ocx_earned")
      .single()

    if (updateErr || !updated) {
      console.error("[submarine/sync-tier] Update failed:", updateErr)
      return NextResponse.json({ error: "Failed to sync tier" }, { status: 500 })
    }

    // Return the unchanged total_ocx_earned so the frontend shows the correct
    // claimable amount (unclaimed off-chain credits only).
    const unclaimedOcx = Number(updated.total_ocx_earned ?? 0)

    console.info("[submarine/sync-tier] ✅ Tier synced:", {
      wallet: auth.walletAddress,
      newTier: targetTier,
      unclaimedOcx,
      txHash,
    })

    return NextResponse.json({
      success: true,
      data: {
        playerId: updated.id,
        wallet: auth.walletAddress,
        previousTier: currentTier,
        newTier: updated.submarine_tier,
        balance: unclaimedOcx,
        coins: unclaimedOcx,
        txHash,
        onChain: true,
        timestamp,
      },
    })
  } catch (err) {
    console.error("[submarine/sync-tier] Error:", err)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
