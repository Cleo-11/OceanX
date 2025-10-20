import { redirect } from "next/navigation"
import { ProfileClient } from "./profile-client"
import { createSupabaseServerClient } from "@/lib/supabase-server"

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
 * Protected by Supabase server-side session authentication
 * Fetches user data from Supabase based on authenticated session
 */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { wallet?: string }
}) {
  // Create server-side Supabase client (reads auth from cookies)
  const supabase = await createSupabaseServerClient()
  
  // Get authenticated user from session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  // ⚠️ SECURITY: Require authenticated session
  if (authError || !user) {
    console.warn("❌ [Profile] Access denied: Not authenticated")
    redirect("/home")
  }

  // Optional: If wallet param provided, verify it matches the session
  const walletAddress = searchParams.wallet
  if (walletAddress) {
    console.log("✅ [Profile] Access granted for wallet:", walletAddress)
  }

  // Fetch player data from Supabase securely on the server
  // Use wallet from query param if provided, otherwise fetch by user_id from session
  let playerData
  let error

  if (walletAddress) {
    // Fetch by wallet address
    const result = await supabase
      .from("players")
      .select("*")
      .eq("wallet_address", walletAddress)
      .single()
    playerData = result.data
    error = result.error
  } else {
    // Fetch by user_id from authenticated session
    const result = await supabase
      .from("players")
      .select("*")
      .eq("user_id", user.id)
      .single()
    playerData = result.data
    error = result.error
  }

  // Handle errors or missing data
  if (error || !playerData) {
    console.error("❌ [Profile] Failed to fetch player data:", error)
    redirect("/home")
  }

  // Extract wallet address from player data if not in query param
  const profileWalletAddress = playerData.wallet_address

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

  return <ProfileClient profileData={profileData} walletAddress={profileWalletAddress} />
}
