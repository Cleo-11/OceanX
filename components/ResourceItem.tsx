"use client"

interface ResourceItemProps {
  name: string
  icon: string
  amount: number
  onTrade: () => void
  disabled: boolean
}

export function ResourceItem({ name, icon, amount, onTrade, disabled }: ResourceItemProps) {
  return (
    <div className="rounded-lg bg-slate-800/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{icon}</span>
          <span className="text-slate-300">{name}</span>
        </div>
        <span className="font-mono text-lg text-cyan-400">{amount}</span>
      </div>
      <button
        onClick={onTrade}
        disabled={disabled}
        className="mt-2 w-full rounded-md bg-gradient-to-r from-teal-600 to-cyan-700 py-1 text-sm font-medium text-white shadow-md shadow-cyan-900/30 transition-all hover:shadow-cyan-900/50 disabled:opacity-50"
      >
        Trade
      </button>
    </div>
  )
}
