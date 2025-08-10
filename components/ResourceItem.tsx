"use client"

interface ResourceItemProps {
  name: string
  icon: string
  amount: number
  capacity: number
  maxCapacity: number
}

export function ResourceItem({ name, icon, amount, capacity, maxCapacity }: ResourceItemProps) {
  const usagePercentage = maxCapacity > 0 ? (capacity / maxCapacity) * 100 : 0
  
  return (
    <div className="rounded-lg bg-slate-800/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{icon}</span>
          <span className="text-slate-300">{name}</span>
        </div>
        <span className="font-mono text-sm text-cyan-400">{amount}</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Capacity: {capacity}/{maxCapacity}</span>
          <span>{Math.round(usagePercentage)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full ${
              usagePercentage > 90 ? "bg-red-500" : usagePercentage > 70 ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
