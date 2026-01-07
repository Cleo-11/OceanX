import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import HomePageClient from "./home-page-client"
import type { Database } from "@/lib/types"

export default async function HomePage() {
  const cookieStore = cookies()
  
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    console.warn("[home/page] No session, redirecting to /auth")
    redirect("/auth")
  }

  const { data: playerRecord, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (playerError) {
    console.error("[home/page] Error loading player record:", {
      userId: session.user.id,
      error: playerError.message,
      code: playerError.code,
    })
  }

  console.info("[home/page] Player record check:", {
    userId: session.user.id,
    hasPlayerRecord: !!playerRecord,
    hasWalletAddress: playerRecord?.wallet_address ? "YES" : "NO",
    walletAddress: playerRecord?.wallet_address?.slice(0, 10) + "...",
  })

  // Force onboarding if username is missing or still auto-generated
  if (!playerRecord?.username || playerRecord.username.startsWith("Captain-")) {
    redirect("/onboarding")
  }

  // If no player record or wallet, show the home page anyway
  // The wallet will be available from the user metadata
  const walletAddress = playerRecord?.wallet_address || 
    session.user.user_metadata?.wallet_address || 
    null

  return (
    <HomePageClient
      playerData={{
        id: playerRecord?.id ?? session.user.id,
        user_id: playerRecord?.user_id ?? session.user.id,
        wallet_address: walletAddress,
        username:
          playerRecord?.username ??
          session.user.user_metadata?.full_name ??
          session.user.email ??
          "Captain",
        submarine_tier: playerRecord?.submarine_tier ?? 1,
        total_resources_mined: playerRecord?.total_resources_mined ?? 0,
        total_ocx_earned: playerRecord?.total_ocx_earned ?? 0,
        last_login: playerRecord?.last_login ?? new Date().toISOString(),
      }}
    />
  )
}