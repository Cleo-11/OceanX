import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import GameClient from "./game-client"
import type { Database } from "@/lib/types"

export default async function GamePage() {
  const supabase = createServerComponentClient<Database>({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    console.warn("[game/page] No session, redirecting to /auth")
    redirect("/auth")
  }

  console.info("[game/page] Session found for user:", {
    userId: session.user.id,
    email: session.user.email,
  })

  // Load player data server-side
  const { data: playerData, error: playerError } = await supabase
    .from("players")
    .select("wallet_address, nickel, cobalt, copper, manganese")
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (playerError) {
    console.error("[game/page] Error loading player data:", playerError)
  }

  console.info("[game/page] Player data loaded:", {
    userId: session.user.id,
    hasPlayerData: !!playerData,
    hasWallet: !!playerData?.wallet_address,
  })

  return <GameClient userId={session.user.id} playerData={playerData} />
}
