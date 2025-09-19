"use client"

import { useRef, useEffect } from 'react'

interface CSSWaterEffectProps {
  className?: string
  intensity?: 'low' | 'medium' | 'high'
}

export function CSSWaterEffect({ 
  className = "", 
  intensity = 'medium'
}: CSSWaterEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const getIntensityClass = () => {
    switch (intensity) {
      case 'low': return 'water-effect-low'
      case 'high': return 'water-effect-high'
      default: return 'water-effect-medium'
    }
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none ${getIntensityClass()} ${className}`}
    >
      {/* Multiple layers for depth */}
      <div className="absolute inset-0 water-layer-1" />
      <div className="absolute inset-0 water-layer-2" />
      <div className="absolute inset-0 water-layer-3" />
      
      {/* Animated caustics overlay */}
      <div className="absolute inset-0 caustics-layer opacity-30 mix-blend-overlay" />
      
      {/* Light rays */}
      <div className="absolute inset-0 light-rays opacity-20" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 floating-particles" />
    </div>
  )
}