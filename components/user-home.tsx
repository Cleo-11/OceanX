"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import type { PlayerPosition, ResourceNode, ResourceType } from "@/lib/types"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { WalletManager } from "@/lib/wallet"
import { getOCXBalanceReadOnly } from "@/lib/contracts"
import { getChainName } from "@/lib/chain-config"
import { Leaderboard } from "./leaderboard"
import { HOLD_COLORS } from "./player-hud"

const DeepSeaScene = dynamic(() => import("./game3d/deep-sea-scene").then((m) => m.DeepSeaScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[var(--abyss)]" />,
})

interface UserHomeProps {
  playerData: {
    id: string
    user_id: string
    wallet_address: string
    username: string
    submarine_tier: number
    total_resources_mined: number
    total_ocx_earned: number
    last_login: string
    nickel?: number
    cobalt?: number
    copper?: number
    manganese?: number
  }
  onPlayClick: () => void
  onSubmarineStoreClick: () => void
}

const HOLD: { type: ResourceType; label: string }[] = [
  { type: "nickel", label: "Nickel" },
  { type: "cobalt", label: "Cobalt" },
  { type: "copper", label: "Copper" },
  { type: "manganese", label: "Manganese" },
]
const fmt = (n: number, digits = 0) => n.toLocaleString("en-US", { maximumFractionDigits: digits })
const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const HOME_FRAMING = { x: -4.5, z: 0.5 }

