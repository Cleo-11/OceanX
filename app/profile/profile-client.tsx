"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { WalletManager } from "@/lib/wallet"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { ProfileData } from "./page"

const DryDockScene = dynamic(() => import("@/components/game3d/dry-dock-scene").then((m) => m.DryDockScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[var(--abyss)]" />,
})

interface ProfileClientProps {
  profileData: ProfileData
  walletAddress: string
}

const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits })
const formatDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Unknown"

/** A diver's record: who they are, their submarine, what they have mined. */
export function ProfileClient({ profileData, walletAddress }: ProfileClientProps) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { playerInfo, tokenInfo, submarineInfo, resourceStats } = profileData
  const sub = getSubmarineByTier(submarineInfo.currentTier)
  const wallet = playerInfo.walletAddress || walletAddress

  // Signing out ends the session; the account and its progress stay with the
  // wallet. (This used to clear the wallet address from the player record.)
  const signOut = async () => {
    setIsSigningOut(true)
    try {
      await fetch("/api/auth/signout", { method: "POST" })
    } catch (error) {
      console.error("[Profile] Sign out failed:", error)
    }
    WalletManager.getInstance().disconnect()
    router.push("/")
  }

  return (
    <main className="dive">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--rule)] px-6 py-4 sm:px-10">
        <div className="flex items-baseline gap-6">
          <button type="button" onClick={() => router.push("/home")} className="text-lg font-semibold tracking-tight">
            AbyssX
          </button>
          <span className="text-lg text-[var(--ink-dim)]">Profile</span>
        </div>
        <button type="button" onClick={signOut} disabled={isSigningOut} className="dive-btn dive-btn--quiet py-1.5">
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="diver-title">
          <h1 id="diver-title" className="dive-display text-[clamp(2.5rem,5vw,4rem)]">
            {playerInfo.username || "Unnamed diver"}
          </h1>
          <p className="mt-3 text-[var(--ink-dim)]">Diving since {formatDate(playerInfo.joinDate)}</p>
          {wallet && (
            <p className="mt-1 break-all text-sm text-[var(--ink-dim)]">
              Wallet <span className="text-[var(--ink)]">{wallet}</span>
            </p>
          )}

          <dl className="mt-10">
            <div className="dive-row border-t border-[var(--rule)] py-3 text-base">
              <dt>Resources mined, all time</dt>
              <dd>{fmt(resourceStats.totalResourcesMined)}</dd>
            </div>
            <div className="dive-row border-t border-[var(--rule)] py-3 text-base">
              <dt>OCX earned, not yet claimed</dt>
              <dd>{fmt(tokenInfo.totalEarned, 2)}</dd>
            </div>
            <div className="dive-row border-y border-[var(--rule)] py-3 text-base">
              <dt>Next upgrade</dt>
              <dd>
                {submarineInfo.nextUpgradeCost ? `${fmt(submarineInfo.nextUpgradeCost)} OCX` : "None, fully upgraded"}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => router.push("/game")} className="dive-btn">
              Dive
            </button>
            <button type="button" onClick={() => router.push("/submarine-hangar")} className="dive-btn dive-btn--quiet">
              Hangar
            </button>
          </div>
        </section>

        <section aria-labelledby="sub-title" className="dive-panel relative min-h-[380px] overflow-hidden">
          <DryDockScene hullColor={sub.color} tier={sub.tier} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
            <p className="text-sm text-[var(--ink-dim)]">Tier {submarineInfo.currentTier}</p>
            <h2 id="sub-title" className="text-2xl font-semibold">
              {submarineInfo.submarineName || sub.name}
            </h2>
          </div>
        </section>
      </div>
    </main>
  )
}
