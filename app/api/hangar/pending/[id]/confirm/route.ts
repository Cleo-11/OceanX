import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * TESTING MODE: Set to true to bypass authentication checks
 * TODO: Set back to false before production deployment
 */
const TESTING_MODE_BYPASS_AUTH = true

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user && !TESTING_MODE_BYPASS_AUTH) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const pendingId = params.id
    const body = await req.json()
    const txHash = body?.txHash

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json({ error: 'invalid_txHash' }, { status: 400 })
    }

    // Ensure pending exists and belongs to user
    const { data: pending, error: fetchErr } = await supabase
      .from('pending_actions')
      .select('*')
      .eq('id', pendingId)
      .maybeSingle()

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!pending) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    
    // In testing mode, skip user ID validation
    if (!TESTING_MODE_BYPASS_AUTH && pending.user_id !== user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Store txHash onto the pending action for later verification
    const { error: updErr } = await supabase
      .from('pending_actions')
      .update({ payload: { ...pending.payload, txHash }, tx_hash: txHash })
      .eq('id', pendingId)

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error confirming pending txHash', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
