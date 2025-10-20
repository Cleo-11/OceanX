import { redirect } from "next/navigation"
import { ProfileClient } from "./profile-client"
import { supabase } from "@/lib/supabase"
import { verifyProfileAccessToken } from "@/lib/profile-access-token"

// Type definitions for profile data
export interface ProfileData {
  playerInfo: {
    username: string | null
    walletAddress: string | null
    joinDate: string | null
    userId: string
  }
  tokenInfo: {
    ocxBalance: number
    totalEarned: number
    totalMined: number
    coins: number
  }
  submarineInfo: {
    currentTier: number
    submarineName: string
    nextUpgradeCost: number | null
  }
  resourceStats: {
    totalResourcesMined: number
    fuelRemaining: number
    missionsCompleted: number
  }
  achievements: {
    badgesUnlocked: number
    nextGoalProgress: number
  }
}

/**
 * Profile Page - Secure Server Component
 * ONLY accessible from user home page with valid access token
 * Fetches user data from Supabase based on authenticated wallet address
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { wallet?: string; token?: string }
}) {
  const walletAddress = searchParams.wallet
  const accessToken = searchParams.token

  // ⚠️ SECURITY: Require access token from user home page
  if (!accessToken || !walletAddress) {
    console.warn("❌ [Profile] Access denied: Missing token or wallet address")
    redirect("/home")
  }

  // Verify the access token
  const tokenData = verifyProfileAccessToken(accessToken)
  
  if (!tokenData) {
    console.warn("❌ [Profile] Access denied: Invalid or expired token")
    redirect("/home")
  }

  // Verify wallet address matches token
  if (tokenData.walletAddress !== walletAddress) {
    console.warn("❌ [Profile] Access denied: Wallet address mismatch")
    redirect("/home")
  }

  console.log("✅ [Profile] Access granted for wallet:", walletAddress)

  // Fetch player data from Supabase securely on the server
  const { data: playerData, error } = await supabase
    .from("players")
    .select("*")
    .eq("wallet_address", walletAddress)
    .single()

  // Handle errors or missing data
  if (error || !playerData) {
    console.error("❌ [Profile] Failed to fetch player data:", error)
    redirect("/")
  }

  // Fetch submarine tier information
  const { data: submarineData } = await supabase
    .from("submarine_tiers")
    .select("*")
    .eq("id", playerData.submarine_tier || 1)
    .single()

  // Calculate next upgrade cost
  const { data: nextTierData } = await supabase
    .from("submarine_tiers")
    .select("cost")
    .eq("id", (playerData.submarine_tier || 1) + 1)
    .single()

  // Transform data into structured profile format
  const profileData: ProfileData = {
    playerInfo: {
      username: playerData.username || "Captain Anonymous",
      walletAddress: playerData.wallet_address,
      joinDate: playerData.created_at,
      userId: playerData.user_id,
    },
    tokenInfo: {
      ocxBalance: playerData.coins || 0,
      totalEarned: Number(playerData.total_ocx_earned) || 0,
      totalMined: playerData.total_resources_mined || 0,
      coins: playerData.coins || 0,
    },
    submarineInfo: {
      currentTier: playerData.submarine_tier || 1,
      submarineName: submarineData?.name || "Basic Submarine",
      nextUpgradeCost: nextTierData?.cost || null,
    },
    resourceStats: {
      totalResourcesMined: playerData.total_resources_mined || 0,
      fuelRemaining: 100, // TODO: Add fuel tracking to database
      missionsCompleted: 0, // TODO: Add missions tracking
    },
    achievements: {
      badgesUnlocked: Math.floor((playerData.total_resources_mined || 0) / 1000),
      nextGoalProgress:
        ((playerData.total_resources_mined || 0) % 1000) / 10, // Progress to next badge (0-100%)
    },
  }

  return <ProfileClient profileData={profileData} walletAddress={walletAddress} />
}
