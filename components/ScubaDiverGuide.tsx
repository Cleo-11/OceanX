"use client"

import { useEffect, useRef, useState } from "react"

/** First-dive briefing: what the controls are and how the loop works. */
const steps: { title: string; body: string; keys?: string[] }[] = [
  {
    title: "Steer with the lamp",
    body: "W and S drive forward and back, A and D turn. Arrow keys work too. Press V to switch between the overhead, chase and cockpit views.",
    keys: ["W", "A", "S", "D", "V"],
  },
  {
    title: "Follow the glow",
    body: "Deposits give off faint blue-green light, and the sonar in the corner maps them. Get close until a ring appears around one.",
  },
  {
    title: "Drill",
    body: "Press F to mine the deposit in reach. What you mine goes into your hold, and the hold has a limit for each resource.",
    keys: ["F"],
  },
  {
    title: "Sell, claim, upgrade",
    body: "Open the menu (I) to sell your hold for OCX and claim it to your wallet. Press U to upgrade to a sub with a bigger hold and battery.",
    keys: ["I", "U"],
  },
]

export function ScubaDiverGuide({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0)
  const last = step === steps.length - 1
  const panelRef = useRef<HTMLDivElement>(null)
  const current = steps[step]

  useEffect(() => {
    panelRef.current?.focus()
  }, [step])

  return (
    <div className="dive-hud fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(4,18,21,0.5)] p-4 sm:items-center">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="briefing-title"
        className="dive-panel w-full max-w-md bg-[var(--panel-solid)] p-6 outline-none"
      >
        <p className="text-xs text-[var(--ink-dim)]">
          Dive briefing, {step + 1} of {steps.length}
        </p>
        <h2 id="briefing-title" className="mt-1 text-xl font-semibold">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-dim)]">{current.body}</p>
        {current.keys && (
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {current.keys.map((k) => (
              <kbd key={k} className="min-w-[2rem] rounded border border-[var(--rule)] px-2 py-1 text-center text-sm">
                {k}
              </kbd>
            ))}
          </div>
        )}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={`h-1 w-5 ${i <= step ? "bg-[var(--bio)]" : "bg-[var(--rule)]"}`} />
            ))}
          </div>
          <div className="flex gap-3">
            {!last && (
              <button type="button" onClick={onFinish} className="dive-btn dive-btn--quiet">
                Skip
              </button>
            )}
            <button type="button" onClick={() => (last ? onFinish() : setStep(step + 1))} className="dive-btn">
              {last ? "Start diving" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
