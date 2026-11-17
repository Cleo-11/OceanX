interface StorageFullAlertProps {
  percentage: number
}

export function StorageFullAlert({ percentage }: StorageFullAlertProps) {
  const full = percentage >= 100
  return (
    <div role="status" className="dive-hud dive-panel dive-panel--warn pointer-events-none absolute left-1/2 top-[30%] w-[min(90vw,24rem)] -translate-x-1/2 px-4 py-3">
      <p className="text-sm font-semibold text-[var(--ink)]">{full ? "Hold is full" : `Hold is ${percentage}% full`}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-dim)]">
        {full
          ? "Sell resources from the menu, or upgrade your submarine for a bigger hold."
          : "Sell resources soon, or this resource will stop fitting in the hold."}
      </p>
    </div>
  )
}
