import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import LandingPage from "@/components/landing-page"
import type { Database } from "@/lib/types"
import { isForceWalletFlow } from "@/lib/env"

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

  // In development (or when explicitly forced), always go through connect-wallet flow
  if (isForceWalletFlow()) {
    redirect("/connect-wallet")
  }

  // In normal mode, send users with linked wallets to /home
  if (playerData?.wallet_address) {
    redirect("/home")
  }

  redirect("/connect-wallet")
}