/** The submarine idles over a few deposits while you are on the surface. */
function useIdleSub() {
  const ref = useRef<PlayerPosition>({ x: 1000, y: 1000, rotation: -0.4 })
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let frame = 0
    const tick = (now: number) => {
      const t = now / 1000
      ref.current = { x: 1000 + Math.sin(t * 0.15) * 6, y: 1000, rotation: -0.4 + Math.sin(t * 0.1) * 0.25 }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return ref
}

export function UserHome({ playerData, onPlayClick, onSubmarineStoreClick }: UserHomeProps) {
  const router = useRouter()
  const sub = getSubmarineByTier(playerData.submarine_tier)
  const idle = useIdleSub()
  const [walletOcx, setWalletOcx] = useState<number | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
  const [isWalletConnected, setIsWalletConnected] = useState<boolean>(!!playerData.wallet_address)
  const [walletChecked, setWalletChecked] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const deposits = useMemo<ResourceNode[]>(
    () =>
      [
        { x: 1075, y: 960, type: "copper" },
        { x: 1120, y: 1060, type: "nickel" },
        { x: 960, y: 1110, type: "cobalt" },
        { x: 1200, y: 990, type: "manganese" },
      ].map((d, i) => ({
        id: `home-${i}`,
        position: { x: d.x, y: d.y },
        type: d.type as ResourceType,
        amount: 10,
        depleted: false,
        size: 20,
      })),
    [],
  )

  // Wallet OCX, read from the chain without asking the wallet to sign
  // anything (this used to prompt for a signature on every visit).
  useEffect(() => {
    if (!playerData.wallet_address) return
    let cancelled = false
    getOCXBalanceReadOnly(playerData.wallet_address)
      .then((b) => !cancelled && setWalletOcx(parseFloat(b) || 0))
      .catch(() => !cancelled && setWalletOcx(null))
    const connection = WalletManager.getInstance().getConnection()
    if (connection) setNetwork(getChainName(connection.chainId))
    return () => {
      cancelled = true
    }
  }, [playerData.wallet_address])

  // Signed out of the wallet elsewhere → back to sign-in.
  useEffect(() => {
    if (walletChecked && !isWalletConnected && typeof window !== "undefined") {
      window.location.href = "/auth"
    }
  }, [isWalletConnected, walletChecked])

  useEffect(() => {
    async function syncAccounts(accounts?: string[]) {
      if (isDisconnecting) return
      try {
        let next = accounts
        if (!next && typeof window !== "undefined" && window.ethereum?.request) {
          next = (await window.ethereum.request({ method: "eth_accounts" })) as string[]
        }
        if (next && next.length > 0) {
          setIsWalletConnected(true)
        } else {
          setIsWalletConnected(false)
          WalletManager.getInstance().disconnect()
          try {
            await fetch("/api/auth/signout", { method: "POST" })
          } catch {
            /* ignore */
          }
        }
      } finally {
        setWalletChecked(true)
      }
    }
    syncAccounts()
    if (typeof window !== "undefined" && window.ethereum) {
      const handler = (accs: string[]) => syncAccounts(accs)
      window.ethereum.on("accountsChanged", handler)
      return () => {
        try {
          window.ethereum?.removeListener("accountsChanged", handler)
        } catch {
          /* ignore */
        }
      }
    }
    return undefined
  }, [isDisconnecting])

  const signOut = async () => {
    setIsDisconnecting(true)
    try {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          await window.ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] })
        } catch (error: any) {
          if (error?.code === 4001) {
            setIsDisconnecting(false)
            return
          }
        }
      }
      try {
        await fetch("/api/auth/signout", { method: "POST", headers: { "Content-Type": "application/json" } })
      } catch (fetchError) {
        console.error("Failed to clear session:", fetchError)
      }
      WalletManager.getInstance().disconnect()
    } finally {
      router.push("/")
    }
  }

  const holdTotal = HOLD.reduce((s, h) => s + (playerData[h.type] ?? 0), 0)

  return (
    <main className="dive">
      <section aria-labelledby="home-title" className="relative h-[68dvh] min-h-[460px] overflow-hidden">
        <DeepSeaScene playerRef={idle} nodes={deposits} targetNodeId={null} hullColor={sub.color} isMining={false} framing={HOME_FRAMING} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(8,36,42,0.9) 0%, rgba(8,36,42,0.42) 42%, rgba(8,36,42,0) 70%), linear-gradient(0deg, rgba(8,36,42,1) 0%, rgba(8,36,42,0) 30%)" }}
        />

        <header className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-10">
          <span className="text-lg font-semibold tracking-tight">AbyssX</span>
          <div className="flex items-center gap-4 text-sm">
            {playerData.wallet_address && (
              <span className="text-[var(--ink-dim)]">
                {shortAddress(playerData.wallet_address)}
                {network && <span className="ml-2">on {network}</span>}
              </span>
            )}
            <button type="button" onClick={signOut} disabled={isDisconnecting} className="dive-btn dive-btn--quiet py-1.5">
              {isDisconnecting ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>

        <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-10 sm:px-10">
          <p className="text-sm text-[var(--ink-dim)]">Welcome back, {playerData.username}</p>
          <h1 id="home-title" className="dive-display mt-2 text-[clamp(2.25rem,5.5vw,4.25rem)]">
            {sub.name}
          </h1>
          <p className="mt-2 text-[var(--ink-dim)]">
            Tier {sub.tier} of 15. Rated to {fmt(sub.baseStats.depth)} m.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={onPlayClick} className="dive-btn px-6 py-3 text-base">
              Dive
            </button>
            <button type="button" onClick={onSubmarineStoreClick} className="dive-btn dive-btn--quiet px-6 py-3 text-base">
              Hangar
            </button>
            <button type="button" onClick={() => router.push("/marketplace")} className="dive-btn dive-btn--quiet px-6 py-3 text-base">
              Marketplace
            </button>
          </div>
        </div>
      </section>

      <div className="grid max-w-6xl gap-x-12 gap-y-12 px-6 py-12 sm:px-10 md:grid-cols-3">
        <section aria-labelledby="hold-title">
          <div className="flex items-baseline justify-between">
            <h2 id="hold-title" className="text-lg font-semibold">Hold</h2>
            <span className="text-sm text-[var(--ink-dim)]">{fmt(holdTotal)} units</span>
          </div>
          <ul className="mt-3">
            {HOLD.map(({ type, label }) => (
              <li key={type} className="dive-row border-t border-[var(--rule)]">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: HOLD_COLORS[type] }} />
                  {label}
                </span>
                <span className="text-[var(--ink)]">
                  {fmt(playerData[type] ?? 0)}
                  <span className="text-[var(--ink-dim)]"> / {fmt(sub.baseStats.maxCapacity[type])}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ocx-title">
          <h2 id="ocx-title" className="text-lg font-semibold">OCX</h2>
          <dl className="mt-3">
            <div className="dive-row border-t border-[var(--rule)]">
              <dt>In your wallet</dt>
              <dd className="text-[var(--ink)]">{walletOcx === null ? "…" : fmt(walletOcx, 2)}</dd>
            </div>
            <div className="dive-row border-t border-[var(--rule)]">
              <dt>Earned, not yet claimed</dt>
              <dd className="text-[var(--ink)]">{fmt(playerData.total_ocx_earned, 2)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-[var(--ink-dim)]">
            Claim earned OCX to your wallet from the menu while diving. Spend it on upgrades in the hangar.
          </p>
        </section>

        <section aria-labelledby="record-title">
          <h2 id="record-title" className="text-lg font-semibold">Record</h2>
          <dl className="mt-3">
            <div className="dive-row border-t border-[var(--rule)]">
              <dt>Mined, all time</dt>
              <dd className="text-[var(--ink)]">{fmt(playerData.total_resources_mined)} units</dd>
            </div>
            <div className="dive-row border-t border-[var(--rule)]">
              <dt>Last dive</dt>
              <dd className="text-[var(--ink)]">
                {new Date(playerData.last_login).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => router.push(`/profile?wallet=${playerData.wallet_address}`)}
            className="dive-link mt-3 text-sm"
          >
            Open your profile
          </button>
        </section>
      </div>

      <section aria-labelledby="leaders-title" className="max-w-6xl border-t border-[var(--rule)] px-6 py-12 sm:px-10">
        <h2 id="leaders-title" className="text-lg font-semibold">Leaderboard</h2>
        <div className="mt-4 max-w-3xl">
          <Leaderboard currentUsername={playerData.username} />
        </div>
      </section>
    </main>
  )
}
