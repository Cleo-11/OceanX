import { NextResponse } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/**
 * GET /api/leaderboard
 * Fetches top players by OCX tokens earned
 */
export async function GET() {
  try {
    const supabase = createSupabaseAdmin()

    // Fetch top 15 players by total_ocx_earned
    const { data: leaderboardData, error: fetchError } = await supabase
      .from("players")
      .select("username, total_ocx_earned, submarine_tier")
      .not("username", "is", null)
      .not("username", "like", "Captain-%") // Exclude auto-generated usernames
      .order("total_ocx_earned", { ascending: false, nullsFirst: false })
      .limit(15)

    if (fetchError) {
      console.error("[leaderboard] Database error:", fetchError)
      return NextResponse.json(
        { error: "Failed to fetch leaderboard", details: fetchError.message },
        { status: 500 }
      )
    }

    // Define the player type for type safety
    interface LeaderboardPlayer {
      username: string | null
      total_ocx_earned: number | null
      submarine_tier: number | null
    }

    // Format the data for the frontend
    const formattedLeaderboard = ((leaderboardData || []) as LeaderboardPlayer[]).map((player, index) => ({
      rank: index + 1,
      username: player.username || "Unknown Captain",
      ocxEarned: player.total_ocx_earned || 0,
      submarineTier: player.submarine_tier || 1,
    }))

    console.info("[leaderboard] ✅ Leaderboard fetched:", {
      count: formattedLeaderboard.length,
    })

    return NextResponse.json({
      success: true,
      data: formattedLeaderboard,
    })
  } catch (err) {
    console.error("[leaderboard] Server error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
