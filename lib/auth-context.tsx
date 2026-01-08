"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { decodeJWT, ACCESS_TOKEN_COOKIE } from '@/lib/jwt-auth'

/**
 * User interface for JWT-based auth
 * Wallet address is the primary identifier
 */
interface User {
  id: string
  wallet_address: string
  email?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  signOut: async () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Get access token from cookies (client-side)
 */
function getAccessTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === ACCESS_TOKEN_COOKIE) {
      return decodeURIComponent(value)
    }
  }
  return null
}

/**
 * Get user from JWT token (client-side decode only, no verification)
 */
function getUserFromToken(): User | null {
  const token = getAccessTokenFromCookie()
  if (!token) return null
  
  const payload = decodeJWT(token)
  if (!payload) return null
  
  // Check if token is expired
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) {
    console.log('[auth-context] JWT expired')
    return null
  }
  
  return {
    id: payload.sub,
    wallet_address: payload.wallet,
    email: payload.email,
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial user from JWT
    const initialUser = getUserFromToken()
    setUser(initialUser)
    setLoading(false)

    // Check for token changes periodically (e.g., after login in another tab)
    const interval = setInterval(() => {
      const currentUser = getUserFromToken()
      const currentId = currentUser?.id
      const stateId = user?.id
      
      // Only update if user changed
      if (currentId !== stateId) {
        setUser(currentUser)
      }
    }, 2000) // Check every 2 seconds

    return () => clearInterval(interval)
  }, [])

  const handleSignOut = async () => {
    try {
      const response = await fetch('/api/auth/signout', { method: 'POST' })
      if (response.ok) {
        setUser(null)
        // Redirect to landing page
        window.location.href = '/'
      }
    } catch (error) {
      console.error('[auth-context] Sign out failed:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}