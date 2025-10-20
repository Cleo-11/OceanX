/**
 * Profile Access Token Management
 * Generates secure, time-limited tokens for profile page access
 */

import { createHmac } from "crypto"

const SECRET_KEY = process.env.PROFILE_ACCESS_SECRET || "oceanx-profile-secret-key-change-in-production"

export interface ProfileAccessToken {
  walletAddress: string
  userId: string
  timestamp: number
  expiresAt: number
}

/**
 * Generate a secure token for profile access
 * Token is valid for 5 minutes
 */
export function generateProfileAccessToken(
  walletAddress: string,
  userId: string
): string {
  const now = Date.now()
  const expiresAt = now + 5 * 60 * 1000 // 5 minutes

  const payload = JSON.stringify({
    walletAddress,
    userId,
    timestamp: now,
    expiresAt,
  })

  // Create HMAC signature
  const signature = createHmac("sha256", SECRET_KEY)
    .update(payload)
    .digest("hex")

  // Combine payload and signature
  const token = Buffer.from(payload).toString("base64") + "." + signature

  return token
}

/**
 * Verify and decode profile access token
 * Returns null if invalid or expired
 */
export function verifyProfileAccessToken(
  token: string
): ProfileAccessToken | null {
  try {
    const [payloadBase64, signature] = token.split(".")
    
    if (!payloadBase64 || !signature) {
      return null
    }

    // Decode payload
    const payloadStr = Buffer.from(payloadBase64, "base64").toString()
    const payload: ProfileAccessToken = JSON.parse(payloadStr)

    // Verify signature
    const expectedSignature = createHmac("sha256", SECRET_KEY)
      .update(payloadStr)
      .digest("hex")

    if (signature !== expectedSignature) {
      console.error("❌ [ProfileToken] Invalid signature")
      return null
    }

    // Check expiration
    if (payload.expiresAt < Date.now()) {
      console.error("❌ [ProfileToken] Token expired")
      return null
    }

    return payload
  } catch (error) {
    console.error("❌ [ProfileToken] Invalid token:", error)
    return null
  }
}

/**
 * Check if token is about to expire (less than 1 minute remaining)
 */
export function isTokenExpiringSoon(token: ProfileAccessToken): boolean {
  const remainingTime = token.expiresAt - Date.now()
  return remainingTime < 60 * 1000 // Less than 1 minute
}
