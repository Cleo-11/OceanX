import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import HomePageClient from "./home-page-client"
import ConnectWalletClient from "../connect-wallet/connect-wallet-client"
import type { Database } from "@/lib/types"

export default async function HomePage() {
  const supabase = createServerComponentClient<Database>({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/auth")
  }

  const { data: playerRecord } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!playerRecord || !playerRecord.wallet_address) {
    // Render the connect-wallet flow in-place to avoid a route hop to /connect-wallet
    const existingPlayer = playerRecord
      ? {
          username: playerRecord.username ?? null,
          submarine_tier: playerRecord.submarine_tier ?? null,
          total_resources_mined: playerRecord.total_resources_mined ?? null,
          total_ocx_earned: playerRecord.total_ocx_earned ?? null,
        }
      : null

    // Pass a minimal user object expected by the client component
    const userForClient = {
      id: session.user.id,
      user_metadata: session.user.user_metadata,
      email: session.user.email ?? null,
    }

    return <ConnectWalletClient user={userForClient} existingPlayer={existingPlayer} />
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