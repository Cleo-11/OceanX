import React from 'react';

interface CustomSubmarineProps {
  size?: number;
  className?: string;
}

export const CustomSubmarine: React.FC<CustomSubmarineProps> = ({ 
  size = 320, 
  className = "" 
}) => {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size * 0.6 }}>
      <svg
        viewBox="0 0 420 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4)) drop-shadow(0 0 16px rgba(6,182,212,0.08))' }}
      >
        <defs>
          {/* Hull body gradient */}
          <linearGradient id="hullBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e6a7a" />
            <stop offset="25%" stopColor="#0e7490" />
            <stop offset="50%" stopColor="#0891b2" />
            <stop offset="75%" stopColor="#0e7490" />
            <stop offset="100%" stopColor="#155e75" />
          </linearGradient>
          {/* Hull highlight */}
          <linearGradient id="hullHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="40%" stopColor="rgba(103,232,249,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Tower gradient */}
          <linearGradient id="towerFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#083344" />
            <stop offset="100%" stopColor="#155e75" />
          </linearGradient>
          {/* Window glass */}
          <radialGradient id="windowGlass" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#22d3ee" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0e7490" stopOpacity="0.3" />
          </radialGradient>
          {/* Window reflection */}
          <radialGradient id="windowShine" cx="25%" cy="25%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          {/* Propeller housing */}
          <radialGradient id="propHousing" cx="40%" cy="40%">
            <stop offset="0%" stopColor="#164e63" />
            <stop offset="100%" stopColor="#083344" />
          </radialGradient>
          {/* Drill gradient */}
          <linearGradient id="drillMetal" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          {/* Engine glow */}
          <radialGradient id="engineGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          {/* Sonar pulse */}
          <radialGradient id="sonarPulse" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.3" />
          </radialGradient>
        </defs>

        {/* === MAIN HULL — proper submarine shape === */}
        <path
          d="M40 120 
             Q40 78 80 68 
             L320 68 
             Q370 72 380 100 
             L385 112 
             Q388 120 385 128 
             L380 140
             Q370 168 320 172 
             L80 172 
             Q40 162 40 120Z"
          fill="url(#hullBody)"
          stroke="#0c4a6e"
          strokeWidth="1.5"
        />
        {/* Hull highlight stripe */}
        <path
          d="M55 98 Q200 80 370 100"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        {/* Hull metallic sheen overlay */}
        <path
          d="M40 120 Q40 78 80 68 L320 68 Q370 72 380 100 L385 112 Q388 120 385 128 L380 140 Q370 168 320 172 L80 172 Q40 162 40 120Z"
          fill="url(#hullHighlight)"
          opacity="0.5"
        />

        {/* Panel lines */}
        <g opacity="0.3" stroke="#0c4a6e" strokeWidth="0.8">
          <line x1="130" y1="70" x2="130" y2="170" />
          <line x1="200" y1="69" x2="200" y2="171" />
          <line x1="270" y1="69" x2="270" y2="171" />
          <line x1="340" y1="72" x2="340" y2="168" />
        </g>

        {/* Rivets — top row */}
        <g opacity="0.4" fill="#083344">
          {[95, 130, 165, 200, 235, 270, 305, 340].map((x, i) => (
            <circle key={`rt-${i}`} cx={x} cy={76} r="2" />
          ))}
          {[95, 130, 165, 200, 235, 270, 305, 340].map((x, i) => (
            <circle key={`rb-${i}`} cx={x} cy={164} r="2" />
          ))}
        </g>

        {/* === CONNING TOWER === */}
        <g>
          <rect x="185" y="36" width="50" height="38" rx="6" fill="url(#towerFill)" stroke="#0c4a6e" strokeWidth="1.2" />
          {/* Tower top dome */}
          <ellipse cx="210" cy="36" rx="25" ry="8" fill="url(#towerFill)" stroke="#0c4a6e" strokeWidth="0.8" />
          {/* Periscope */}
          <rect x="207" y="14" width="6" height="24" rx="2" fill="#164e63" stroke="#0c4a6e" strokeWidth="0.6" />
          <rect x="204" y="10" width="12" height="6" rx="2" fill="#0e7490" stroke="#0c4a6e" strokeWidth="0.6" />
          {/* Tower windows */}
          <circle cx="200" cy="52" r="4" fill="url(#windowGlass)" stroke="#06b6d4" strokeWidth="0.8" />
          <circle cx="220" cy="52" r="4" fill="url(#windowGlass)" stroke="#06b6d4" strokeWidth="0.8" />
        </g>

        {/* === NOSE / BOW — viewing windows === */}
        <g>
          {/* Main viewport */}
          <ellipse cx="355" cy="118" rx="18" ry="26" fill="url(#windowGlass)" stroke="#06b6d4" strokeWidth="1.5" />
          <ellipse cx="351" cy="110" rx="8" ry="14" fill="url(#windowShine)" opacity="0.6" />
          {/* Side portholes */}
          <circle cx="310" cy="98" r="7" fill="url(#windowGlass)" stroke="#06b6d4" strokeWidth="1" />
          <circle cx="310" cy="96" r="3" fill="rgba(255,255,255,0.25)" />
          <circle cx="285" cy="94" r="5.5" fill="url(#windowGlass)" stroke="#06b6d4" strokeWidth="0.8" />
          <circle cx="260" cy="92" r="4.5" fill="url(#windowGlass)" stroke="#06b6d4" strokeWidth="0.8" />
        </g>

        {/* === MINING DRILL === */}
        <g transform="translate(380, 116)">
          <rect x="0" y="-6" width="24" height="12" rx="2" fill="url(#drillMetal)" stroke="#334155" strokeWidth="0.8" />
          {/* Drill tip */}
          <polygon points="24,-4 34,0 24,4" fill="#64748b" stroke="#334155" strokeWidth="0.5" />
          <circle cx="27" cy="0" r="2.5" fill="#f97316" opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* === PROPULSION === */}
        <g transform="translate(36, 120)">
          {/* Engine glow */}
          <ellipse rx="14" ry="14" fill="url(#engineGlow)" opacity="0.5" />
          {/* Propeller housing */}
          <circle r="20" fill="url(#propHousing)" stroke="#0c4a6e" strokeWidth="1.5" />
          {/* Propeller blades */}
          <g className="animate-spin" style={{ transformOrigin: 'center' }}>
            <ellipse rx="16" ry="2.5" fill="#083344" opacity="0.85" />
            <ellipse rx="2.5" ry="16" fill="#083344" opacity="0.85" />
            <ellipse rx="12" ry="1.8" fill="#0e7490" opacity="0.6" transform="rotate(45)" />
            <ellipse rx="1.8" ry="12" fill="#0e7490" opacity="0.6" transform="rotate(45)" />
          </g>
          {/* Center hub */}
          <circle r="4.5" fill="#22d3ee" opacity="0.7" />
          <circle r="2.5" fill="#083344" />
        </g>

        {/* === TAIL FINS === */}
        <path d="M42 90 L24 70 L24 82 L40 96" fill="#155e75" stroke="#0c4a6e" strokeWidth="0.8" />
        <path d="M42 150 L24 170 L24 158 L40 144" fill="#155e75" stroke="#0c4a6e" strokeWidth="0.8" />

        {/* === SIDE FINS === */}
        <path d="M280 172 L300 192 L310 192 L295 172" fill="#155e75" stroke="#0c4a6e" strokeWidth="0.8" />
        <path d="M280 68 L300 48 L310 48 L295 68" fill="#155e75" stroke="#0c4a6e" strokeWidth="0.8" />

        {/* === BALLAST TANKS === */}
        <ellipse cx="145" cy="72" rx="14" ry="6" fill="#0c4a6e" stroke="#083344" strokeWidth="0.8" opacity="0.7" />
        <ellipse cx="145" cy="168" rx="14" ry="6" fill="#0c4a6e" stroke="#083344" strokeWidth="0.8" opacity="0.7" />

        {/* === SONAR === */}
        <g transform="translate(335, 78)">
          <circle r="6" fill="url(#sonarPulse)" stroke="#10b981" strokeWidth="0.8" />
          <circle r="4" fill="none" stroke="#10b981" strokeWidth="0.4" opacity="0.6">
            <animate attributeName="r" values="4;10;4" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* === NAV LIGHTS === */}
        <circle cx="382" cy="100" r="2.5" fill="#ff0040">
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="382" cy="138" r="2.5" fill="#00ff40">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* === NAMEPLATE === */}
        <rect x="175" y="108" width="60" height="14" rx="3" fill="rgba(6,182,212,0.12)" stroke="#06b6d4" strokeWidth="0.5" />
        <text x="205" y="118" textAnchor="middle" fill="#22d3ee" fontSize="7" fontFamily="monospace" fontWeight="bold">
          ABYSSX-01
        </text>

        {/* === STORAGE INDICATOR === */}
        <rect x="135" y="145" width="55" height="14" rx="3" fill="rgba(14,165,233,0.12)" stroke="#0ea5e9" strokeWidth="0.5" />
        <text x="162" y="155" textAnchor="middle" fill="#38bdf8" fontSize="6" fontFamily="monospace">MINERALS</text>
      </svg>
      
      {/* Engine Exhaust Effect */}
      <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-8 h-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={`exhaust-${i}`}
            className="absolute rounded-full bg-cyan-400/15"
            style={{
              width: `${4 + i * 2}px`,
              height: `${4 + i * 2}px`,
              left: `${-i * 8}px`,
              top: '50%',
              transform: 'translateY(-50%)',
              animation: `exhaustPulse ${1 + i * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
};