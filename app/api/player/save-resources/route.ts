import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAuthFromRequest } from "@/lib/jwt-auth"
import { SUBMARINE_TIERS } from "@/lib/submarine-tiers"
import type { Database } from "@/lib/types"

// Maximum resource delta allowed per save (prevents injection of absurd values)
const MAX_DELTA_PER_RESOURCE = 50
// Minimum time between saves (ms) — prevents rapid-fire exploitation
const MIN_SAVE_INTERVAL_MS = 2000
// In-memory rate limiter: wallet -> last save timestamp
const lastSaveTimestamps = new Map<string, number>()

/**
 * POST /api/player/save-resources
 *
 * Server-authoritative resource saving. Accepts DELTAS (increments only),
 * validates against the player's submarine tier storage caps, and enforces
 * rate limiting. Raw absolute values are NO LONGER accepted.
 *
 * Body: { deltas: { nickel?: number, cobalt?: number, copper?: number, manganese?: number } }
 * Each delta must be >= 0 and <= MAX_DELTA_PER_RESOURCE.
 */
export async function POST(request: Request) {
  try {
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Authenticate via JWT
    const auth = getAuthFromRequest(request)
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const wallet = auth.walletAddress?.toLowerCase()
    if (!wallet) {
      return NextResponse.json({ error: "No wallet address" }, { status: 401 })
    }

    // Rate limiting: enforce minimum interval between saves
    const now = Date.now()
    const lastSave = lastSaveTimestamps.get(wallet) || 0
    if (now - lastSave < MIN_SAVE_INTERVAL_MS) {
      return NextResponse.json(
        { error: "Too many save requests. Please wait.", retryAfterMs: MIN_SAVE_INTERVAL_MS - (now - lastSave) },
        { status: 429 }
      )
    }
    lastSaveTimestamps.set(wallet, now)

    // Parse and validate deltas
    const body = await request.json()
    const deltas = body?.deltas
    if (!deltas || typeof deltas !== "object") {
      return NextResponse.json(
        { error: "Invalid request body. Expected { deltas: { nickel?, cobalt?, copper?, manganese? } }" },
        { status: 400 }
      )
    }

    const RESOURCE_TYPES = ["nickel", "cobalt", "copper", "manganese"] as const
    const validatedDeltas: Record<string, number> = {}

    for (const resource of RESOURCE_TYPES) {
      const val = deltas[resource]
      if (val === undefined || val === null || val === 0) {
        validatedDeltas[resource] = 0
        continue
      }
      if (typeof val !== "number" || !Number.isFinite(val)) {
        return NextResponse.json(
          { error: `Invalid delta for ${resource}: must be a finite number` },
          { status: 400 }
        )
      }
      // Only positive deltas allowed (no negative to prevent stealing from yourself to hide exploits)
      if (val < 0) {
        return NextResponse.json(
          { error: `Negative delta for ${resource} not allowed` },
          { status: 400 }
        )
      }
      if (val > MAX_DELTA_PER_RESOURCE) {
        console.warn(`[save-resources] Suspiciously large delta for ${resource}: ${val} from ${wallet}`)
        return NextResponse.json(
          { error: `Delta for ${resource} exceeds maximum (${MAX_DELTA_PER_RESOURCE})` },
          { status: 400 }
        )
      }
      validatedDeltas[resource] = Math.floor(val) // integers only
    }

    // If all deltas are 0, nothing to do
    const totalDelta = Object.values(validatedDeltas).reduce((a, b) => a + b, 0)
    if (totalDelta === 0) {
      return NextResponse.json({ success: true, message: "No changes" })
    }

    // Fetch current player data (server-side source of truth)
    const { data: player, error: fetchError } = await supabaseAdmin
      .from("players")
      .select("nickel, cobalt, copper, manganese, submarine_tier, total_resources_mined")
      .ilike("wallet_address", wallet)
      .single()

    if (fetchError || !player) {
      console.error("[save-resources] Player not found:", fetchError)
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Get storage caps from submarine tier
    const tier = player.submarine_tier || 1
    const tierData = SUBMARINE_TIERS.find((t) => t.tier === tier) || SUBMARINE_TIERS[0]
    const maxCapacity = tierData.baseStats.maxCapacity

    // Apply deltas with storage cap enforcement
    const newResources: Record<string, number> = {}
    const cappedDeltas: Record<string, number> = {}

    for (const resource of RESOURCE_TYPES) {
      const current = (player as any)[resource] || 0
      const cap = (maxCapacity as any)[resource] || 100
      const delta = validatedDeltas[resource]

      // Clamp: current + delta cannot exceed cap
      const newValue = Math.min(current + delta, cap)
      const actualDelta = newValue - current

      newResources[resource] = newValue
      cappedDeltas[resource] = actualDelta
    }

    const actualTotalDelta = Object.values(cappedDeltas).reduce((a, b) => a + b, 0)
    if (actualTotalDelta === 0) {
      return NextResponse.json({
        success: true,
        message: "Storage full — no resources added",
        resources: {
          nickel: (player as any).nickel || 0,
          cobalt: (player as any).cobalt || 0,
          copper: (player as any).copper || 0,
          manganese: (player as any).manganese || 0,
        },
      })
    }

    // Write validated resources to DB
    const newTotal = (player.total_resources_mined || 0) + actualTotalDelta
    const { data, error } = await supabaseAdmin
      .from("players")
      .update({
        nickel: newResources.nickel,
        cobalt: newResources.cobalt,
        copper: newResources.copper,
        manganese: newResources.manganese,
        total_resources_mined: newTotal,
        last_login: new Date().toISOString(),
        is_active: true,
      })
      .ilike("wallet_address", wallet)
      .select("id, nickel, cobalt, copper, manganese, total_resources_mined")
      .single()

    if (error) {
      console.error("[save-resources] Failed to save:", error)
      return NextResponse.json(
        { error: `Failed to save resources: ${error.message}` },
        { status: 500 }
      )
    }

    // Audit logging: record resource events for anti-cheat and forensics
    const eventInserts = []
    for (const [resource, delta] of Object.entries(cappedDeltas)) {
      if (delta > 0) {
        eventInserts.push({
          player_id: data.id,
          wallet_address: wallet,
          resource_type: resource,
          amount: delta,
          event_type: 'mining',
          source_table: 'game_client',
          metadata: { tier, requestedDelta: validatedDeltas[resource], capped: delta < validatedDeltas[resource] }
        })
      }
    }
    if (eventInserts.length > 0) {
      const { error: logError } = await supabaseAdmin
        .from('resource_events')
        .insert(eventInserts)
      if (logError) {
        console.warn('[save-resources] Failed to log resource events:', logError)
      }
    }

    console.info("[save-resources] Saved (delta-based):", {
      wallet,
      deltas: cappedDeltas,
      newResources: data,
      tier,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[save-resources] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/player/save-resources
 *
 * Returns the server's authoritative resource state for the authenticated player.
 * Use this to sync client state with the database.
 */
export async function GET(request: Request) {
  try {
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const auth = getAuthFromRequest(request)
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const wallet = auth.walletAddress?.toLowerCase()
    if (!wallet) {
      return NextResponse.json({ error: "No wallet address" }, { status: 401 })
    }

    const { data: player, error } = await supabaseAdmin
      .from("players")
      .select("nickel, cobalt, copper, manganese, total_resources_mined, submarine_tier, total_ocx_earned")
      .ilike("wallet_address", wallet)
      .single()

    if (error || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      resources: {
        nickel: player.nickel || 0,
        cobalt: player.cobalt || 0,
        copper: player.copper || 0,
        manganese: player.manganese || 0,
      },
      totalResourcesMined: player.total_resources_mined || 0,
      tier: player.submarine_tier || 1,
      totalOcxEarned: player.total_ocx_earned || 0,
    })
  } catch (error) {
    console.error("[save-resources GET] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
