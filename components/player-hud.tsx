import type { PlayerStats, PlayerResources, ResourceType } from "@/lib/types"
import { getSubmarineByTier } from "@/lib/submarine-tiers"

interface PlayerHUDProps {
  stats: PlayerStats
  tier: number
  resources?: PlayerResources // Live resources for instant UI updates
}

/** Hold colours: the same muted mineral tones the deposits use in the 3D scene. */
export const HOLD_COLORS: Record<ResourceType, string> = {
  nickel: "#9aa595",
  cobalt: "#7189b8",
  copper: "#c27c4f",
  manganese: "#8c7b6b",
}

const HOLD_ORDER: { type: ResourceType; label: string }[] = [
  { type: "nickel", label: "Nickel" },
  { type: "cobalt", label: "Cobalt" },
  { type: "copper", label: "Copper" },
  { type: "manganese", label: "Manganese" },
]

const fmt = (n: number) => Math.round(n).toLocaleString("en-US")

/**
 * The dive plate: a quiet instrument panel. The scene is the spectacle; this
 * stays legible and still.
 */
export function PlayerHUD({ stats, tier, resources }: PlayerHUDProps) {
  const sub = getSubmarineByTier(tier)
  const maxEnergy = sub.baseStats.energy
  const energyLow = stats.energy <= maxEnergy * 0.15

  return (
    <section
      aria-label="Submarine status"
      className="dive-hud dive-panel absolute left-4 top-4 z-20 w-[17rem] px-4 pb-3 pt-3.5"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[0.95rem] font-semibold text-[var(--ink)]">{sub.name}</h2>
        <span className="text-xs text-[var(--ink-dim)]">Tier {tier}</span>
      </header>
      <p className="mt-0.5 text-xs text-[var(--ink-dim)]">Rated to {fmt(stats.depth)} m</p>

      <Gauge
        className="mt-4"
        label="Battery"
        value={stats.energy}
        max={maxEnergy}
        color={energyLow ? "var(--danger)" : "var(--lamp)"}
      />

      <h3 className="mt-4 text-xs font-medium text-[var(--ink-dim)]">Hold</h3>
      <div className="mt-1.5 space-y-2">
        {HOLD_ORDER.map(({ type, label }) => (
          <Gauge
            key={type}
            label={label}
            value={resources?.[type] ?? 0}
            max={stats.maxCapacity[type]}
            color={HOLD_COLORS[type]}
            compact
          />
        ))}
      </div>

      <dl className="mt-4 flex gap-5 border-t border-[var(--rule)] pt-2.5 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-[var(--ink-dim)]">Speed</dt>
          <dd className="text-[var(--ink)]">{stats.speed.toFixed(1)}×</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-[var(--ink-dim)]">Drill</dt>
          <dd className="text-[var(--ink)]">{stats.miningRate.toFixed(1)}×</dd>
        </div>
      </dl>
    </section>
  )
}

interface GaugeProps {
  label: string
  value: number
  max: number
  color: string
  compact?: boolean
  className?: string
}

/** A thin track with tick marks every tenth, like a printed instrument scale. */
function Gauge({ label, value, max, color, compact = false, className = "" }: GaugeProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <span className={compact ? "text-xs text-[var(--ink)]" : "text-sm text-[var(--ink)]"}>{label}</span>
        <span className="text-xs text-[var(--ink-dim)]">
          <span className="text-[var(--ink)]">{fmt(value)}</span> / {fmt(max)}
        </span>
      </div>
      <div
        className="dive-track mt-1"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className="dive-track-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
