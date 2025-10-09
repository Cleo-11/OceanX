import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import ConnectWalletClient from "./connect-wallet-client"
import type { Database } from "@/lib/types"

export default async function ConnectWalletPage() {
  const supabase = createServerComponentClient<Database>({ cookies })
  const logPrefix = "[connect-wallet/page]"

  console.info(`${logPrefix} Handling request`)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    console.warn(`${logPrefix} No active session detected, redirecting to /auth`)
    redirect("/auth")
  }

  console.info(`${logPrefix} Session retrieved for user`, {
    userId: session.user.id,
    email: session.user.email ?? undefined,
  })

  const { data: playerRecord, error: playerError } = await supabase
    .from("players")
    .select(
      "wallet_address, username, submarine_tier, total_resources_mined, total_ocx_earned"
    )
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (playerError) {
    console.error(`${logPrefix} Failed to load player record`, {
      userId: session.user.id,
      error: playerError.message,
      hint: playerError.hint,
      details: playerError.details,
    })
  }

  if (playerRecord) {
    console.info(`${logPrefix} Player record found`, {
      userId: session.user.id,
      hasWallet: Boolean(playerRecord.wallet_address),
    })
  } else {
    console.info(`${logPrefix} No player record found`, {
      userId: session.user.id,
    })
  }

  // Note: Let the client component decide whether to redirect to /home.
  // This ensures the post-auth flow always lands on /connect-wallet first
  // (sign in -> connect wallet -> user home -> game) and avoids server-side
  // redirects that can short-circuit the intended flow.
  if (playerRecord?.wallet_address) {
    console.info(`${logPrefix} Wallet already linked, rendering client to handle redirect`, {
      userId: session.user.id,
    })
  }

  console.info(`${logPrefix} Rendering client component`, {
    userId: session.user.id,
  })

  return (
    <ConnectWalletClient
      user={{
        id: session.user.id,
  email: session.user.email ?? null,
        user_metadata: session.user.user_metadata ?? {},
      }}
      existingPlayer={
        playerRecord
          ? {
              username: playerRecord.username,
              submarine_tier: playerRecord.submarine_tier,
              total_resources_mined: playerRecord.total_resources_mined,
              total_ocx_earned: playerRecord.total_ocx_earned,
            }
          : null
      }
    />
  )
}