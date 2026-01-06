import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import MarketplaceClient from "./marketplace-client"
import type { Database } from "@/lib/types"

export default async function MarketplacePage() {
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
    redirect("/auth")
  }

  const { data: playerRecord } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!playerRecord || !playerRecord.wallet_address) {
    redirect("/home")
  }

  return (
    <MarketplaceClient
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
