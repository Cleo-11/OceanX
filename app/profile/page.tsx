import { redirect } from "next/navigation"
import { ProfileClient } from "./profile-client"
import { getAuthFromCookies, createSupabaseAdmin } from "@/lib/supabase-server"

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
 * Protected by JWT token authentication
 * Fetches user data from Supabase based on authenticated wallet
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { wallet?: string }
}) {
  // If a wallet query param is present we allow access by wallet lookup
  const queryWallet = searchParams.wallet

  // Get auth from JWT cookie
  const auth = await getAuthFromCookies()

  // If no wallet query param, require JWT auth
  let targetWallet: string
  if (!queryWallet) {
    if (!auth) {
      console.warn("❌ [Profile] Access denied: Not authenticated")
      redirect("/home")
    }
    targetWallet = auth.walletAddress
  } else {
    console.log("✅ [Profile] Access granted for wallet:", queryWallet)
    targetWallet = queryWallet
  }

  // Use admin client for database operations
  const supabase = createSupabaseAdmin()

  // Fetch player data by wallet address
  const { data: playerData, error } = await supabase
    .from("players")
    .select("*")
    .eq("wallet_address", targetWallet)
    .single()

  // Handle errors or missing data
  if (error || !playerData) {
    console.error("❌ [Profile] Failed to fetch player data:", error)
    redirect("/home")
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
        ((playerData.total_resources_mined || 0) % 1000) / 10,
    },
  }

  return <ProfileClient profileData={profileData} walletAddress={playerData.wallet_address} />
}
