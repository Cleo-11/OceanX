// Example: How to navigate to the profile page from any component

import { useRouter } from "next/navigation"
import { WalletManager } from "@/lib/wallet"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"

export function ProfileNavigationExample() {
  const router = useRouter()

  const handleNavigateToProfile = () => {
    // Get connected wallet address
    const walletManager = WalletManager.getInstance()
    const connection = walletManager.getConnection()

    if (!connection) {
      alert("Please connect your wallet first!")
      return
    }

    // Navigate to profile with wallet address
    router.push(`/profile?wallet=${connection.address}`)
  }

  return (
    <Button onClick={handleNavigateToProfile}>
      <User className="mr-2 h-4 w-4" />
      View Profile
    </Button>
  )
}

// ==========================================
// Example: Using Link component (recommended for better SEO)
// ==========================================

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"

interface ProfileLinkProps {
  walletAddress: string
}

export function ProfileLink({ walletAddress }: ProfileLinkProps) {
  return (
    <Link href={`/profile?wallet=${walletAddress}`}>
      <Button variant="outline">
        <User className="mr-2 h-4 w-4" />
        View Profile
      </Button>
    </Link>
  )
}

// ==========================================
// Example: Integration in user-home.tsx
// ==========================================

// Add this button to your existing user-home.tsx component:

/*
import { User } from "lucide-react"

// In your render section:
<Button
  onClick={() => router.push(`/profile?wallet=${playerData.wallet_address}`)}
  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
>
  <User className="mr-2 h-4 w-4" />
  View Profile
</Button>
*/

// ==========================================
// Example: Server-side redirect
// ==========================================

// In a server action or API route:
import { redirect } from "next/navigation"

export async function navigateToProfile(walletAddress: string) {
  redirect(`/profile?wallet=${walletAddress}`)
}

// ==========================================
// Example: With authentication check
// ==========================================

import { useRouter } from "next/navigation"
import { WalletManager } from "@/lib/wallet"
import { supabase } from "@/lib/supabase"

export function ProfileNavigationWithAuth() {
  const router = useRouter()

  const handleNavigateToProfile = async () => {
    try {
      // Check wallet connection
      const walletManager = WalletManager.getInstance()
      const connection = walletManager.getConnection()

      if (!connection) {
        throw new Error("Wallet not connected")
      }

      // Verify player exists in database
      const { data, error } = await supabase
        .from("players")
        .select("wallet_address")
        .eq("wallet_address", connection.address)
        .single()

      if (error || !data) {
        throw new Error("Player profile not found")
      }

      // Navigate to profile
      router.push(`/profile?wallet=${connection.address}`)
    } catch (error) {
      console.error("Navigation error:", error)
      alert("Unable to access profile. Please ensure your wallet is connected and you have an active player profile.")
    }
  }

  return (
    <button onClick={handleNavigateToProfile}>
      Go to Profile
    </button>
  )
}
