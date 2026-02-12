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
        viewBox="0 0 400 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-2xl"
      >
        {/* Submarine Main Body - Glassmorphic hull */}
        <ellipse
          cx="200"
          cy="120"
          rx="160"
          ry="50"
          fill="url(#submarineGradient)"
          stroke="url(#submarineBorder)"
          strokeWidth="1.5"
          opacity="0.85"
          filter="url(#glassBlur)"
        />
        
        {/* Glassmorphic frosted overlay */}
        <ellipse
          cx="200"
          cy="120"
          rx="158"
          ry="48"
          fill="url(#glassOverlay)"
          opacity="0.25"
        />
        
        {/* Metallic highlight overlay for premium glass look */}
        <ellipse
          cx="200"
          cy="105"
          rx="150"
          ry="35"
          fill="url(#metallicHighlight)"
          opacity="0.5"
        />
        
        {/* Glass edge highlight - top rim */}
        <ellipse
          cx="200"
          cy="78"
          rx="140"
          ry="8"
          fill="url(#glassEdgeHighlight)"
          opacity="0.35"
        />
        
        {/* Submarine Hull Segments with enhanced depth */}
        <ellipse cx="120" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.7" />
        <ellipse cx="160" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.5" />
        <ellipse cx="200" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.7" />
        <ellipse cx="240" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.5" />
        <ellipse cx="280" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.7" />
        
        {/* Command Tower */}
        <rect
          x="180"
          y="70"
          width="40"
          height="50"
          rx="8"
          fill="url(#towerGradient)"
          stroke="url(#towerBorder)"
          strokeWidth="1.5"
        />
        
        {/* Bridge/Cockpit */}
        <ellipse
          cx="200"
          cy="75"
          rx="25"
          ry="15"
          fill="url(#bridgeGradient)"
          stroke="url(#cockpitBorder)"
          strokeWidth="1"
        />
        
        {/* Main Viewing Window */}
        <ellipse
          cx="330"
          cy="120"
          rx="25"
          ry="35"
          fill="url(#windowGradient)"
          stroke="#06b6d4"
          strokeWidth="2"
        />
        
        {/* Window Reflection */}
        <ellipse
          cx="325"
          cy="110"
          rx="12"
          ry="20"
          fill="url(#windowReflection)"
          opacity="0.7"
        />
        
        {/* Side Windows */}
        <circle cx="280" cy="105" r="8" fill="url(#sideWindow)" stroke="#06b6d4" strokeWidth="1" />
        <circle cx="250" cy="105" r="6" fill="url(#sideWindow)" stroke="#06b6d4" strokeWidth="1" />
        <circle cx="220" cy="105" r="6" fill="url(#sideWindow)" stroke="#06b6d4" strokeWidth="1" />
        
        {/* Mining Equipment - Front Drill */}
        <g transform="translate(350, 120)">
          <rect x="0" y="-8" width="30" height="16" rx="3" fill="url(#drillGradient)" />
          <circle cx="32" r="6" fill="#ff6b35" />
          <circle cx="32" r="3" fill="#ff8c42" />
          {/* Drill bit */}
          <polygon points="38,0 45,-3 45,3" fill="#ff4500" />
        </g>
        
        {/* Mining Equipment - Resource Collector */}
        <g transform="translate(340, 140)">
          <rect x="0" y="0" width="25" height="12" rx="2" fill="url(#collectorGradient)" />
          <rect x="5" y="12" width="4" height="8" fill="#4a90e2" />
          <rect x="11" y="12" width="4" height="8" fill="#4a90e2" />
          <rect x="17" y="12" width="4" height="8" fill="#4a90e2" />
        </g>
        
        {/* Propulsion System */}
        <g transform="translate(50, 120)">
          {/* Main Propeller Housing */}
          <circle r="25" fill="url(#propellerHousing)" stroke="#155e75" strokeWidth="2" />
          {/* Propeller Blades - Enhanced with ocean colors */}
          <g className="animate-spin" style={{ transformOrigin: 'center' }}>
            <ellipse cx="0" cy="0" rx="20" ry="3" fill="#083344" opacity="0.9" />
            <ellipse cx="0" cy="0" rx="3" ry="20" fill="#083344" opacity="0.9" />
            <ellipse cx="0" cy="0" rx="14" ry="2" fill="#0e7490" opacity="0.7" transform="rotate(45)" />
            <ellipse cx="0" cy="0" rx="2" ry="14" fill="#0e7490" opacity="0.7" transform="rotate(45)" />
          </g>
          {/* Center Hub */}
          <circle r="6" fill="url(#hubGradient)" />
        </g>
        
        {/* Secondary Thrusters */}
        <g transform="translate(80, 90)">
          <ellipse rx="12" ry="6" fill="url(#thrusterGradient)" />
          <ellipse rx="8" ry="4" fill="#22d3ee" opacity="0.5" />
        </g>
        <g transform="translate(80, 150)">
          <ellipse rx="12" ry="6" fill="url(#thrusterGradient)" />
          <ellipse rx="8" ry="4" fill="#22d3ee" opacity="0.5" />
        </g>
        
        {/* Ballast Tanks */}
        <ellipse cx="140" cy="80" rx="15" ry="8" fill="url(#ballastGradient)" stroke="#0c4a6e" strokeWidth="1" />
        <ellipse cx="140" cy="160" rx="15" ry="8" fill="url(#ballastGradient)" stroke="#0c4a6e" strokeWidth="1" />
        <ellipse cx="260" cy="80" rx="15" ry="8" fill="url(#ballastGradient)" stroke="#0c4a6e" strokeWidth="1" />
        <ellipse cx="260" cy="160" rx="15" ry="8" fill="url(#ballastGradient)" stroke="#0c4a6e" strokeWidth="1" />
        
        {/* Navigation Lights */}
        <circle cx="370" cy="100" r="3" fill="#ff0040" className="animate-pulse">
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="370" cy="140" r="3" fill="#00ff40" className="animate-pulse">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
        
        {/* Mining Storage Compartment */}
        <rect x="150" y="140" width="60" height="20" rx="4" fill="url(#storageGradient)" stroke="#0ea5e9" strokeWidth="1" />
        <text x="180" y="152" textAnchor="middle" fill="#22d3ee" fontSize="8" fontFamily="monospace">MINERALS</text>
        
        {/* Sonar Equipment */}
        <g transform="translate(320, 85)">
          <circle r="8" fill="url(#sonarGradient)" stroke="#10b981" strokeWidth="1" />
          <circle r="5" fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.7">
            <animate attributeName="r" values="5;12;5" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0;0.7" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>
        
        {/* Hull Details and Rivets */}
        <g opacity="0.5">
          {[...Array(8)].map((_, i) => (
            <circle
              key={`rivet-${i}`}
              cx={120 + i * 20}
              cy={95}
              r="2"
              fill="#083344"
            />
          ))}
          {[...Array(8)].map((_, i) => (
            <circle
              key={`rivet-bottom-${i}`}
              cx={120 + i * 20}
              cy={145}
              r="2"
              fill="#083344"
            />
          ))}
        </g>
        
        {/* Submarine Name Plate */}
        <rect x="170" y="95" width="60" height="12" rx="2" fill="rgba(6, 182, 212, 0.15)" stroke="#06b6d4" strokeWidth="0.5" />
        <text x="200" y="103" textAnchor="middle" fill="#22d3ee" fontSize="6" fontFamily="monospace" fontWeight="bold">
          ABYSSX-01
        </text>
        
        {/* Gradient Definitions */}
        <defs>
          {/* Glassmorphic blur filter */}
          <filter id="glassBlur" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
          </filter>
          
          {/* Glass overlay gradient - frosted effect */}
          <linearGradient id="glassOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="30%" stopColor="#67e8f9" stopOpacity="0.1" />
            <stop offset="70%" stopColor="#0891b2" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.15" />
          </linearGradient>
          
          {/* Glass edge highlight */}
          <linearGradient id="glassEdgeHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          
          {/* Glassmorphic Hull - Ocean palette with translucency */}
          <linearGradient id="submarineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#164e63" stopOpacity="0.75" />
            <stop offset="20%" stopColor="#0e7490" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#0891b2" stopOpacity="0.85" />
            <stop offset="80%" stopColor="#0e7490" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#155e75" stopOpacity="0.75" />
          </linearGradient>
          
          <linearGradient id="submarineBorder" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0891b2" stopOpacity="0.6" />
          </linearGradient>
          
          <linearGradient id="hullSegment" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0e7490" />
            <stop offset="100%" stopColor="#164e63" />
          </linearGradient>
          
          {/* Glassmorphic Highlight for frosted glass look */}
          <linearGradient id="metallicHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.4)" />
            <stop offset="25%" stopColor="rgba(103, 232, 249, 0.15)" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.08)" />
            <stop offset="75%" stopColor="rgba(103, 232, 249, 0.1)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </linearGradient>
          
          {/* Command Tower - Glassmorphic darker */}
          <linearGradient id="towerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#083344" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#164e63" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#0c4a6e" stopOpacity="0.8" />
          </linearGradient>
          
          <linearGradient id="towerBorder" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0891b2" stopOpacity="0.7" />
          </linearGradient>
          
          <linearGradient id="bridgeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0e7490" />
            <stop offset="100%" stopColor="#155e75" />
          </linearGradient>
          
          <linearGradient id="cockpitBorder" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.6" />
          </linearGradient>
          
          {/* Enhanced Window Effects - Glassmorphic glass with refraction */}
          <radialGradient id="windowGradient" cx="35%" cy="35%">
            <stop offset="0%" stopColor="rgba(103, 232, 249, 0.95)" />
            <stop offset="30%" stopColor="rgba(6, 182, 212, 0.7)" />
            <stop offset="60%" stopColor="rgba(14, 165, 233, 0.45)" />
            <stop offset="100%" stopColor="rgba(21, 94, 117, 0.2)" />
          </radialGradient>
          
          <radialGradient id="windowReflection" cx="25%" cy="25%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.85)" />
            <stop offset="30%" stopColor="rgba(255, 255, 255, 0.4)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </radialGradient>
          
          <radialGradient id="sideWindow" cx="30%" cy="30%">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.8)" />
            <stop offset="60%" stopColor="rgba(14, 165, 233, 0.5)" />
            <stop offset="100%" stopColor="rgba(8, 145, 178, 0.2)" />
          </radialGradient>
          
          {/* Industrial Mining Equipment - Premium metallic */}
          <linearGradient id="drillGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          
          <linearGradient id="drillTip" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
          
          <linearGradient id="collectorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0c4a6e" />
            <stop offset="50%" stopColor="#075985" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          
          {/* Propulsion System - Premium metallic ocean */}
          <radialGradient id="propellerHousing" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#164e63" />
            <stop offset="50%" stopColor="#0e7490" />
            <stop offset="100%" stopColor="#083344" />
          </radialGradient>
          
          <radialGradient id="hubGradient" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </radialGradient>
          
          <linearGradient id="thrusterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#155e75" />
            <stop offset="50%" stopColor="#0e7490" />
            <stop offset="100%" stopColor="#164e63" />
          </linearGradient>
          
          <linearGradient id="ballastGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0c4a6e" />
            <stop offset="100%" stopColor="#075985" />
          </linearGradient>
          
          <linearGradient id="storageGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          
          <radialGradient id="sonarGradient" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#059669" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.5" />
          </radialGradient>
          
          {/* Panel Shadow for hull details */}
          <linearGradient id="panelShadow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 0, 0, 0.3)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Engine Exhaust Effect */}
      <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={`exhaust-${i}`}
            className="absolute rounded-full bg-ocean-400/20"
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