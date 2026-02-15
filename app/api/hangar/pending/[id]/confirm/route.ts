import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getAuthFromRequest } from '@/lib/jwt-auth'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    // Authenticate using JWT
    const auth = getAuthFromRequest(req)
    if (!auth || !auth.isValid) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()

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
    
    if (pending.user_id !== auth.userId) {
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
