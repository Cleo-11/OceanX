/**
 * Profile Navigation Utilities
 * Secure navigation to profile page with access token
 */

import { useRouter } from "next/navigation"
import { useState } from "react"

interface GenerateTokenResponse {
  token: string
  expiresIn: number
}

/**
 * Generate profile access token from API
 */
async function generateProfileToken(
  walletAddress: string,
  userId: string
): Promise<string> {
  const response = await fetch("/api/profile/generate-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ walletAddress, userId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to generate access token")
  }

  const data: GenerateTokenResponse = await response.json()
  return data.token
}

/**
 * Hook for secure profile navigation
 * Generates token and navigates to profile page
 */
export function useProfileNavigation() {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigateToProfile = async (walletAddress: string, userId: string) => {
    setIsNavigating(true)
    setError(null)

    try {
      // Generate secure access token
      const token = await generateProfileToken(walletAddress, userId)

      // Navigate to profile with token
      router.push(`/profile?wallet=${walletAddress}&token=${token}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Navigation failed"
      setError(errorMessage)
      console.error("❌ [ProfileNav] Navigation error:", err)
      
      // Show user-friendly error
      alert("Unable to access profile. Please try again.")
    } finally {
      setIsNavigating(false)
    }
  }

  return { navigateToProfile, isNavigating, error }
}

/**
 * Direct function to navigate to profile (for non-hook usage)
 */
export async function navigateToProfilePage(
  walletAddress: string,
  userId: string,
  router: ReturnType<typeof useRouter>
): Promise<void> {
  try {
    const token = await generateProfileToken(walletAddress, userId)
    router.push(`/profile?wallet=${walletAddress}&token=${token}`)
  } catch (error) {
    console.error("❌ [ProfileNav] Navigation error:", error)
    throw error
  }
}
