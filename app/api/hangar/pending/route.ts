import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * TESTING MODE: Set to true to bypass authentication checks
 * TODO: Set back to false before production deployment
 */
const TESTING_MODE_BYPASS_AUTH = false
// Use a fixed UUID for testing mode to avoid foreign key issues
const TESTING_MODE_USER_ID = '00000000-0000-0000-0000-000000000000'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const body = await req.json()
    const { actionType, payload } = body

    // Ensure user is authenticated server-side (bypass in testing mode)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user && !TESTING_MODE_BYPASS_AUTH) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    // Basic validation
    if (!actionType || typeof actionType !== 'string') {
      return NextResponse.json({ error: 'invalid actionType' }, { status: 400 })
    }

    // In testing mode, use a dummy UUID if no user is authenticated
    const userId = user?.id ?? (TESTING_MODE_BYPASS_AUTH ? TESTING_MODE_USER_ID : null)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const insert = await supabase.from('pending_actions').insert({
      user_id: userId,
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
