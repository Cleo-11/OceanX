"use client"

import { useEffect, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import type { PlayerPosition, ResourceNode, ResourceType } from "@/lib/types"
import { SUBMARINE_TIERS } from "@/lib/submarine-tiers"
import { HOLD_COLORS } from "@/components/player-hud"

const DeepSeaScene = dynamic(() => import("@/components/game3d/deep-sea-scene").then((m) => m.DeepSeaScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[var(--abyss)]" />,
})

const MINERALS: { type: ResourceType; name: string; price: number; note: string }[] = [
  { type: "nickel", name: "Nickel", price: 0.1, note: "Grey-green nodules, the most common find." },
  { type: "cobalt", name: "Cobalt", price: 0.5, note: "Blue-black crusts with a metallic sheen." },
  { type: "copper", name: "Copper", price: 1, note: "Rust-red nodules, often patched with green." },
  { type: "manganese", name: "Manganese", price: 2, note: "Near-black lumps. Rare, and worth the most." },
]

const LOOP = [
  {
    depth: "Launch",
    title: "Dive into the dark",
    body: "Your submarine starts on the abyssal plain with a lamp, a battery and an empty hold. Beyond the lamp there is nothing but silt and the occasional glow.",
  },
  {
    depth: "Search",
    title: "Find the deposits",
    body: "Mineral deposits give off faint blue-green light, and your sonar maps everything within 500 metres. Each deposit holds 5 to 15 units.",
  },
  {
    depth: "Drill",
    title: "Mine what fits",
    body: "Pull up close and drill. The game server checks your position and your hold before anything counts, so every unit in your hold is real.",
  },
  {
    depth: "Surface",
    title: "Sell, claim, upgrade",
    body: "Sell the hold for OCX, claim it to your wallet, and spend it on the next submarine: a bigger hold, a longer battery, a faster drill.",
  },
]

// Keep the submarine right of the headline.
const HERO_FRAMING = { x: -5.5, z: 0.5 }

/** A slow autopilot for the hero: the submarine sweeps a wide arc over a field of deposits. */
function useAutopilot() {
  const ref = useRef<PlayerPosition>({ x: 1000, y: 1000, rotation: 0 })
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ref.current = { x: 1060, y: 980, rotation: 0.35 }
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = (now - start) / 1000
      const a = t * 0.045
      ref.current = {
        x: 1000 + Math.cos(a) * 320,
        y: 1000 + Math.sin(a) * 220,
        rotation: Math.atan2(Math.cos(a) * 220, -Math.sin(a) * 320),
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return ref
}

function useDemoDeposits(): ResourceNode[] {
  return useMemo(() => {
    let s = 20240611
    const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
    const types: ResourceType[] = ["nickel", "nickel", "cobalt", "copper", "copper", "manganese"]
    return Array.from({ length: 34 }, (_, i) => {
      const a = rand() * Math.PI * 2
      const r = 120 + rand() * 520
      return {
        id: `demo-${i}`,
        position: { x: 1000 + Math.cos(a) * r, y: 1000 + Math.sin(a) * r * 0.75 },
        type: types[Math.floor(rand() * types.length)],
        amount: 5 + Math.floor(rand() * 11),
        depleted: false,
        size: 15 + rand() * 10,
      }
    })
  }, [])
}

export default function LandingPage() {
  const router = useRouter()
  const pilot = useAutopilot()
  const deposits = useDemoDeposits()
  const fleet = SUBMARINE_TIERS.filter((t) => [1, 3, 5, 8, 11, 15].includes(t.tier))

  const signUp = () => router.push("/auth?mode=signup")
  const signIn = () => router.push("/auth?mode=login")

  return (
    <main className="dive">
      {/* Hero: the actual game scene, running on autopilot */}
      <section aria-labelledby="hero-title" className="relative h-[100dvh] min-h-[560px] overflow-hidden">
        <DeepSeaScene
          playerRef={pilot}
          nodes={deposits}
          targetNodeId={null}
          hullColor="#b45309"
          isMining={false}
          framing={HERO_FRAMING}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(90deg, rgba(8,36,42,0.88) 0%, rgba(8,36,42,0.45) 38%, rgba(8,36,42,0) 70%)" }}
        />

        <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 sm:px-10">
          <span className="text-lg font-semibold tracking-tight">AbyssX</span>
          <nav aria-label="Account" className="flex items-center gap-3">
            <button type="button" onClick={signIn} className="dive-btn dive-btn--quiet">
              Sign in
            </button>
          </nav>
        </header>

        <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-16 sm:px-10 sm:pb-24">
          <h1 id="hero-title" className="dive-display max-w-[11ch] text-[clamp(2.75rem,7vw,5.75rem)]">
            Mine the abyssal plain.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-[var(--ink-dim)]">
            Pilot a submarine through the dark, drill mineral deposits off the seabed, and turn them into OCX you can
            claim to your own wallet.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={signUp} className="dive-btn px-6 py-3 text-base">
              Start diving
            </button>
            <button type="button" onClick={signIn} className="dive-btn dive-btn--quiet px-6 py-3 text-base">
              I already have an account
            </button>
          </div>
        </div>
      </section>

      {/* The loop, read like a dive log */}
      <section aria-labelledby="loop-title" className="mx-auto max-w-5xl px-6 py-24 sm:px-10">
        <h2 id="loop-title" className="text-3xl font-semibold sm:text-4xl">
          One dive, start to finish
        </h2>
        <ol className="mt-12 border-l border-[var(--rule)]">
          {LOOP.map((step, i) => (
            <li key={step.title} className="relative grid gap-2 pb-12 pl-8 last:pb-0 sm:grid-cols-[9rem_1fr] sm:gap-8">
              <span aria-hidden className="absolute -left-[5px] top-2 h-[9px] w-[9px] rounded-full bg-[var(--bio)]" />
              <p className="pt-0.5 text-sm text-[var(--ink-dim)]">
                {i + 1}. {step.depth}
              </p>
              <div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-[60ch] leading-relaxed text-[var(--ink-dim)]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* The four minerals, with what they sell for */}
      <section aria-labelledby="minerals-title" className="border-t border-[var(--rule)] bg-[var(--abyss-2)]">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:px-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="minerals-title" className="text-3xl font-semibold sm:text-4xl">
              Four minerals on the seabed
            </h2>
            <p className="text-sm text-[var(--ink-dim)]">Sale price per unit, in OCX</p>
          </div>
          <ul className="mt-10 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
            {MINERALS.map((m) => (
              <li key={m.type} className="grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-4 py-5 sm:grid-cols-[1.25rem_12rem_1fr_auto]">
                <span aria-hidden className="h-3 w-3 translate-y-0.5 rounded-full" style={{ background: HOLD_COLORS[m.type] }} />
                <span className="text-lg font-semibold">{m.name}</span>
                <span className="hidden text-[var(--ink-dim)] sm:block">{m.note}</span>
                <span className="text-lg">{m.price}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The fleet */}
      <section aria-labelledby="fleet-title" className="mx-auto max-w-5xl px-6 py-24 sm:px-10">
        <h2 id="fleet-title" className="text-3xl font-semibold sm:text-4xl">
          Fifteen submarines, one tier at a time
        </h2>
        <p className="mt-4 max-w-[60ch] leading-relaxed text-[var(--ink-dim)]">
          Every upgrade is a transaction on the UpgradeManager contract, paid in OCX from your wallet. A selection:
        </p>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left">
            <thead>
              <tr className="text-sm text-[var(--ink-dim)]">
                <th scope="col" className="pb-3 font-normal">Tier</th>
                <th scope="col" className="pb-3 font-normal">Submarine</th>
                <th scope="col" className="pb-3 text-right font-normal">Hold</th>
                <th scope="col" className="pb-3 text-right font-normal">Battery</th>
                <th scope="col" className="pb-3 text-right font-normal">Rated depth</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((t) => {
                const hold = Object.values(t.baseStats.maxCapacity).reduce((a, b) => a + b, 0)
                return (
                  <tr key={t.tier} className="border-t border-[var(--rule)]">
                    <td className="py-3 text-[var(--ink-dim)]">{t.tier}</td>
                    <td className="py-3 font-semibold">{t.name}</td>
                    <td className="py-3 text-right">{hold.toLocaleString("en-US")}</td>
                    <td className="py-3 text-right">{t.baseStats.energy.toLocaleString("en-US")}</td>
                    <td className="py-3 text-right">{t.baseStats.depth.toLocaleString("en-US")} m</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-[var(--rule)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-6 px-6 py-16 sm:px-10">
          <h2 className="text-2xl font-semibold">Your first submarine is free.</h2>
          <button type="button" onClick={signUp} className="dive-btn px-6 py-3 text-base">
            Start diving
          </button>
        </div>
      </section>

      <footer className="border-t border-[var(--rule)]">
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm leading-relaxed text-[var(--ink-dim)] sm:px-10">
          AbyssX runs on the Ethereum Sepolia test network. OCX is a test token with no monetary value.
        </div>
      </footer>
    </main>
  )
}
