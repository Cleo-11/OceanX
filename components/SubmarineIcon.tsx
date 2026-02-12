import React from "react"
import { SUBMARINE_TIERS } from "@/lib/submarine-tiers"

interface SubmarineIconProps {
  tier: number
  size?: number
  className?: string
}

// Helper to get submarine data
function getTierData(tier: number) {
  return SUBMARINE_TIERS.find((s) => s.tier === tier) || SUBMARINE_TIERS[0]
}

// SVGs for each tier (simplified for brevity, but each should be unique and reflect the tier's theme)
function renderSubmarineSVG(tier: number, color: string, size: number) {
  switch (tier) {
    case 1:
      // Basic capsule with viewport
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.4} ry={size*0.18} fill={color} stroke="#333" strokeWidth={1}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 2:
      // Add a fin
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.4} ry={size*0.18} fill={color} stroke="#333" strokeWidth={1}/>
          <rect x={size*0.45} y={size*0.18} width={size*0.1} height={size*0.18} fill={color} stroke="#333" strokeWidth={0.5} rx={2}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 3:
      // Reinforced hull (double outline)
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.4} ry={size*0.18} fill={color} stroke="#333" strokeWidth={2}/>
          <ellipse cx={size/2} cy={size/2} rx={size*0.36} ry={size*0.15} fill="none" stroke="#fff" strokeWidth={1} opacity={0.3}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 4:
      // Heavy-duty: add cargo box
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.4} ry={size*0.18} fill={color} stroke="#333" strokeWidth={2}/>
          <rect x={size*0.15} y={size*0.6} width={size*0.2} height={size*0.1} fill={color} stroke="#333" strokeWidth={0.5}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 5:
      // Heat-resistant: add red/orange glow
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.4} ry={size*0.18} fill={color} stroke="#333" strokeWidth={2}/>
          <ellipse cx={size/2} cy={size/2} rx={size*0.45} ry={size*0.22} fill="orange" opacity={0.2}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 6:
      // Pressure hull: add extra ring
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.4} ry={size*0.18} fill={color} stroke="#333" strokeWidth={2}/>
          <ellipse cx={size/2} cy={size/2} rx={size*0.32} ry={size*0.13} fill="none" stroke="#0ff" strokeWidth={1} opacity={0.4}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 7:
      // Quantum: add sparkles
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.4} ry={size*0.18} fill={color} stroke="#333" strokeWidth={2}/>
          <circle cx={size*0.3} cy={size*0.3} r={1.5} fill="#0ff" opacity={0.7}/>
          <circle cx={size*0.7} cy={size*0.7} r={1.5} fill="#fff" opacity={0.7}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 8:
      // Titanium: metallic shine
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.4} ry={size*0.18} fill={color} stroke="#333" strokeWidth={2}/>
          <rect x={size*0.2} y={size*0.25} width={size*0.6} height={size*0.05} fill="#fff" opacity={0.2}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 9:
      // Behemoth: extra large, double viewport
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.45} ry={size*0.22} fill={color} stroke="#333" strokeWidth={2}/>
          <ellipse cx={size*0.65} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
          <ellipse cx={size*0.8} cy={size/2} rx={size*0.07} ry={size*0.07} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 10:
      // Fortress: add turrets/armor
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.45} ry={size*0.22} fill={color} stroke="#333" strokeWidth={2}/>
          <rect x={size*0.15} y={size*0.15} width={size*0.1} height={size*0.1} fill="#888" stroke="#333" strokeWidth={0.5}/>
          <rect x={size*0.75} y={size*0.15} width={size*0.1} height={size*0.1} fill="#888" stroke="#333" strokeWidth={0.5}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 11:
      // Kraken's Bane: tentacle motif
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.45} ry={size*0.22} fill={color} stroke="#333" strokeWidth={2}/>
          <path d={`M${size*0.2},${size*0.7} Q${size*0.3},${size*0.9} ${size*0.4},${size*0.7}`} stroke="#7c2d12" strokeWidth={1.5} fill="none"/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 12:
      // Void: black, with purple glow
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.45} ry={size*0.22} fill={color} stroke="#333" strokeWidth={2}/>
          <ellipse cx={size/2} cy={size/2} rx={size*0.5} ry={size*0.25} fill="#a855f7" opacity={0.15}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 13:
      // Stellar: star motif
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.45} ry={size*0.22} fill={color} stroke="#333" strokeWidth={2}/>
          <polygon points={`${size*0.5},${size*0.18} ${size*0.52},${size*0.25} ${size*0.6},${size*0.25} ${size*0.54},${size*0.3} ${size*0.56},${size*0.38} ${size*0.5},${size*0.33} ${size*0.44},${size*0.38} ${size*0.46},${size*0.3} ${size*0.4},${size*0.25} ${size*0.48},${size*0.25}`} fill="#fff59d" opacity={0.7}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 14:
      // Cosmic: alien glow, rings
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.45} ry={size*0.22} fill={color} stroke="#333" strokeWidth={2}/>
          <ellipse cx={size/2} cy={size/2} rx={size*0.55} ry={size*0.28} fill="#a855f7" opacity={0.2}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
    case 15:
      // Leviathan: huge, triple viewport, crown
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.5} ry={size*0.25} fill={color} stroke="#333" strokeWidth={2}/>
          <ellipse cx={size*0.6} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
          <ellipse cx={size*0.75} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
          <ellipse cx={size*0.9} cy={size/2} rx={size*0.07} ry={size*0.07} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
          <polygon points={`${size*0.5},${size*0.1} ${size*0.53},${size*0.18} ${size*0.47},${size*0.18}`} fill="#fff" opacity={0.8}/>
        </g>
      )
    default:
      // Fallback: basic
      return (
        <g>
          <ellipse cx={size/2} cy={size/2} rx={size*0.4} ry={size*0.18} fill={color} stroke="#333" strokeWidth={1}/>
          <ellipse cx={size*0.7} cy={size/2} rx={size*0.09} ry={size*0.09} fill="#7dd3fc" stroke="#222" strokeWidth={0.5}/>
        </g>
      )
  }
}

const SubmarineIcon: React.FC<SubmarineIconProps> = ({ tier, size = 40, className }) => {
  const { color } = getTierData(tier)

  // Glassmorphic rendering with frosted glass overlay
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Glassmorphic blur filter */}
        <filter id={`glassBlur-${tier}`} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.3" />
        </filter>
        {/* Glass highlight gradient */}
        <linearGradient id={`glassHighlight-${tier}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="40%" stopColor="#67e8f9" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <g opacity="0.88">
        {renderSubmarineSVG(tier, color, size)}
      </g>
      {/* Glassmorphic frosted overlay on hull */}
      <ellipse 
        cx={size/2} 
        cy={size*0.42} 
        rx={size*0.35} 
        ry={size*0.08} 
        fill={`url(#glassHighlight-${tier})`} 
        opacity="0.5"
      />
    </svg>
  )
}

export default SubmarineIcon
