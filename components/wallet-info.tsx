"use client"

import { useState, useEffect } from "react"

interface WalletInfoProps {
  balance: number
}

export function WalletInfo({ balance }: WalletInfoProps) {
  const [prevBalance, setPrevBalance] = useState(balance);
  const [isBalanceChanged, setIsBalanceChanged] = useState(false);
  
  useEffect(() => {
    if (balance !== prevBalance) {
      setIsBalanceChanged(true);
      const timer = setTimeout(() => {
        setIsBalanceChanged(false);
        setPrevBalance(balance);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [balance, prevBalance]);
  
  return (
    <div className={`absolute right-4 top-4 z-20 rounded-lg px-4 py-3 
                   ${isBalanceChanged ? 'bg-slate-800/80 shadow-glow' : 'bg-slate-900/70'} 
                   backdrop-blur-md border border-slate-700/50 transition-all duration-300
                   nft-border overflow-hidden`}>
      {/* Hexagon pattern background */}
      <div className="absolute inset-0 bg-hexagon-pattern opacity-10"></div>
      
      {/* Transaction effect on balance change */}
      {isBalanceChanged && (
        <div className="absolute inset-0 bg-shimmer animate-shimmer"></div>
      )}
      
      <div className="flex items-center relative">
        {/* Blockchain connection indicator */}
        <div className="flex items-center mr-3">
          <div className={`h-3 w-3 rounded-full bg-green-500 ${isBalanceChanged ? 'animate-pulse' : ''}`} />
          <div className="ml-1 h-2 w-2 rounded-full bg-green-500 opacity-50" />
          <div className="ml-1 h-1 w-1 rounded-full bg-green-500 opacity-25" />
        </div>
        
        {/* Blockchain network indicator */}
        <div className="relative">
          <div className="flex items-center">
            <svg className="h-4 w-4 mr-1 text-cyan-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2Z" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className="text-sm font-medium text-slate-200">Wallet Connected</span>
          </div>
        </div>
      </div>
      
      {/* Token balance display */}
      <div className="mt-1 flex items-center justify-between">
        <div className={`font-mono text-lg font-bold ${isBalanceChanged ? 'text-white' : 'text-cyan-400'} transition-colors`}>
          {balance.toLocaleString()} OCE
        </div>
        
        {/* Balance change indicator */}
        {isBalanceChanged && balance > prevBalance && (
          <div className="text-xs font-medium text-green-400 ml-2 animate-float">
            +{(balance - prevBalance).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}
