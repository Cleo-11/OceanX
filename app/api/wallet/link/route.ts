import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/types"

/**
 * POST /api/wallet/link
 * 
 * Links a wallet address to the authenticated user's player account.
 * Uses service role to ensure the player record exists and can be updated.
 */
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Verify user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { walletAddress, username } = body

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      )
    }

    // Check if wallet is already linked to another account
    const { data: existingPlayer } = await supabase
      .from("players")
      .select("user_id, username")
      .eq("wallet_address", walletAddress)
      .maybeSingle()

    if (existingPlayer && existingPlayer.user_id !== session.user.id) {
      return NextResponse.json(
        {
          error: `This wallet is already linked to another account (${existingPlayer.username || 'Unknown User'}). Please use a different wallet.`,
        },
        { status: 409 }
      )
    }

    // Update player record with wallet address
    // The player record should already exist from the auth trigger
    const { data: updatedPlayer, error: updateError } = await supabase
      .from("players")
      .update({
        wallet_address: walletAddress,
        username: username || session.user.email?.split("@")[0] || "Captain",
        last_login: new Date().toISOString(),
        is_active: true,
      })
      .eq("user_id", session.user.id)
      .select()
      .single()

    if (updateError) {
      console.error("[wallet/link] Failed to update player:", updateError)
      return NextResponse.json(
        { error: "Failed to link wallet. Please try again." },
        { status: 500 }
      )
    }

    if (!updatedPlayer) {
      console.error("[wallet/link] Update succeeded but no player returned")
      return NextResponse.json(
        { error: "Player record not found. Please sign out and sign in again." },
        { status: 404 }
      )
    }

    console.info("[wallet/link] Wallet linked successfully", {
      userId: session.user.id,
      walletAddress: walletAddress.slice(0, 10) + "...",
    })

    return NextResponse.json({
      success: true,
      player: {
        id: updatedPlayer.id,
        wallet_address: updatedPlayer.wallet_address,
        username: updatedPlayer.username,
      },
    })
  } catch (error) {
    console.error("[wallet/link] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
