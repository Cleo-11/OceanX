import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const body = await req.json()
    const { actionType, payload } = body

    // Ensure user is authenticated server-side
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    // Basic validation
    if (!actionType || typeof actionType !== 'string') {
      return NextResponse.json({ error: 'invalid actionType' }, { status: 400 })
    }

    const insert = await supabase.from('pending_actions').insert({
      user_id: user.id,
      action_type: actionType,
      payload: payload ?? {},
      status: 'pending',
      created_at: new Date().toISOString(),
    }).select().single()

    if (insert.error) {
      console.error('Failed to create pending action', insert.error)
      return NextResponse.json({ error: insert.error.message }, { status: 500 })
    }

    return NextResponse.json({ id: insert.data.id })
  } catch (e) {
    console.error('Error in pending create', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
