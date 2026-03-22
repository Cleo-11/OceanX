import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromCookies, createSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/submarine/upgrade
 *
 * Off-chain submarine upgrade: deducts from total_ocx_earned (pending OCX) and
 * advances the player's submarine_tier in the database.
 *
 * This is the primary upgrade path while on-chain UpgradeManager integration
 * is pending (OCXToken transfer agent registration required for on-chain flow).
 *
 * Auth: JWT cookie (same as other Next.js API routes)
 * No MetaMask / blockchain transaction required.
 */

// OCX cost to upgrade to each tier (matches UpgradeManager._bootstrapCosts & SUBMARINE_TIERS in server/index.js)
const UPGRADE_COSTS: Record<number, number> = {
  2: 100,
  3: 200,
  4: 350,
  5: 500,
  6: 750,
  7: 1000,
  8: 1500,
  9: 2000,
  10: 2750,
  11: 3500,
  12: 4500,
  13: 6000,
  14: 7500,
  15: 0,
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { targetTier } = body

    const parsedTier = Number(targetTier)
    if (!Number.isInteger(parsedTier) || parsedTier < 2 || parsedTier > 15) {
      return NextResponse.json({ error: 'Invalid target tier' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // Fetch player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, wallet_address, submarine_tier, total_ocx_earned')
      .ilike('wallet_address', auth.walletAddress)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const currentTier = player.submarine_tier ?? 1

    // Enforce sequential upgrade
    if (parsedTier !== currentTier + 1) {
      return NextResponse.json(
        { error: `Must upgrade sequentially. Current tier: ${currentTier}, requested: ${parsedTier}` },
        { status: 400 }
      )
    }

    const cost = UPGRADE_COSTS[parsedTier] ?? 0
    const currentOcx = Number(player.total_ocx_earned) || 0

    if (currentOcx < cost) {
      return NextResponse.json(
        {
          error: `Insufficient OCX. Need ${cost} OCX to reach Tier ${parsedTier}, but you only have ${currentOcx} OCX. Trade resources to earn more.`,
          required: cost,
          available: currentOcx,
        },
        { status: 402 }
      )
    }

    const newOcx = currentOcx - cost

    const { error: updateError } = await supabase
      .from('players')
      .update({
        submarine_tier: parsedTier,
        total_ocx_earned: newOcx,
        updated_at: new Date().toISOString(),
      })
      .eq('id', player.id)

    if (updateError) {
      console.error('[api/submarine/upgrade] Update failed:', updateError)
      return NextResponse.json({ error: 'Failed to apply upgrade' }, { status: 500 })
    }

    console.info('[api/submarine/upgrade] ✅ Upgrade success:', {
      wallet: auth.walletAddress,
      previousTier: currentTier,
      newTier: parsedTier,
      cost,
      newOcxBalance: newOcx,
    })

    return NextResponse.json({
      success: true,
      previousTier: currentTier,
      newTier: parsedTier,
      cost,
      newOcxBalance: newOcx,
    })
  } catch (err) {
    console.error('[api/submarine/upgrade] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
