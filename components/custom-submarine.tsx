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
        {/* Submarine Main Body */}
        <ellipse
          cx="200"
          cy="120"
          rx="160"
          ry="50"
          fill="url(#submarineGradient)"
          stroke="url(#submarineBorder)"
          strokeWidth="2"
        />
        
        {/* Submarine Hull Segments */}
        <ellipse cx="120" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.6" />
        <ellipse cx="160" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.4" />
        <ellipse cx="200" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.6" />
        <ellipse cx="240" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.4" />
        <ellipse cx="280" cy="120" rx="20" ry="45" fill="url(#hullSegment)" opacity="0.6" />
        
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
          stroke="#00d4ff"
          strokeWidth="2"
        />
        
        {/* Window Reflection */}
        <ellipse
          cx="325"
          cy="110"
          rx="12"
          ry="20"
          fill="url(#windowReflection)"
          opacity="0.6"
        />
        
        {/* Side Windows */}
        <circle cx="280" cy="105" r="8" fill="url(#sideWindow)" stroke="#00d4ff" strokeWidth="1" />
        <circle cx="250" cy="105" r="6" fill="url(#sideWindow)" stroke="#00d4ff" strokeWidth="1" />
        <circle cx="220" cy="105" r="6" fill="url(#sideWindow)" stroke="#00d4ff" strokeWidth="1" />
        
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
          <circle r="25" fill="url(#propellerHousing)" stroke="#2a5298" strokeWidth="2" />
          {/* Propeller Blades */}
          <g className="animate-spin" style={{ transformOrigin: 'center' }}>
            <ellipse cx="0" cy="0" rx="20" ry="3" fill="#1e3a8a" opacity="0.8" />
            <ellipse cx="0" cy="0" rx="3" ry="20" fill="#1e3a8a" opacity="0.8" />
            <ellipse cx="0" cy="0" rx="14" ry="2" fill="#3b82f6" opacity="0.6" transform="rotate(45)" />
            <ellipse cx="0" cy="0" rx="2" ry="14" fill="#3b82f6" opacity="0.6" transform="rotate(45)" />
          </g>
          {/* Center Hub */}
          <circle r="6" fill="url(#hubGradient)" />
        </g>
        
        {/* Secondary Thrusters */}
        <g transform="translate(80, 90)">
          <ellipse rx="12" ry="6" fill="url(#thrusterGradient)" />
          <ellipse rx="8" ry="4" fill="#60a5fa" opacity="0.5" />
        </g>
        <g transform="translate(80, 150)">
          <ellipse rx="12" ry="6" fill="url(#thrusterGradient)" />
          <ellipse rx="8" ry="4" fill="#60a5fa" opacity="0.5" />
        </g>
        
        {/* Ballast Tanks */}
        <ellipse cx="140" cy="80" rx="15" ry="8" fill="url(#ballastGradient)" stroke="#1e40af" strokeWidth="1" />
        <ellipse cx="140" cy="160" rx="15" ry="8" fill="url(#ballastGradient)" stroke="#1e40af" strokeWidth="1" />
        <ellipse cx="260" cy="80" rx="15" ry="8" fill="url(#ballastGradient)" stroke="#1e40af" strokeWidth="1" />
        <ellipse cx="260" cy="160" rx="15" ry="8" fill="url(#ballastGradient)" stroke="#1e40af" strokeWidth="1" />
        
        {/* Navigation Lights */}
        <circle cx="370" cy="100" r="3" fill="#ff0040" className="animate-pulse">
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="370" cy="140" r="3" fill="#00ff40" className="animate-pulse">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
        
        {/* Mining Storage Compartment */}
        <rect x="150" y="140" width="60" height="20" rx="4" fill="url(#storageGradient)" stroke="#0ea5e9" strokeWidth="1" />
        <text x="180" y="152" textAnchor="middle" fill="#00d4ff" fontSize="8" fontFamily="monospace">MINERALS</text>
        
        {/* Sonar Equipment */}
        <g transform="translate(320, 85)">
          <circle r="8" fill="url(#sonarGradient)" stroke="#00ff88" strokeWidth="1" />
          <circle r="5" fill="none" stroke="#00ff88" strokeWidth="0.5" opacity="0.7">
            <animate attributeName="r" values="5;12;5" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0;0.7" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>
        
        {/* Hull Details and Rivets */}
        <g opacity="0.4">
          {[...Array(8)].map((_, i) => (
            <circle
              key={`rivet-${i}`}
              cx={120 + i * 20}
              cy={95}
              r="2"
              fill="#1e40af"
            />
          ))}
          {[...Array(8)].map((_, i) => (
            <circle
              key={`rivet-bottom-${i}`}
              cx={120 + i * 20}
              cy={145}
              r="2"
              fill="#1e40af"
            />
          ))}
        </g>
        
        {/* Submarine Name Plate */}
        <rect x="170" y="95" width="60" height="12" rx="2" fill="rgba(0, 212, 255, 0.1)" stroke="#00d4ff" strokeWidth="0.5" />
        <text x="200" y="103" textAnchor="middle" fill="#00d4ff" fontSize="6" fontFamily="monospace" fontWeight="bold">
          ABYSSX-01
        </text>
        
        {/* Gradient Definitions */}
        <defs>
          <linearGradient id="submarineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="30%" stopColor="#2563eb" />
            <stop offset="70%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          
          <linearGradient id="submarineBorder" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          
          <linearGradient id="hullSegment" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          
          <linearGradient id="towerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          
          <linearGradient id="towerBorder" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          
          <linearGradient id="bridgeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          
          <linearGradient id="cockpitBorder" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          
          <radialGradient id="windowGradient" cx="30%" cy="30%">
            <stop offset="0%" stopColor="rgba(0, 212, 255, 0.8)" />
            <stop offset="70%" stopColor="rgba(0, 150, 255, 0.4)" />
            <stop offset="100%" stopColor="rgba(0, 100, 200, 0.2)" />
          </radialGradient>
          
          <radialGradient id="windowReflection" cx="30%" cy="30%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.6)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </radialGradient>
          
          <radialGradient id="sideWindow" cx="30%" cy="30%">
            <stop offset="0%" stopColor="rgba(0, 212, 255, 0.6)" />
            <stop offset="100%" stopColor="rgba(0, 100, 200, 0.2)" />
          </radialGradient>
          
          <linearGradient id="drillGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4a5568" />
            <stop offset="100%" stopColor="#2d3748" />
          </linearGradient>
          
          <linearGradient id="collectorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4a90e2" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          
          <radialGradient id="propellerHousing" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="70%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e40af" />
          </radialGradient>
          
          <radialGradient id="hubGradient" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </radialGradient>
          
          <linearGradient id="thrusterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          
          <linearGradient id="ballastGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
          
          <linearGradient id="storageGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          
          <radialGradient id="sonarGradient" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#00ff88" />
            <stop offset="100%" stopColor="#00cc66" />
          </radialGradient>
        </defs>
      </svg>
      
      {/* Engine Exhaust Effect */}
      <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={`exhaust-${i}`}
            className="absolute rounded-full bg-cyan-400/20"
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