import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware using custom JWT validation
 * 
 * Supabase is used for database only, not sessions.
 * JWT tokens are validated manually for route protection.
 */

// Cookie name for access token
const ACCESS_TOKEN_COOKIE = 'sb-access-token'

/**
 * Production mode: Authentication is always enforced
 */

/**
 * Decode JWT payload without verification (Edge Runtime compatible)
 * For middleware, we decode and check expiry - full verification happens server-side
 */
function decodeJWTPayload(token: string): { sub: string; wallet: string; exp: number } | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    // Decode base64url payload
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const parsed = JSON.parse(decoded)
    
    return {
      sub: parsed.sub,
      wallet: parsed.wallet || parsed.sub,
      exp: parsed.exp
    }
  } catch {
    return null
  }
}

/**
 * Check if token is expired
 */
function isTokenExpired(exp: number): boolean {
  const now = Math.floor(Date.now() / 1000)
  return exp < now
}

export async function middleware(req: NextRequest) {
  const startTime = Date.now()
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname
  
  console.log(`[middleware] START ${pathname}`)

  // Skip middleware for auth callback
  if (pathname.startsWith('/auth/callback')) {
    console.log("[middleware] Skipping middleware for /auth/callback")
    return res
  }

  // Get JWT from cookie
  const token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  
  // Decode JWT to check validity (lightweight check for middleware)
  let isAuthenticated = false
  let userId: string | undefined
  
  if (token) {
    const payload = decodeJWTPayload(token)
    if (payload && !isTokenExpired(payload.exp)) {
      isAuthenticated = true
      userId = payload.sub
      console.log(`[middleware] Valid JWT found for wallet: ${payload.wallet}`)
    } else if (payload) {
      console.log(`[middleware] JWT expired at ${payload.exp}`)
    }
  }
  
  const duration = Date.now() - startTime
  console.log(`[middleware] Session check took ${duration}ms for ${pathname}`, {
    hasSession: isAuthenticated,
    userId: userId,
  })

  // Protected routes that require authentication
  const protectedRoutes = ['/home', '/game', '/profile', '/submarine-hangar', '/submarine-store', '/marketplace', '/onboarding']
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Redirect to auth if trying to access protected route without session
  if (isProtectedRoute && !isAuthenticated) {
    console.log("[middleware] No session, redirecting to /auth")
    const redirectUrl = new URL('/auth', req.url)
    redirectUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to home if authenticated but trying to access auth
  if (pathname === '/auth' && isAuthenticated) {
    console.log("[middleware] Has session on /auth, redirecting to /home")
    return NextResponse.redirect(new URL('/home', req.url))
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next (Next.js internals)
     * - api routes (handled separately)
     * - static files
     */
    '/((?!_next|api|.*\\.).*)',
  ],
}