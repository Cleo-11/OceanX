import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getAuthFromRequest } from '@/lib/jwt-auth'

export async function POST(req: Request) {
  try {
    // Authenticate using JWT
    const auth = getAuthFromRequest(req)
    if (!auth || !auth.isValid) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const supabase = await createSupabaseServerClient()
    const body = await req.json()
    const { actionType, payload } = body

    // Basic validation
    if (!actionType || typeof actionType !== 'string') {
      return NextResponse.json({ error: 'invalid actionType' }, { status: 400 })
    }

    const insert = await supabase.from('pending_actions').insert({
      user_id: auth.userId,
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
