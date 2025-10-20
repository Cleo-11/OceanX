import { NextRequest, NextResponse } from "next/server"
import { generateProfileAccessToken } from "@/lib/profile-access-token"
import { supabase } from "@/lib/supabase"

/**
 * API Route: Generate Profile Access Token
 * Called from user-home component when user clicks "View Profile"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { walletAddress, userId } = body

    if (!walletAddress || !userId) {
      return NextResponse.json(
        { error: "Missing wallet address or user ID" },
        { status: 400 }
      )
    }

    // Verify the user exists in database
    const { data: player, error } = await supabase
      .from("players")
      .select("id, user_id, wallet_address")
      .eq("wallet_address", walletAddress)
      .eq("user_id", userId)
      .single()

    if (error || !player) {
      console.error("❌ [ProfileToken] Player not found:", error)
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      )
    }

    // Generate access token
    const token = generateProfileAccessToken(walletAddress, userId)

    console.log("✅ [ProfileToken] Generated token for wallet:", walletAddress)

    return NextResponse.json({ token, expiresIn: 300 }) // 5 minutes
  } catch (error) {
    console.error("❌ [ProfileToken] Error generating token:", error)
    return NextResponse.json(
      { error: "Failed to generate access token" },
      { status: 500 }
    )
  }
}
