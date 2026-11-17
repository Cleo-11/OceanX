interface EnergyDepletedAlertProps {
  energy: number
}

export function EnergyDepletedAlert({ energy }: EnergyDepletedAlertProps) {
  return (
    <div role="status" className="dive-hud dive-panel dive-panel--warn pointer-events-none absolute left-1/2 top-[30%] w-[min(90vw,24rem)] -translate-x-1/2 px-4 py-3">
      <p className="text-sm font-semibold text-[var(--ink)]">Battery empty ({energy})</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
        The thrusters are off until the battery recharges. It refills on its own; a higher-tier submarine
        carries a bigger battery.
      </p>
    </div>
  )
}
