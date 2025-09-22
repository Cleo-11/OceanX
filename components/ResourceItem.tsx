"use client"

import { useState, useEffect } from "react"

interface ResourceItemProps {
  name: string
  icon: string
  amount: number
  capacity: number
  maxCapacity: number
}

export function ResourceItem({ name, icon, amount, capacity, maxCapacity }: ResourceItemProps) {
  const usagePercentage = maxCapacity > 0 ? (capacity / maxCapacity) * 100 : 0
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevAmount, setPrevAmount] = useState(amount);
  
  // Add animation when amount changes
  useEffect(() => {
    if (amount > prevAmount) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1500);
      return () => clearTimeout(timer);
    }
    setPrevAmount(amount);
  }, [amount, prevAmount]);
  
  // Color mapping for different resource types
  const resourceColors: Record<string, string> = {
    'Nickel': 'from-gray-400 to-slate-300',
    'Cobalt': 'from-blue-500 to-indigo-400',
    'Copper': 'from-amber-600 to-orange-400',
    'Manganese': 'from-purple-500 to-fuchsia-400'
  };
  
  const colorClass = resourceColors[name] || 'from-cyan-500 to-blue-400';
  
  return (
    <div className={`rounded-lg p-3.5 relative overflow-hidden nft-border 
                    ${isAnimating ? 'shadow-glow animate-shimmer' : 'bg-slate-800/50'}`}>
      {/* Blockchain transaction effect on resource change */}
      {isAnimating && (
        <div className="absolute inset-0 bg-shimmer animate-shimmer"></div>
      )}
      
      <div className="flex items-center justify-between mb-2 relative">
        <div className="flex items-center space-x-2">
          <span className={`flex items-center justify-center text-xl h-8 w-8 rounded-md 
                          bg-gradient-to-br ${colorClass} shadow-inner-glow`}>
            {icon}
          </span>
          <span className="text-slate-200 font-medium">{name}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`font-mono text-sm font-bold ${isAnimating ? 'text-white animate-float' : 'text-cyan-400'}`}>
            {amount}
          </span>
          {isAnimating && amount > prevAmount && (
            <span className="text-xs text-green-400 font-medium animate-float">
              +{amount - prevAmount}
            </span>
          )}
        </div>
      </div>
      
      <div className="space-y-1 relative">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Capacity: {capacity}/{maxCapacity}</span>
          <span className="font-medium">{Math.round(usagePercentage)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-700/70 p-0.5 backdrop-blur-sm">
          <div
            className={`h-full rounded-full ${
              usagePercentage > 90 ? "bg-gradient-to-r from-red-600 to-red-400" : 
              usagePercentage > 70 ? "bg-gradient-to-r from-yellow-600 to-yellow-400" : 
              "bg-gradient-to-r from-green-600 to-green-400"
            } ${isAnimating ? 'animate-pulse' : ''}`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
        
        {/* Hexagon decoration */}
        <svg className="absolute -bottom-3 -right-3 w-12 h-12 opacity-10" viewBox="0 0 24 24">
          <path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  )
}
