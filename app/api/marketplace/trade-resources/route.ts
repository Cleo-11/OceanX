import { NextResponse } from "next/server"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"
import { SUBMARINE_TIERS } from "@/lib/submarine-tiers"

export const dynamic = "force-dynamic"

// Trade cooldown: 60 seconds between trades to prevent rapid exploitation
const TRADE_COOLDOWN_MS = 60_000
// In-memory rate limiter: wallet -> last trade timestamp
const lastTradeTimestamps = new Map<string, number>()
// Max OCX earnable per trade (tier 15 full storage: 2000*0.1 + 1000*0.5 + 1000*1.0 + 500*2.0 = 2700)
const MAX_OCX_PER_TRADE = 3000

/**
 * POST /api/marketplace/trade-resources
 *
 * Converts all player resources → OCX off-chain (database only, no blockchain).
 * Uses JWT cookie auth — NO MetaMask signature required.
 */
export async function POST() {
  try {
    // 1. Authenticate from JWT cookie
    const auth = await getAuthFromCookies()
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    // Rate limiting: enforce cooldown between trades
    const wallet = auth.walletAddress?.toLowerCase()
    if (!wallet) {
      return NextResponse.json({ error: "No wallet address" }, { status: 401 })
    }

    const now = Date.now()
    const lastTrade = lastTradeTimestamps.get(wallet) || 0
    if (now - lastTrade < TRADE_COOLDOWN_MS) {
      const retryAfter = Math.ceil((TRADE_COOLDOWN_MS - (now - lastTrade)) / 1000)
      return NextResponse.json(
        { error: `Trade cooldown active. Try again in ${retryAfter}s.`, retryAfterSeconds: retryAfter },
        { status: 429 }
      )
    }

    // 2. Fetch current player data
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, wallet_address, submarine_tier, total_ocx_earned, nickel, cobalt, copper, manganese")
      .ilike("wallet_address", auth.walletAddress)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // 3. Read current resources
    const resources = {
      nickel: player.nickel || 0,
      cobalt: player.cobalt || 0,
      copper: player.copper || 0,
      manganese: player.manganese || 0,
    }

    // 3a. Server-side sanity check: resources should not exceed tier storage caps
    const tier = player.submarine_tier || 1
    const tierData = SUBMARINE_TIERS.find((t) => t.tier === tier) || SUBMARINE_TIERS[0]
    const maxCap = tierData.baseStats.maxCapacity

    const cappedResources = {
      nickel: Math.min(resources.nickel, maxCap.nickel),
      cobalt: Math.min(resources.cobalt, maxCap.cobalt),
      copper: Math.min(resources.copper, maxCap.copper),
      manganese: Math.min(resources.manganese, maxCap.manganese),
    }

    // If resources exceed tier caps, clamp them (prevents exploited values from being traded)
    if (
      cappedResources.nickel < resources.nickel ||
      cappedResources.cobalt < resources.cobalt ||
      cappedResources.copper < resources.copper ||
      cappedResources.manganese < resources.manganese
    ) {
      console.warn("[trade-resources] ⚠️ Resources exceeded tier caps — clamped:", {
        wallet: auth.walletAddress,
        tier,
        original: resources,
        capped: cappedResources,
      })
    }

    const totalResources = cappedResources.nickel + cappedResources.cobalt + cappedResources.copper + cappedResources.manganese
    if (totalResources <= 0) {
      return NextResponse.json({ error: "No resources to trade" }, { status: 400 })
    }

    // 4. Calculate OCX value (using CAPPED resources, not raw)
    const RESOURCE_TO_OCX_RATE: Record<string, number> = {
      nickel: 0.1,
      cobalt: 0.5,
      copper: 1.0,
      manganese: 2.0,
    }

    const nickelValue = Math.floor(cappedResources.nickel * RESOURCE_TO_OCX_RATE.nickel)
    const cobaltValue = Math.floor(cappedResources.cobalt * RESOURCE_TO_OCX_RATE.cobalt)
    const copperValue = Math.floor(cappedResources.copper * RESOURCE_TO_OCX_RATE.copper)
    const manganeseValue = Math.floor(cappedResources.manganese * RESOURCE_TO_OCX_RATE.manganese)
    const totalOcxEarned = nickelValue + cobaltValue + copperValue + manganeseValue

    if (totalOcxEarned <= 0) {
      return NextResponse.json({ error: "Resources too few to yield any OCX" }, { status: 400 })
    }

    // Sanity cap: prevent impossibly large OCX gains
    if (totalOcxEarned > MAX_OCX_PER_TRADE) {
      console.warn("[trade-resources] ⚠️ OCX exceeds max per trade — clamped:", {
        wallet: auth.walletAddress,
        calculated: totalOcxEarned,
        max: MAX_OCX_PER_TRADE,
      })
      return NextResponse.json(
        { error: "Trade value exceeds maximum. This has been logged." },
        { status: 400 }
      )
    }

    // Record trade timestamp for rate limiting
    lastTradeTimestamps.set(wallet, now)

    // 5. Update DB: zero resources + credit total_ocx_earned
    const currentOcx = Number(player.total_ocx_earned) || 0
    const newOcxBalance = currentOcx + totalOcxEarned

    const { error: updateError } = await supabase
      .from("players")
      .update({
        nickel: 0,
        cobalt: 0,
        copper: 0,
        manganese: 0,
        total_ocx_earned: newOcxBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", player.id)

    if (updateError) {
      console.error("[api/marketplace/trade-resources] Update failed:", updateError)
      return NextResponse.json({ error: "Failed to update player" }, { status: 500 })
    }

    // Audit logging: record resource trade events
    const tradeId = `trade_${player.id}_${Date.now()}`
    const eventInserts = []
    for (const [resource, amount] of Object.entries(cappedResources)) {
      if (amount > 0) {
        eventInserts.push({
          player_id: player.id,
          wallet_address: wallet,
          resource_type: resource,
          amount: -amount, // Negative = spent
          event_type: 'trade_sell',
          source_id: tradeId,
          source_table: 'marketplace_trades',
          metadata: { ocx_earned: totalOcxEarned, rate: RESOURCE_TO_OCX_RATE[resource] }
        })
      }
    }
    if (eventInserts.length > 0) {
      const { error: logError } = await supabase
        .from('resource_events')
        .insert(eventInserts)
      if (logError) {
        console.warn('[trade-resources] Failed to log resource events:', logError)
      }
    }

    console.info("[api/marketplace/trade-resources] ✅ Trade success:", {
      wallet: auth.walletAddress,
      ocxEarned: totalOcxEarned,
      newBalance: newOcxBalance,
    })

    return NextResponse.json({
      success: true,
      wallet: auth.walletAddress,
      resourcesTraded: cappedResources,
      ocxEarned: totalOcxEarned,
      newOcxBalance,
      breakdown: {
        nickel: { amount: cappedResources.nickel, rate: RESOURCE_TO_OCX_RATE.nickel, value: nickelValue },
        cobalt: { amount: cappedResources.cobalt, rate: RESOURCE_TO_OCX_RATE.cobalt, value: cobaltValue },
        copper: { amount: cappedResources.copper, rate: RESOURCE_TO_OCX_RATE.copper, value: copperValue },
        manganese: { amount: cappedResources.manganese, rate: RESOURCE_TO_OCX_RATE.manganese, value: manganeseValue },
      },
    })
  } catch (err) {
    console.error("[api/marketplace/trade-resources] Error:", err)
    return NextResponse.json({ error: "Trade failed" }, { status: 500 })
  }
}
