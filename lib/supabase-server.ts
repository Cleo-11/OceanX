/**
 * Supabase Server Client
 * For use in Server Components, Server Actions, and Route Handlers
 * Reads auth session from cookies automatically
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from './env'
import type { Database } from './types'

/**
 * Create a Supabase client for server-side usage
 * Automatically reads session from cookies
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Create a Supabase Admin client for service-role operations
 * Use for database operations that bypass RLS
 */
export function createSupabaseAdmin() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Re-export JWT auth functions for convenience
export { getAuthFromCookies, verifyJWT, type AuthResult, type JWTPayload } from './jwt-auth'

/**
 * @deprecated Use getAuthFromCookies() from jwt-auth.ts instead
 * Get the current authenticated user from server-side
 * Returns null if not authenticated
 */
export async function getServerUser() {
  const supabase = await createSupabaseServerClient()
  
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * @deprecated Use getAuthFromCookies() from jwt-auth.ts instead
 * Get the current session from server-side
 * Returns null if no active session
 */
export async function getServerSession() {
  const supabase = await createSupabaseServerClient()
  
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error || !session) {
    return null
  }

  return session
}
