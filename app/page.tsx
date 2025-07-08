"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { LandingPage } from "@/components/landing-page"
import { Loader2 } from "lucide-react"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        // User is authenticated, check if they have a wallet connected
        const { data: player } = await supabase
          .from("players")
          .select("wallet_address")
          .eq("user_id", session.user.id)
          .single()

        if (player?.wallet_address) {
          // User has wallet connected, go to game
          router.push("/game")
        } else {
          // User needs to connect wallet
          router.push("/connect-wallet")
        }
      } else {
        // User not authenticated, show landing page
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Auth check error:", error)
      setIsLoading(false)
    }
  }

  const handleLogin = () => {
    router.push("/auth")
  }

  const handleSignUp = () => {
    router.push("/auth")
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

  return <LandingPage onLogin={handleLogin} onSignUp={handleSignUp} />
}
