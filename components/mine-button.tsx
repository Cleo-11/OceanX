"use client"

import { useState, useEffect } from "react"
import type { GameState, ResourceType } from "@/lib/types"
import { getResourceColor, getResourceEmoji } from "@/lib/resource-utils"

interface MineButtonProps {
  onClick: () => void
  disabled: boolean
  gameState: GameState
  resourceType: ResourceType
  resourceAmount: number
}

export function MineButton({ onClick, disabled, gameState, resourceType, resourceAmount }: MineButtonProps) {
  const isMining = gameState === "mining";
  const [particles, setParticles] = useState<Array<{x: number, y: number, size: number, opacity: number, speed: number}>>([]);
  
  // Create mining particle effect
  useEffect(() => {
    if (isMining) {
      const newParticles = Array.from({ length: 8 }, () => ({
        x: 50 + Math.random() * 20 - 10,
        y: 50,
        size: Math.random() * 8 + 4,
        opacity: 1,
        speed: Math.random() * 2 + 1
      }));
      
      setParticles(newParticles);
      
      const interval = setInterval(() => {
        setParticles(prev => 
          prev
            .map(p => ({
              ...p,
              y: p.y - p.speed,
              opacity: p.opacity - 0.02
            }))
            .filter(p => p.opacity > 0)
        );
      }, 50);
      
      return () => clearInterval(interval);
    } else {
      setParticles([]);
    }
  }, [isMining]);
  
  const resourceColorClass = {
    nickel: "from-gray-400 via-slate-300 to-gray-400",
    cobalt: "from-blue-500 via-indigo-400 to-blue-500",
    copper: "from-amber-600 via-orange-400 to-amber-600",
    manganese: "from-purple-500 via-fuchsia-400 to-purple-500"
  }[resourceType] || "from-cyan-500 via-teal-400 to-blue-500";

  return (
    <div className="pointer-events-auto absolute bottom-8 left-1/2 z-30 -translate-x-1/2 transform">
      <div className="relative">
        {/* Blockchain-style mining particles */}
        {particles.map((p, i) => (
          <div 
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${p.x}%`,
              bottom: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              filter: `blur(1px) drop-shadow(0 0 2px ${getResourceColor(resourceType)})`
            }}
          />
        ))}
        
        <button
          onClick={onClick}
          disabled={disabled}
          className={`relative flex items-center gap-2 rounded-full border-2 ${isMining ? 'border-white' : 'border-cyan-400'} 
                    bg-gradient-to-br ${resourceColorClass} px-6 py-3 font-bold text-white text-base 
                    shadow-lg hover:scale-105 active:scale-95 transition-all duration-150 
                    disabled:opacity-60 ${isMining ? "animate-pulse shadow-glow" : ""}`}
          style={{
            boxShadow: isMining 
              ? `0 0 20px 2px ${getResourceColor(resourceType)}80, 0 0 10px 0 rgba(255, 255, 255, 0.8) inset`
              : "0 4px 16px 0 rgba(0, 200, 255, 0.25), 0 1px 3px 0 rgba(0, 0, 0, 0.1) inset",
          }}
        >
          {/* Resource-specific mining icon */}
          <span className={`mr-1 ${isMining ? 'animate-bounce' : ''}`}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="14" y="6" width="4" height="14" rx="2" fill="#fbbf24" stroke="#22223b" strokeWidth="1.5" />
              <path d="M16 6 Q18 2 28 8 Q18 10 16 6" fill="#60a5fa" stroke="#22223b" strokeWidth="1.5" />
              <ellipse cx="16" cy="20" rx="2.2" ry="1.2" fill={getResourceColor(resourceType)} />
            </svg>
          </span>
          <span className="drop-shadow-md tracking-wide">
            {isMining
              ? "MINING..."
              : `MINE ${resourceType.toUpperCase()} (${resourceAmount})`}
          </span>
          {/* Blockchain hexagon decoration */}
          {!isMining && (
            <span className="absolute -right-1 -top-1 h-4 w-4">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2Z" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
              </svg>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
