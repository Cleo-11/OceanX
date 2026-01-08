import { NextRequest, NextResponse } from 'next/server'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/jwt-auth'

/**
 * Sign out endpoint - clears JWT cookies
 * No Supabase auth calls needed since we use custom JWT tokens
 */
export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true })

  // Clear both access and refresh token cookies
  const cookieOptions = {
    maxAge: 0,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  }

  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: '',
    ...cookieOptions,
  })

  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: '',
    ...cookieOptions,
  })

  console.log('[api/auth/signout] Cleared JWT cookies')

  return response
}
