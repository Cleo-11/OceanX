"use client"

interface ResourceItemProps {
  name: string
  icon: string
  amount: number
  capacity: number
  maxCapacity: number
  onTrade: () => void
  disabled: boolean
}

export function ResourceItem({ name, icon, amount, capacity, maxCapacity, onTrade, disabled }: ResourceItemProps) {
  const percentage = Math.min(100, Math.max(0, (capacity / maxCapacity) * 100))

  return (
    <div className="rounded-lg bg-slate-800/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{icon}</span>
          <span className="text-slate-300">{name}</span>
        </div>
        <span className="font-mono text-lg text-cyan-400">{amount}</span>
      </div>

      <div className="mt-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Storage:</span>
          <span className="font-mono text-xs text-cyan-400">
            {capacity}/{maxCapacity}
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full ${
              percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
