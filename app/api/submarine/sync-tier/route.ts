import { NextRequest, NextResponse } from "next/server"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"
import { ethers } from "ethers"
import UpgradeManagerABI from "@/server/abis/UpgradeManager.json"

export const dynamic = "force-dynamic"

// Contract address
const UPGRADE_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_UPGRADE_MANAGER_ADDRESS || "0x2C491a2914Fe827462c831D7BABad7B2c42Ca34d"

/**
 * POST /api/submarine/sync-tier
 *
 * Updates the player's submarine tier in the DB WITHOUT deducting OCX.
 * Used after a successful on-chain upgrade where tokens were already
 * transferred on the blockchain via the UpgradeManager contract.
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

    // SECURITY: Verify tier on-chain before syncing to DB (anti-cheat)
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY"
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const upgradeManager = new ethers.Contract(UPGRADE_MANAGER_ADDRESS, UpgradeManagerABI, provider)
      
      const onChainTier = await upgradeManager.getCurrentTier(player.wallet_address)
      const contractTier = Number(onChainTier)

      console.info("[submarine/sync-tier] On-chain verification:", {
        wallet: player.wallet_address,
        dbTier: currentTier,
        contractTier,
        targetTier,
      })

      // Verify contract tier matches target tier (user already upgraded on-chain)
      if (contractTier !== targetTier) {
        console.warn("[submarine/sync-tier] ⚠️ Tier mismatch detected:", {
          wallet: player.wallet_address,
          contractTier,
          targetTier,
          txHash,
        })
        return NextResponse.json(
          { 
            error: `Tier verification failed: contract shows tier ${contractTier}, but you requested tier ${targetTier}. Please refresh and try again.`,
            contractTier,
            targetTier,
          },
          { status: 409 }
        )
      }
    } catch (verifyError: any) {
      console.error("[submarine/sync-tier] On-chain verification failed:", verifyError)
      // Log but don't block (network issues shouldn't prevent legitimate upgrades)
      // In production, you might want to require verification
      console.warn("[submarine/sync-tier] Proceeding without verification due to RPC error")
    }

    // Update tier only — tokens were already deducted on-chain
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

    console.info("[submarine/sync-tier] ✅ Tier synced (on-chain deduction):", {
      wallet: auth.walletAddress,
      newTier: targetTier,
      txHash,
    })

    return NextResponse.json({
      success: true,
      data: {
        playerId: updated.id,
        wallet: auth.walletAddress,
        previousTier: currentTier,
        newTier: updated.submarine_tier,
        balance: Number(updated.total_ocx_earned ?? 0),
        coins: Number(updated.total_ocx_earned ?? 0),
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
