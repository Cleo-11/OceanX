import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const pathname = req.nextUrl.pathname

  // Skip middleware for auth callback to allow it to complete
  if (pathname.startsWith('/auth/callback')) {
    console.log("[middleware] Skipping middleware for /auth/callback")
    return res
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  console.log("[middleware]", {
    pathname,
    hasSession: !!session,
    userId: session?.user?.id,
  })

  // Protected routes that require authentication
  const protectedRoutes = ['/home', '/game', '/connect-wallet']
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Redirect to auth if trying to access protected route without session
  if (isProtectedRoute && !session) {
    console.log("[middleware] No session, redirecting to /auth")
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  // Redirect to connect-wallet if authenticated but trying to access auth
  if (pathname.startsWith('/auth') && session) {
    console.log("[middleware] Has session on /auth, redirecting to /connect-wallet")
    return NextResponse.redirect(new URL('/connect-wallet', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}