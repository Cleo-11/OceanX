import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * TESTING ONLY ENDPOINT
 * This endpoint directly updates submarine tier without any authentication or blockchain verification
 * TODO: DELETE THIS FILE BEFORE PRODUCTION DEPLOYMENT
 */

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const body = await req.json()
    const { targetTier } = body

    if (!targetTier || typeof targetTier !== 'number') {
      return NextResponse.json({ error: 'Invalid targetTier' }, { status: 400 })
    }

    // Try to get authenticated user, but don't require it
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // If user is authenticated, update their tier
      const { error: updateError } = await supabase
        .from('players')
        .upsert({ 
          user_id: user.id,
          submarine_tier: targetTier,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id' 
        })

      if (updateError) {
        console.error('Failed to update player tier:', updateError)
        return NextResponse.json({ 
          error: updateError.message,
          ok: false 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        ok: true, 
        tier: targetTier,
        message: 'Submarine tier updated successfully (testing mode)'
      })
    } else {
      // If no user, just return success (client-side will handle the tier)
      return NextResponse.json({ 
        ok: true, 
        tier: targetTier,
        message: 'No user authenticated - tier change client-side only (testing mode)'
      })
    }
  } catch (e) {
    console.error('Error in test upgrade:', e)
    return NextResponse.json({ error: 'Internal error', ok: false }, { status: 500 })
  }
}
