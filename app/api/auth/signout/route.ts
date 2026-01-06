import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('[api/auth/signout] signOut error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Ensure auth cookie is cleared even if supabase didn't set remove
  response.cookies.set({
    name: 'sb-access-token',
    value: '',
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  response.cookies.set({
    name: 'sb-refresh-token',
    value: '',
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
