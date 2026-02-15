import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { getAuthFromRequest } from "@/lib/jwt-auth"

/**
 * POST /api/wallet/link
 * 
 * Links a wallet address to the authenticated user's player account.
 * Uses JWT authentication and service role for database operations.
 */
export async function POST(request: Request) {
  try {
    // Authenticate using JWT
    const auth = getAuthFromRequest(request)
    if (!auth || !auth.isValid) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const supabase = await createSupabaseServerClient()

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

    if (existingPlayer && existingPlayer.user_id !== auth.userId) {
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
        username: username || `Captain-${auth.wallet.slice(0, 6)}`,
        last_login: new Date().toISOString(),
        is_active: true,
      })
      .eq("user_id", auth.userId)
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
      userId: auth.userId,
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
