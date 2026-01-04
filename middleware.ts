import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * TESTING MODE: Controlled by environment variables.
 * Only allow bypass when not in production AND explicit allow flag is set.
 * Environment variable to set on dev machines: `ALLOW_AUTH_BYPASS=true`
 * 
 * 🚨 SECURITY: Hard fail if auth bypass is attempted in production
 */
const NODE_ENV = process.env.NODE_ENV || 'production'; // Default to production for safety
const ALLOW_AUTH_BYPASS_RAW = process.env.ALLOW_AUTH_BYPASS === 'true';

// 🚨 CRITICAL SECURITY CHECK: Prevent auth bypass in production
if (NODE_ENV === 'production' && ALLOW_AUTH_BYPASS_RAW) {
  throw new Error(
    '🚨 SECURITY VIOLATION: ALLOW_AUTH_BYPASS cannot be enabled in production! ' +
    'Remove this environment variable immediately.'
  );
}

const TESTING_MODE_BYPASS_AUTH = (NODE_ENV !== 'production' && ALLOW_AUTH_BYPASS_RAW)

export async function middleware(req: NextRequest) {
  const startTime = Date.now()
  let res = NextResponse.next()

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

  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

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
    const redirectUrl = new URL('/auth', req.url)
    // Add a flag to prevent redirect loops
    redirectUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to connect-wallet if authenticated but trying to access auth
  // But NOT if we just came from a redirect (prevents loops)
  if (pathname === '/auth' && session) {
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