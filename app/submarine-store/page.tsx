import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/lib/types"
import SubmarineStoreClient from "./page-client"

export default async function SubmarineStorePage() {
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
    <SubmarineStoreClient
      currentTier={playerRecord.submarine_tier ?? 1}
      resources={{
        nickel: playerRecord.nickel ?? 0,
        cobalt: playerRecord.cobalt ?? 0,
        copper: playerRecord.copper ?? 0,
        manganese: playerRecord.manganese ?? 0,
      }}
      balance={playerRecord.balance ?? 0}
    />
  )
}
