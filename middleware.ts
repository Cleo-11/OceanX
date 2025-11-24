import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * TESTING MODE: Controlled by environment variables.
 * Only allow bypass when not in production AND explicit allow flag is set.
 * Environment variable to set on dev machines: `ALLOW_AUTH_BYPASS=true`
 */
const TESTING_MODE_BYPASS_AUTH = (process.env.NODE_ENV !== 'production' && process.env.ALLOW_AUTH_BYPASS === 'true')

export async function middleware(req: NextRequest) {
  const startTime = Date.now()
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const pathname = req.nextUrl.pathname
  
  console.log(`[middleware] START ${pathname} at ${startTime}`)

  // Skip middleware for auth callback to allow it to complete
  if (pathname.startsWith('/auth/callback')) {
    console.log("[middleware] Skipping middleware for /auth/callback")
    return res
  }

  // TESTING MODE: Skip all auth checks
  if (TESTING_MODE_BYPASS_AUTH) {
    console.log("[middleware] TESTING MODE - Bypassing all auth checks")
    return res
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  
  const duration = Date.now() - startTime
  console.log(`[middleware] Session check took ${duration}ms for ${pathname}`, {
    hasSession: !!session,
    userId: session?.user?.id,
  })

  // Protected routes that require authentication
  const protectedRoutes = ['/home', '/game', '/connect-wallet', '/profile', '/submarine-hangar', '/submarine-store', '/marketplace']
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Redirect to auth if trying to access protected route without session
  if (isProtectedRoute && !session) {
    console.log("[middleware] No session, redirecting to /auth")
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  // Redirect to connect-wallet if authenticated but trying to access auth
  if (pathname.startsWith('/auth') && !pathname.startsWith('/auth/callback') && session) {
    console.log("[middleware] Has session on /auth, redirecting to /connect-wallet")
    return NextResponse.redirect(new URL('/connect-wallet', req.url))
  }

  return res
}

export const config = {
  // Explicitly exclude ALL static files - only run on actual page routes
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next (Next.js internals)
     * - api routes (if we add them later)
     * - static files (images, fonts, etc.)
     * - files with extensions (css, js, etc.)
     */
    '/((?!_next|api|.*\\.).*)',
  ],
}