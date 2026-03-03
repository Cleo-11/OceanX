import { NextRequest, NextResponse } from "next/server"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"
import { ethers } from "ethers"

export const dynamic = "force-dynamic"

/**
 * Helper: Get on-chain OCX balance for a wallet address
 */
async function getOnChainOCXBalance(walletAddress: string): Promise<number | null> {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL
    const tokenAddress = process.env.NEXT_PUBLIC_OCEAN_X_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS
    
    if (!rpcUrl || !tokenAddress) {
      console.warn("[sync-tier] Missing RPC or token address config")
      return null
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const tokenABI = ["function balanceOf(address) view returns (uint256)"]
    const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider)
    
    const balanceWei = await tokenContract.balanceOf(walletAddress)
    const balanceOCX = parseFloat(ethers.formatEther(balanceWei))
    
    return balanceOCX
  } catch (error) {
    console.error("[sync-tier] Failed to fetch on-chain balance:", error)
    return null
  }
}

/**
 * POST /api/submarine/sync-tier
 *
 * Updates the player's submarine tier in the DB and syncs on-chain OCX balance.
 * Used after a successful on-chain upgrade where tokens were already
 * transferred on the blockchain via the UpgradeManager contract.
 *
 * This fixes the bug where purchasing submarines didn't update total_ocx_earned,
 * causing inflated balances on subsequent claims.
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

    // Fetch on-chain OCX balance to sync with database
    const onChainBalance = await getOnChainOCXBalance(player.wallet_address)
    const oldDbBalance = Number(player.total_ocx_earned ?? 0)

    // Update tier AND sync on-chain balance to prevent double-claiming
    const timestamp = new Date().toISOString()
    const updateData: any = {
      submarine_tier: targetTier,
      updated_at: timestamp,
    }

    // Only update total_ocx_earned if we successfully fetched on-chain balance
    // This ensures DB reflects actual spendable tokens after purchase
    if (onChainBalance !== null) {
      updateData.total_ocx_earned = onChainBalance
      console.info("[submarine/sync-tier] � Syncing on-chain balance to DB:", {
        wallet: auth.walletAddress,
        oldDbBalance,
        onChainBalance,
        difference: oldDbBalance - onChainBalance,
      })
    }

    const { data: updated, error: updateErr } = await supabase
      .from("players")
      .update(updateData)
      .eq("id", player.id)
      .select("id, submarine_tier, total_ocx_earned")
      .single()

    if (updateErr || !updated) {
      console.error("[submarine/sync-tier] Update failed:", updateErr)
      return NextResponse.json({ error: "Failed to sync tier" }, { status: 500 })
    }

    const finalBalance = Number(updated.total_ocx_earned ?? 0)

    console.info("[submarine/sync-tier] ✅ Tier synced + balance updated:", {
      wallet: auth.walletAddress,
      newTier: targetTier,
      balanceSynced: onChainBalance !== null,
      finalBalance,
      txHash,
    })

    return NextResponse.json({
      success: true,
      data: {
        playerId: updated.id,
        wallet: auth.walletAddress,
        previousTier: currentTier,
        newTier: updated.submarine_tier,
        balance: finalBalance,
        coins: finalBalance,
        txHash,
        onChain: true,
        balanceSynced: onChainBalance !== null,
        timestamp,
      },
    })
  } catch (err) {
    console.error("[submarine/sync-tier] Error:", err)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
