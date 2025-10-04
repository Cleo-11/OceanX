import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

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
  // BUT skip this redirect if we're coming from the callback to prevent loops
  if (pathname.startsWith('/auth') && session && !pathname.startsWith('/auth/callback')) {
    console.log("[middleware] Has session on /auth, redirecting to /connect-wallet")
    return NextResponse.redirect(new URL('/connect-wallet', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}