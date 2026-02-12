import React from "react"
import { SUBMARINE_TIERS } from "@/lib/submarine-tiers"

interface SubmarineIconProps {
  tier: number
  size?: number
  className?: string
}

function getTierData(tier: number) {
  return SUBMARINE_TIERS.find((s) => s.tier === tier) || SUBMARINE_TIERS[0]
}

/**
 * Renders a detailed submarine SVG scaled to the icon viewBox (0 0 100 60).
 * Each tier has a distinct, recognizable silhouette with proper shading.
 */
function renderSubmarineSVG(tier: number, color: string) {
  // Shared: hull highlight stripe
  const highlight = (
    <path d="M22 24 Q50 18 82 24" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  )
  // Shared: conning tower
  const tower = (y = 14, w = 10, h = 12) => (
    <rect x={48 - w / 2} y={y} width={w} height={h} rx={2} fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
  )
  // Shared: viewport window
  const viewport = (cx = 68, cy = 30, r = 4.5) => (
    <>
      <circle cx={cx} cy={cy} r={r} fill="url(#vp)" stroke="rgba(0,40,60,0.6)" strokeWidth="0.8" />
      <circle cx={cx - 1} cy={cy - 1} r={r * 0.45} fill="rgba(255,255,255,0.35)" />
    </>
  )
  // Shared: propeller
  const propeller = (x = 10) => (
    <g transform={`translate(${x}, 30)`}>
      <ellipse rx="2" ry="7" fill="rgba(80,80,100,0.7)" />
      <circle r="2" fill="rgba(60,60,80,0.8)" />
    </g>
  )

  switch (tier) {
    case 1:
      // Nautilus I — basic rounded hull, single viewport
      return (
        <g>
          <path d="M14 30 Q14 18 30 16 L72 16 Q88 18 88 30 Q88 42 72 44 L30 44 Q14 42 14 30Z"
            fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
          {highlight}
          {tower()}
          {viewport()}
          {propeller()}
        </g>
      )
    case 2:
      // Nautilus II — dorsal fin, slightly sleeker
      return (
        <g>
          <path d="M12 30 Q12 17 32 15 L74 15 Q90 17 90 30 Q90 43 74 45 L32 45 Q12 43 12 30Z"
            fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
          {/* Dorsal fin */}
          <path d="M52 15 L56 6 L60 15" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.7" />
          {highlight}
          {tower(8, 12, 10)}
          {viewport()}
          {propeller()}
          {/* Tail fin */}
          <path d="M12 22 L6 16 L6 44 L12 38" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
        </g>
      )
    case 3:
      // Abyssal Explorer — reinforced hull bands, heavier build
      return (
        <g>
          <path d="M12 30 Q12 16 34 14 L70 14 Q90 16 90 30 Q90 44 70 46 L34 46 Q12 44 12 30Z"
            fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1.2" />
          {/* Hull reinforcement bands */}
          <line x1="35" y1="14" x2="35" y2="46" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <line x1="55" y1="14" x2="55" y2="46" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          {highlight}
          {tower(10, 12, 10)}
          {viewport()}
          {propeller()}
          {/* Bottom keel */}
          <path d="M30 46 L70 46 L65 50 L35 50Z" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" opacity={0.7} />
        </g>
      )
    case 4:
      // Heavy Hauler — wider hull, cargo pod underneath
      return (
        <g>
          <path d="M12 28 Q12 14 34 12 L72 12 Q92 14 92 28 Q92 42 72 44 L34 44 Q12 42 12 28Z"
            fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1.2" />
          {/* Cargo pod */}
          <rect x={32} y={44} width={36} height={8} rx={3} fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" opacity={0.85} />
          <line x1="44" y1="44" x2="44" y2="52" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
          <line x1="56" y1="44" x2="56" y2="52" stroke="rgba(0,0,0,0.15)" strokeWidth="0.6" />
          {highlight}
          {tower(6, 14, 10)}
          {viewport(72, 28)}
          {viewport(62, 28, 3)}
          {propeller()}
        </g>
      )
    case 5:
      // Thermal Diver — heat-resistant plating, orange heat glow
      return (
        <g>
          {/* Heat glow aura */}
          <ellipse cx={50} cy={30} rx={44} ry={22} fill="url(#heatGlow)" opacity={0.4} />
          <path d="M14 30 Q14 16 34 14 L72 14 Q88 16 88 30 Q88 44 72 46 L34 46 Q14 44 14 30Z"
            fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1.2" />
          {/* Heat plates */}
          <path d="M30 16 L30 44" stroke="rgba(255,100,0,0.25)" strokeWidth="2" />
          <path d="M50 15 L50 45" stroke="rgba(255,100,0,0.25)" strokeWidth="2" />
          <path d="M70 16 L70 44" stroke="rgba(255,100,0,0.25)" strokeWidth="2" />
          {highlight}
          {tower(8, 12, 10)}
          {viewport()}
          {propeller()}
        </g>
      )
    case 6:
      // Pressure Crusher — thick hull, extra depth rings
      return (
        <g>
          <path d="M10 30 Q10 14 34 12 L72 12 Q92 14 92 30 Q92 46 72 48 L34 48 Q10 46 10 30Z"
            fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />
          {/* Pressure rings */}
          <ellipse cx={32} cy={30} rx={4} ry={15} fill="none" stroke="rgba(0,255,255,0.2)" strokeWidth="1.2" />
          <ellipse cx={50} cy={30} rx={4} ry={16} fill="none" stroke="rgba(0,255,255,0.2)" strokeWidth="1.2" />
          <ellipse cx={68} cy={30} rx={4} ry={15} fill="none" stroke="rgba(0,255,255,0.2)" strokeWidth="1.2" />
          {highlight}
          {tower(6, 14, 10)}
          {viewport(76, 30)}
          {propeller(8)}
        </g>
      )
    case 7:
      // Quantum — sleek, angular, energy particles
      return (
        <g>
          {/* Energy field */}
          <ellipse cx={50} cy={30} rx={46} ry={24} fill="url(#energyField)" opacity={0.3} />
          <path d="M12 30 Q12 15 38 12 L68 12 Q88 12 92 26 L92 30 Q92 45 68 48 L38 48 Q12 45 12 30Z"
            fill={color} stroke="rgba(0,255,255,0.3)" strokeWidth="1" />
          {/* Angular hull lines */}
          <path d="M38 12 L34 30 L38 48" stroke="rgba(0,255,255,0.25)" strokeWidth="0.8" fill="none" />
          <path d="M68 12 L72 30 L68 48" stroke="rgba(0,255,255,0.25)" strokeWidth="0.8" fill="none" />
          {highlight}
          {/* Sleek tower */}
          <path d="M44 12 L48 4 L56 4 L60 12" fill={color} stroke="rgba(0,255,255,0.3)" strokeWidth="0.7" />
          {viewport(78, 28, 4)}
          {propeller(8)}
          {/* Quantum particles */}
          <circle cx={30} cy={22} r={1.2} fill="#67e8f9" opacity={0.8}><animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" /></circle>
          <circle cx={70} cy={38} r={1} fill="#67e8f9" opacity={0.6}><animate attributeName="opacity" values="0.3;0.9;0.3" dur="2s" repeatCount="indefinite" /></circle>
        </g>
      )
    case 8:
      // Titanium — heavy angular armor plating, metallic sheen
      return (
        <g>
          <path d="M10 30 Q10 12 36 10 L70 10 Q92 10 94 26 L94 34 Q92 50 70 50 L36 50 Q10 48 10 30Z"
            fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
          {/* Armor plates */}
          <rect x={25} y={12} width={22} height={36} rx={1} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <rect x={50} y={11} width={22} height={38} rx={1} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          {/* Metallic sheen */}
          <path d="M20 20 Q50 14 85 20" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M20 22 Q50 16 85 22" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          {tower(4, 16, 10)}
          {viewport(80, 28, 5)}
          {viewport(70, 28, 3.5)}
          {propeller(6)}
        </g>
      )
    case 9:
      // Behemoth — massive, dual viewports, thick silhouette
      return (
        <g>
          <path d="M6 30 Q6 10 34 8 L72 8 Q96 10 96 30 Q96 50 72 52 L34 52 Q6 50 6 30Z"
            fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="1.8" />
          {/* Internal frame lines */}
          <line x1="30" y1="10" x2="30" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1="50" y1="9" x2="50" y2="51" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1="70" y1="10" x2="70" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          {highlight}
          {tower(2, 18, 10)}
          {viewport(80, 26, 5.5)}
          {viewport(80, 38, 4)}
          {propeller(4)}
          {/* Belly keel */}
          <path d="M30 52 L70 52 L65 56 L35 56Z" fill={color} opacity={0.6} />
        </g>
      )
    case 10:
      // Fortress — armored turrets, battle-ready
      return (
        <g>
          <path d="M8 30 Q8 10 34 8 L72 8 Q94 10 94 30 Q94 50 72 52 L34 52 Q8 50 8 30Z"
            fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="1.8" />
          {/* Turret mounts */}
          <rect x={24} y={4} width={8} height={8} rx={1.5} fill="rgba(100,100,120,0.8)" stroke="rgba(0,0,0,0.3)" strokeWidth="0.7" />
          <rect x={24} y={2} width={8} height={3} rx={1} fill="rgba(80,80,100,0.7)" />
          <rect x={64} y={4} width={8} height={8} rx={1.5} fill="rgba(100,100,120,0.8)" stroke="rgba(0,0,0,0.3)" strokeWidth="0.7" />
          <rect x={64} y={2} width={8} height={3} rx={1} fill="rgba(80,80,100,0.7)" />
          {/* Armor plating pattern */}
          <path d="M20 18 Q50 12 84 18" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" fill="none" />
          {tower(0, 16, 8)}
          {viewport(82, 26, 5)}
          {propeller(4)}
        </g>
      )
    case 11:
      // Kraken's Bane — organic/bio-mechanical, tentacle-like fins
      return (
        <g>
          <path d="M14 30 Q14 14 36 12 L70 12 Q90 14 90 30 Q90 46 70 48 L36 48 Q14 46 14 30Z"
            fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1.2" />
          {/* Bio-mechanical tentacle fins */}
          <path d="M30 48 Q26 54 22 56 Q20 58 24 56 Q28 54 32 50" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M50 48 Q48 56 44 58 Q42 60 46 58 Q50 54 52 50" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M68 48 Q66 54 62 56 Q60 58 64 56 Q68 52 70 48" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {/* Organic ridge */}
          <path d="M36 12 Q40 8 50 7 Q60 8 64 12" fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.7" />
          {highlight}
          {viewport(76, 30, 5)}
          {propeller(10)}
        </g>
      )
    case 12:
      // Void Walker — dark, purple energy aura
      return (
        <g>
          {/* Void aura */}
          <ellipse cx={50} cy={30} rx={48} ry={26} fill="url(#voidAura)" opacity={0.5} />
          <path d="M12 30 Q12 13 36 10 L70 10 Q90 13 90 30 Q90 47 70 50 L36 50 Q12 47 12 30Z"
            fill={color} stroke="rgba(168,85,247,0.4)" strokeWidth="1.2" />
          {/* Internal void glow */}
          <ellipse cx={50} cy={30} rx={30} ry={14} fill="rgba(168,85,247,0.08)" />
          <path d="M24 22 Q50 16 80 22" stroke="rgba(168,85,247,0.3)" strokeWidth="1" fill="none" />
          {/* Angular tower */}
          <path d="M42 10 L46 2 L58 2 L62 10" fill={color} stroke="rgba(168,85,247,0.3)" strokeWidth="0.7" />
          {viewport(78, 28, 5)}
          {propeller(8)}
        </g>
      )
    case 13:
      // Stellar — gold/white accents, star motif
      return (
        <g>
          {/* Star glow */}
          <ellipse cx={50} cy={30} rx={46} ry={24} fill="url(#starGlow)" opacity={0.3} />
          <path d="M12 30 Q12 14 36 12 L70 12 Q90 14 90 30 Q90 46 70 48 L36 48 Q12 46 12 30Z"
            fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1.2" />
          {/* Star emblem on tower */}
          <polygon points="50,4 52,10 58,10 53,14 55,20 50,16 45,20 47,14 42,10 48,10" fill="#fef08a" opacity={0.8} />
          {highlight}
          {viewport(76, 28, 5)}
          {propeller(8)}
        </g>
      )
    case 14:
      // Cosmic — alien rings, ethereal glow
      return (
        <g>
          {/* Cosmic ring */}
          <ellipse cx={50} cy={30} rx={48} ry={10} fill="none" stroke="rgba(168,85,247,0.3)" strokeWidth="1" transform="rotate(-12 50 30)" />
          <ellipse cx={50} cy={30} rx={44} ry={8} fill="none" stroke="rgba(168,85,247,0.2)" strokeWidth="0.7" transform="rotate(8 50 30)" />
          <path d="M10 30 Q10 12 36 10 L70 10 Q92 12 92 30 Q92 48 70 50 L36 50 Q10 48 10 30Z"
            fill={color} stroke="rgba(168,85,247,0.4)" strokeWidth="1.2" />
          {highlight}
          {/* Alien tower */}
          <path d="M42 10 L44 0 L56 0 L58 10" fill={color} stroke="rgba(168,85,247,0.35)" strokeWidth="0.7" />  
          {viewport(80, 28, 5.5)}
          {propeller(6)}
        </g>
      )
    case 15:
      // Leviathan — massive, crowned, triple viewport
      return (
        <g>
          {/* Leviathan aura */}
          <ellipse cx={50} cy={30} rx={50} ry={28} fill="url(#leviathanAura)" opacity={0.3} />
          <path d="M4 30 Q4 8 32 6 L74 6 Q98 8 98 30 Q98 52 74 54 L32 54 Q4 52 4 30Z"
            fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
          {/* Crown spires */}
          <polygon points="40,6 42,0 44,6" fill="rgba(255,255,255,0.7)" />
          <polygon points="48,6 50,-2 52,6" fill="rgba(255,255,255,0.85)" />
          <polygon points="56,6 58,0 60,6" fill="rgba(255,255,255,0.7)" />
          {/* Triple viewport */}
          {viewport(70, 24, 5)}
          {viewport(82, 24, 5)}
          {viewport(76, 36, 4)}
          {/* Massive highlight */}
          <path d="M18 18 Q50 10 88 18" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {propeller(2)}
          {/* Belly */}
          <path d="M28 54 L72 54 L66 58 L34 58Z" fill={color} opacity={0.5} />
        </g>
      )
    default:
      return (
        <g>
          <path d="M14 30 Q14 18 30 16 L72 16 Q88 18 88 30 Q88 42 72 44 L30 44 Q14 42 14 30Z"
            fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
          {highlight}
          {viewport()}
          {propeller()}
        </g>
      )
  }
}

const SubmarineIcon: React.FC<SubmarineIconProps> = ({ tier, size = 40, className }) => {
  const { color } = getTierData(tier)

  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 100 60"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Viewport glass gradient */}
        <radialGradient id="vp" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#0e7490" stopOpacity="0.4" />
        </radialGradient>
        {/* Heat glow for tier 5 */}
        <radialGradient id="heatGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        {/* Energy field for tier 7 */}
        <radialGradient id="energyField" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        {/* Void aura for tier 12 */}
        <radialGradient id="voidAura" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        {/* Star glow for tier 13 */}
        <radialGradient id="starGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
        </radialGradient>
        {/* Leviathan aura for tier 15 */}
        <radialGradient id="leviathanAura" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#7e22ce" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#7e22ce" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#7e22ce" stopOpacity="0" />
        </radialGradient>
      </defs>
      {renderSubmarineSVG(tier, color)}
    </svg>
  )
}

export default SubmarineIcon
