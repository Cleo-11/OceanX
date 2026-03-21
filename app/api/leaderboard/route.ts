import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/leaderboard
 *
 * Proxies to the game server's in-memory leaderboard.
 * The server maintains this sorted set in real-time — updated on every OCX earn,
 * spend, or claim — so there is no database read and no explorer API call on
 * this request path.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "http://localhost:3001"

const CACHE_TTL_MS = 30_000

interface LeaderboardEntry {
  rank: number
  username: string
  ocxEarned: number
  submarineTier: number
}

interface Cache {
  expiresAt: number
  data: LeaderboardEntry[]
}

let cache: Cache | null = null

export async function GET() {
  const now = Date.now()

  if (cache && cache.expiresAt > now) {
    return NextResponse.json({ success: true, data: cache.data })
  }

  try {
    const resp = await fetch(`${BACKEND_URL}/leaderboard?limit=15`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    })

    if (!resp.ok) {
      throw new Error(`Backend responded with ${resp.status}`)
    }

    const json = await resp.json()
    if (!json.success || !Array.isArray(json.data)) {
      throw new Error("Unexpected leaderboard response shape from backend")
    }

    cache = { expiresAt: now + CACHE_TTL_MS, data: json.data }
    return NextResponse.json({ success: true, data: json.data })
  } catch (err) {
    console.error(
      "[leaderboard] Backend proxy error:",
      err instanceof Error ? err.message : String(err)
    )

    // Return stale cache rather than an error if we have one
    if (cache) {
      return NextResponse.json({ success: true, data: cache.data })
    }

    return NextResponse.json(
      { error: "Leaderboard temporarily unavailable" },
      { status: 503 }
    )
  }
}

