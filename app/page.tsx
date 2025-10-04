import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import LandingPage from "@/components/landing-page"
import type { Database } from "@/lib/types"

export default async function HomePage() {
  const supabase = createServerComponentClient<Database>({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return <LandingPage />
  }

  const { data: playerData } = await supabase
    .from("players")
    .select("wallet_address")
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (playerData?.wallet_address) {
    redirect("/home")
  }

  redirect("/connect-wallet")
}
