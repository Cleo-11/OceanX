/**
 * JWT Authentication Utility
 * 
 * Central auth module for wallet-only authentication.
 * Supabase is used for database only, not for session management.
 * 
 * Usage:
 * - Server: verifyJWT(token) → returns user info if valid
 * - Client: decodeJWT(token) → decodes without verification (use for UI only)
 * - Cookies: getAuthFromCookies(cookies) → extracts and verifies JWT from cookies
 */

import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { cookies } from 'next/headers'

// JWT payload structure
export interface JWTPayload {
  sub: string           // User ID (wallet address)
  email: string         // Synthetic email (wallet@ethereum.wallet)
  wallet: string        // Wallet address (lowercase)
  iat: number           // Issued at
  exp: number           // Expiration
  iss: string           // Issuer (our app)
  role: 'authenticated' // Role for RLS compatibility
  session_id: string    // Unique session ID
}

// Auth result returned to callers
export interface AuthResult {
  userId: string        // Wallet address (used as user ID)
  wallet: string        // Wallet address
  walletAddress: string // Wallet address (alias for wallet)
  email: string         // Synthetic email
  sessionId: string     // Session ID
  isValid: boolean      // Whether JWT is valid
}

// Cookie name constants
export const ACCESS_TOKEN_COOKIE = 'sb-access-token'
export const REFRESH_TOKEN_COOKIE = 'sb-refresh-token'

/**
 * Get JWT secret from environment
 */
function getJWTSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET not configured')
  }
  return secret
}

/**
 * Generate JWT tokens for a wallet address
 */
export function generateTokens(walletAddress: string): {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: number
} {
  const secret = getJWTSecret()
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = 3600 // 1 hour
  const wallet = walletAddress.toLowerCase()
  const email = `${wallet}@ethereum.wallet`

  const payload: JWTPayload = {
    sub: wallet,
    email: email,
    wallet: wallet,
    iat: now,
    exp: now + expiresIn,
    iss: process.env.NEXT_PUBLIC_SUPABASE_URL || 'oceanx',
    role: 'authenticated',
    session_id: uuidv4()
  }

  const accessToken = jwt.sign(payload, secret, { algorithm: 'HS256' })
  const refreshToken = uuidv4()

  return {
    accessToken,
    refreshToken,
    expiresIn,
    expiresAt: now + expiresIn
  }
}

/**
 * Verify and decode a JWT token (server-side)
 * Returns null if invalid or expired
 */
export function verifyJWT(token: string): AuthResult | null {
  try {
    const secret = getJWTSecret()
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256']
    }) as JWTPayload

    const wallet = decoded.wallet || decoded.sub
    return {
      userId: decoded.sub,
      wallet,
      walletAddress: wallet, // Alias for convenience
      email: decoded.email,
      sessionId: decoded.session_id,
      isValid: true
    }
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null
  }
}

/**
 * Decode JWT without verification (client-side or for logging)
 * NEVER trust this for authorization - use verifyJWT() for that
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * Get auth from Next.js cookies (server components)
 * Uses next/headers cookies()
 */
export async function getAuthFromCookies(): Promise<AuthResult | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
    
    if (!token) {
      return null
    }

    return verifyJWT(token)
  } catch {
    return null
  }
}

/**
 * Get auth from request cookies (API routes, middleware)
 */
export function getAuthFromRequest(request: Request): AuthResult | null {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const cookies = parseCookies(cookieHeader)
    const token = cookies[ACCESS_TOKEN_COOKIE]
    
    if (!token) {
      return null
    }

    return verifyJWT(token)
  } catch {
    return null
  }
}

/**
 * Parse cookie header string into object
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=')
    if (name) {
      const trimmedName = name.trim()
      const value = rest.join('=').trim()
      if (trimmedName && value) {
        cookies[trimmedName] = decodeURIComponent(value)
      }
    }
  })
  
  return cookies
}

/**
 * Check if user is authenticated (quick boolean check)
 */
export async function isAuthenticated(): Promise<boolean> {
  const auth = await getAuthFromCookies()
  return auth !== null && auth.isValid
}

/**
 * Get user ID from cookies (convenience method)
 */
export async function getUserId(): Promise<string | null> {
  const auth = await getAuthFromCookies()
  return auth?.userId || null
}

/**
 * Get wallet address from cookies (convenience method)  
 */
export async function getWalletAddress(): Promise<string | null> {
  const auth = await getAuthFromCookies()
  return auth?.wallet || null
}
