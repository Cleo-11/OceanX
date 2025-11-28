import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import HomePageClient from "./home-page-client"
import type { Database } from "@/lib/types"

export default async function HomePage() {
  const supabase = createServerComponentClient<Database>({ cookies })

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

  if (!playerRecord || !playerRecord.wallet_address) {
    console.warn("[home/page] No wallet address, redirecting to /connect-wallet", {
      userId: session.user.id,
      hasPlayerRecord: !!playerRecord,
    })
    // Redirect to connect-wallet page instead of rendering in-place
    // to avoid redirect loops
    redirect("/connect-wallet")
  }

  return (
    <HomePageClient
      playerData={{
        id: playerRecord.id,
        user_id: playerRecord.user_id,
        wallet_address: playerRecord.wallet_address,
        username:
          playerRecord.username ??
          session.user.user_metadata?.full_name ??
          session.user.email ??
          "Captain",
        submarine_tier: playerRecord.submarine_tier ?? 1,
        total_resources_mined: playerRecord.total_resources_mined ?? 0,
        total_ocx_earned: playerRecord.total_ocx_earned ?? 0,
        last_login: playerRecord.last_login ?? new Date().toISOString(),
      }}
    />
  )
}