"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getSession, getCurrentUser } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import LandingPage from "@/components/landing-page"
import { AlertDialogContent } from "@/components/ui/alert-dialog";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [hasWallet, setHasWallet] = useState(false)
  const router = useRouter()


  useEffect(() => {
    // Delay checkUserStatus to ensure hydration before redirect
    setTimeout(() => {
      checkUserStatus()
    }, 0)
  }, [])

  const checkUserStatus = async () => {
    try {
      // Check authentication status
      const { session } = await getSession()

      if (!session) {
        // User not authenticated, show landing page
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }

      setIsAuthenticated(true)

      // Check if user has wallet connected
      const { user } = await getCurrentUser()
      if (user) {
        const { data: playerData } = await supabase
          .from("players")
          .select("wallet_address")
          .eq("user_id", user.id)
          .single()

        if (playerData?.wallet_address) {
          // User has wallet, redirect to dashboard
          setHasWallet(true)
          console.log("[DEBUG] HomePage: User has wallet, redirecting to /dashboard");
          router.replace("/dashboard")
          return
        } else {
          // User authenticated but no wallet, redirect to connect wallet
          router.replace("/connect-wallet")
          return
        }
      }
    } catch (error) {
      console.error("Error checking user status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading OceanX...</p>
        </div>
      </div>
    )
  }

  // Show landing page for unauthenticated users
  return <LandingPage />
}
