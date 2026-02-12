"use client"

import React, { useEffect, useRef, useState } from 'react';

interface HeroSubmarineProps {
  className?: string;
  parallaxOffset?: { x: number; y: number };
}

export const HeroSubmarine: React.FC<HeroSubmarineProps> = ({ 
  className = "",
  parallaxOffset = { x: 0, y: 0 }
}) => {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate random positions for bubbles
  const generateBubbles = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 8,
      duration: Math.random() * 4 + 6,
      x: Math.random() * 30 - 15,
    }));
  };

  // Generate bioluminescent particles
  const generateParticles = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      color: ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981'][Math.floor(Math.random() * 4)],
    }));
  };

  const bubbles = generateBubbles(8);
  const particles = generateParticles(25);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full aspect-[16/9] max-w-[600px] mx-auto ${className}`}
      style={{
        transform: `translate(${parallaxOffset.x * 0.03}px, ${parallaxOffset.y * 0.03}px)`,
      }}
    >
      {/* Deep Ocean Background with Gradient */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        {/* Primary ocean gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, #0a1628 0%, #0d1f35 30%, #0f2847 60%, #051020 100%)',
          }}
        />

        {/* Depth fog layers */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            background: 'radial-gradient(ellipse at 50% 120%, rgba(59, 130, 246, 0.15) 0%, transparent 60%)',
          }}
        />

        {/* Caustic light patterns */}
        <div 
          className="absolute inset-0 opacity-20 caustic-animation"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 100px 50px at 20% 30%, rgba(56, 189, 248, 0.3) 0%, transparent 50%),
              radial-gradient(ellipse 80px 40px at 60% 20%, rgba(59, 130, 246, 0.25) 0%, transparent 50%),
              radial-gradient(ellipse 120px 60px at 80% 40%, rgba(34, 211, 238, 0.2) 0%, transparent 50%)
            `,
          }}
        />

        {/* Bioluminescent particles */}
        {mounted && particles.map((particle) => (
          <div
            key={`particle-${particle.id}`}
            className="absolute rounded-full bioluminescent-particle"
            style={{
              width: particle.size,
              height: particle.size,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 3}px ${particle.color}`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}

        {/* Distant seaweed silhouettes - left side */}
        <svg 
          className="absolute bottom-0 left-0 w-24 h-40 opacity-30"
          viewBox="0 0 100 200"
          style={{ transform: `translateX(${parallaxOffset.x * 0.08}px)` }}
        >
          <path 
            d="M20,200 Q25,150 15,100 Q20,80 10,40 Q15,20 12,0" 
            fill="none" 
            stroke="#1e3a5f" 
            strokeWidth="8"
            className="seaweed-sway"
          />
          <path 
            d="M50,200 Q45,160 55,120 Q48,90 58,50 Q52,30 55,10" 
            fill="none" 
            stroke="#1e3a5f" 
            strokeWidth="6"
            className="seaweed-sway-delayed"
          />
          <path 
            d="M75,200 Q80,170 70,140 Q78,110 68,80" 
            fill="none" 
            stroke="#1e3a5f" 
            strokeWidth="5"
            className="seaweed-sway"
          />
        </svg>

        {/* Distant seaweed silhouettes - right side */}
        <svg 
          className="absolute bottom-0 right-0 w-24 h-36 opacity-25"
          viewBox="0 0 100 180"
          style={{ transform: `translateX(${parallaxOffset.x * -0.08}px)` }}
        >
          <path 
            d="M30,180 Q25,130 35,90 Q28,60 38,30" 
            fill="none" 
            stroke="#1e3a5f" 
            strokeWidth="7"
            className="seaweed-sway-delayed"
          />
          <path 
            d="M60,180 Q65,150 55,110 Q62,80 52,50 Q58,30 54,10" 
            fill="none" 
            stroke="#1e3a5f" 
            strokeWidth="5"
            className="seaweed-sway"
          />
          <path 
            d="M85,180 Q80,150 90,120 Q82,95 88,70" 
            fill="none" 
            stroke="#1e3a5f" 
            strokeWidth="6"
            className="seaweed-sway-delayed"
          />
        </svg>

        {/* Coral silhouettes at bottom */}
        <svg 
          className="absolute bottom-0 left-1/4 w-32 h-20 opacity-20"
          viewBox="0 0 150 100"
          style={{ transform: `translateX(${parallaxOffset.x * 0.05}px)` }}
        >
          <ellipse cx="30" cy="90" rx="25" ry="12" fill="#1a2e4a" />
          <ellipse cx="80" cy="85" rx="30" ry="15" fill="#162438" />
          <ellipse cx="120" cy="92" rx="20" ry="10" fill="#1a2e4a" />
          <path d="M60,100 L60,70 L50,55 M60,70 L70,55 M60,75 L55,60" stroke="#1e3a5f" strokeWidth="3" fill="none" />
          <path d="M100,100 L100,75 L95,60 M100,75 L105,62" stroke="#1e3a5f" strokeWidth="2" fill="none" />
        </svg>
      </div>

      {/* Main Submarine Container with floating animation */}
      <div 
        className="absolute inset-0 flex items-center justify-center submarine-float-premium"
        style={{
          transform: `translate(${parallaxOffset.x * 0.05}px, ${parallaxOffset.y * 0.05}px)`,
        }}
      >
        {/* Volumetric Light Beam from Headlight */}
        <div 
          className="absolute right-[5%] top-1/2 -translate-y-1/2 w-[200px] h-[120px] headlight-beam"
          style={{
            background: 'conic-gradient(from -15deg at 0% 50%, transparent 0deg, rgba(250, 250, 210, 0.15) 10deg, rgba(250, 250, 210, 0.08) 30deg, transparent 45deg)',
            transformOrigin: 'left center',
            filter: 'blur(8px)',
          }}
        />

        {/* Secondary light scatter */}
        <div 
          className="absolute right-[10%] top-1/2 -translate-y-1/2 w-[150px] h-[80px]"
          style={{
            background: 'radial-gradient(ellipse at left, rgba(250, 250, 210, 0.1) 0%, transparent 70%)',
            filter: 'blur(15px)',
          }}
        />

        {/* Submarine Shadow */}
        <div 
          className="absolute bottom-[15%] left-1/2 -translate-x-1/2 w-[70%] h-[20px] opacity-40"
          style={{
            background: 'radial-gradient(ellipse, rgba(0, 0, 0, 0.6) 0%, transparent 70%)',
            filter: 'blur(10px)',
          }}
        />

        {/* The Premium Submarine SVG */}
        <svg
          viewBox="0 0 500 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[85%] h-auto drop-shadow-2xl relative z-10"
          style={{ filter: 'drop-shadow(0 25px 50px rgba(0, 0, 0, 0.4)) drop-shadow(0 0 30px rgba(103, 232, 249, 0.08))' }}
        >
          <defs>
            {/* Hull Gradient - Glassmorphic Weathered Metal */}
            <linearGradient id="hullGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3d5a6c" stopOpacity="0.8" />
              <stop offset="15%" stopColor="#4a7c8f" stopOpacity="0.75" />
              <stop offset="30%" stopColor="#6b7c8d" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#5a6b7c" stopOpacity="0.78" />
              <stop offset="70%" stopColor="#4a5c6d" stopOpacity="0.8" />
              <stop offset="85%" stopColor="#3d4e5c" stopOpacity="0.82" />
              <stop offset="100%" stopColor="#2c3e50" stopOpacity="0.8" />
            </linearGradient>

            {/* Secondary Hull - Navy Blue */}
            <linearGradient id="hullSecondary" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a2332" />
              <stop offset="50%" stopColor="#2c3e50" />
              <stop offset="100%" stopColor="#1a2332" />
            </linearGradient>

            {/* Glassmorphic Metallic Highlight */}
            <linearGradient id="metallicSheen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(138, 155, 168, 0.45)" />
              <stop offset="20%" stopColor="rgba(103, 232, 249, 0.15)" />
              <stop offset="50%" stopColor="rgba(107, 124, 141, 0.1)" />
              <stop offset="80%" stopColor="rgba(103, 232, 249, 0.12)" />
              <stop offset="100%" stopColor="rgba(74, 92, 109, 0.35)" />
            </linearGradient>

            {/* Glass Frosted Overlay */}
            <linearGradient id="glassFrost" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="30%" stopColor="#67e8f9" stopOpacity="0.08" />
              <stop offset="60%" stopColor="#0891b2" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
            </linearGradient>

            {/* Glass Edge Rim Light */}
            <linearGradient id="glassRimLight" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="25%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="50%" stopColor="rgba(103,232,249,0.4)" />
              <stop offset="75%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            {/* Window Glass - Glassmorphic with depth */}
            <radialGradient id="windowGlass" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.6" />
              <stop offset="30%" stopColor="#4a7c8f" stopOpacity="0.7" />
              <stop offset="60%" stopColor="#2c3e50" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0f1720" stopOpacity="0.85" />
            </radialGradient>

            {/* Window Interior Glow */}
            <radialGradient id="windowGlow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#0891b2" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0e7490" stopOpacity="0.1" />
            </radialGradient>

            {/* Engine Glow */}
            <radialGradient id="engineGlow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
              <stop offset="30%" stopColor="#ea580c" stopOpacity="0.6" />
              <stop offset="60%" stopColor="#c2410c" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#7c2d12" stopOpacity="0" />
            </radialGradient>

            {/* Headlight Glow */}
            <radialGradient id="headlightGlow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#fefce8" stopOpacity="1" />
              <stop offset="40%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="70%" stopColor="#fde047" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
            </radialGradient>

            {/* Weathered Metal Texture Filter */}
            <filter id="metalTexture" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
              <feDiffuseLighting in="noise" lightingColor="#8a9ba8" surfaceScale="1.5" result="light">
                <feDistantLight azimuth="45" elevation="60" />
              </feDiffuseLighting>
              <feBlend in="SourceGraphic" in2="light" mode="overlay" result="textured" />
            </filter>

            {/* Scratches Pattern */}
            <pattern id="scratchPattern" patternUnits="userSpaceOnUse" width="100" height="100">
              <line x1="10" y1="10" x2="25" y2="8" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
              <line x1="40" y1="30" x2="60" y2="28" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
              <line x1="70" y1="50" x2="85" y2="52" stroke="rgba(0,0,0,0.12)" strokeWidth="0.4" />
              <line x1="20" y1="70" x2="35" y2="68" stroke="rgba(0,0,0,0.08)" strokeWidth="0.3" />
              <line x1="55" y1="85" x2="75" y2="87" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
            </pattern>

            {/* Ambient Light Caustics */}
            <filter id="causticFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" result="turbulence">
                <animate attributeName="baseFrequency" values="0.02;0.025;0.02" dur="8s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="3" xChannelSelector="R" yChannelSelector="G" />
            </filter>

            {/* Conning Tower Gradient */}
            <linearGradient id="towerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4a5c6d" />
              <stop offset="30%" stopColor="#3d4e5c" />
              <stop offset="70%" stopColor="#2c3e50" />
              <stop offset="100%" stopColor="#1a2332" />
            </linearGradient>

            {/* Propeller Housing */}
            <linearGradient id="propHousingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2c3e50" />
              <stop offset="50%" stopColor="#1a2332" />
              <stop offset="100%" stopColor="#0f1720" />
            </linearGradient>
          </defs>

          {/* === MAIN HULL === */}
          <g id="hull">
            {/* Hull Shadow */}
            <ellipse cx="250" cy="155" rx="180" ry="55" fill="rgba(0,0,0,0.3)" filter="blur(8px)" />

            {/* Main Hull Body */}
            <path
              d="M60 140 
                 Q60 95 120 85 
                 L380 85 
                 Q440 95 445 140 
                 Q445 185 380 195 
                 L120 195 
                 Q60 185 60 140 Z"
              fill="url(#hullGradient)"
              stroke="#1a2332"
              strokeWidth="2"
            />

            {/* Hull Metallic Overlay */}
            <path
              d="M60 140 
                 Q60 95 120 85 
                 L380 85 
                 Q440 95 445 140 
                 Q445 185 380 195 
                 L120 195 
                 Q60 185 60 140 Z"
              fill="url(#metallicSheen)"
              opacity="0.6"
            />

            {/* Scratches Overlay */}
            <path
              d="M60 140 
                 Q60 95 120 85 
                 L380 85 
                 Q440 95 445 140 
                 Q445 185 380 195 
                 L120 195 
                 Q60 185 60 140 Z"
              fill="url(#scratchPattern)"
              opacity="0.35"
            />

            {/* Glassmorphic Frosted Overlay */}
            <path
              d="M60 140 
                 Q60 95 120 85 
                 L380 85 
                 Q440 95 445 140 
                 Q445 185 380 195 
                 L120 195 
                 Q60 185 60 140 Z"
              fill="url(#glassFrost)"
              opacity="0.6"
            />

            {/* Glass rim highlight along top edge */}
            <path
              d="M120 87 L380 87"
              stroke="url(#glassRimLight)"
              strokeWidth="1.5"
              opacity="0.5"
            />

            {/* Nose Cone */}
            <ellipse cx="430" cy="140" rx="35" ry="50" fill="url(#hullSecondary)" />
            <ellipse cx="432" cy="135" rx="25" ry="35" fill="url(#metallicSheen)" opacity="0.4" />

            {/* Tail Section */}
            <path
              d="M60 100 L30 140 L60 180 L60 100 Z"
              fill="url(#hullSecondary)"
              stroke="#1a2332"
              strokeWidth="1.5"
            />
          </g>

          {/* === PANEL LINES === */}
          <g id="panelLines" opacity="0.6">
            <line x1="150" y1="90" x2="150" y2="190" stroke="#1a2332" strokeWidth="1" />
            <line x1="220" y1="88" x2="220" y2="192" stroke="#1a2332" strokeWidth="1" />
            <line x1="290" y1="88" x2="290" y2="192" stroke="#1a2332" strokeWidth="1" />
            <line x1="360" y1="90" x2="360" y2="190" stroke="#1a2332" strokeWidth="1" />
            
            {/* Horizontal panel lines */}
            <path d="M80 120 L400 118" stroke="#1a2332" strokeWidth="0.8" opacity="0.5" />
            <path d="M80 160 L400 162" stroke="#1a2332" strokeWidth="0.8" opacity="0.5" />
          </g>

          {/* === RIVETS === */}
          <g id="rivets" fill="#2c3e50">
            {/* Top row */}
            {[100, 140, 180, 220, 260, 300, 340, 380].map((x, i) => (
              <circle key={`rivet-top-${i}`} cx={x} cy="95" r="2.5" opacity="0.7" />
            ))}
            {/* Bottom row */}
            {[100, 140, 180, 220, 260, 300, 340, 380].map((x, i) => (
              <circle key={`rivet-bottom-${i}`} cx={x} cy="185" r="2.5" opacity="0.7" />
            ))}
            {/* Side rivets */}
            {[110, 130, 150, 170].map((y, i) => (
              <React.Fragment key={`rivet-side-${i}`}>
                <circle cx="75" cy={y} r="2" opacity="0.6" />
                <circle cx="420" cy={y} r="2" opacity="0.6" />
              </React.Fragment>
            ))}
          </g>

          {/* === CONNING TOWER === */}
          <g id="conningTower">
            {/* Tower Base */}
            <rect x="200" y="50" width="80" height="45" rx="8" fill="url(#towerGradient)" stroke="#1a2332" strokeWidth="1.5" />
            
            {/* Tower Top */}
            <ellipse cx="240" cy="50" rx="40" ry="12" fill="url(#towerGradient)" stroke="#1a2332" strokeWidth="1" />
            
            {/* Periscope */}
            <rect x="235" y="25" width="10" height="30" rx="2" fill="#2c3e50" />
            <circle cx="240" cy="25" r="6" fill="#1a2332" stroke="#3d5a6c" strokeWidth="1" />
            
            {/* Tower Windows */}
            <rect x="210" y="60" width="15" height="25" rx="3" fill="url(#windowGlass)" stroke="#4a7c8f" strokeWidth="1" />
            <rect x="210" y="60" width="15" height="25" rx="3" fill="url(#windowGlow)" opacity="0.4" />
            
            <rect x="255" y="60" width="15" height="25" rx="3" fill="url(#windowGlass)" stroke="#4a7c8f" strokeWidth="1" />
            <rect x="255" y="60" width="15" height="25" rx="3" fill="url(#windowGlow)" opacity="0.4" />

            {/* Antenna Arrays */}
            <line x1="215" y1="50" x2="210" y2="30" stroke="#4a5c6d" strokeWidth="2" />
            <circle cx="210" cy="28" r="3" fill="#22d3ee" opacity="0.8">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
            
            <line x1="265" y1="50" x2="275" y2="35" stroke="#4a5c6d" strokeWidth="1.5" />
            <line x1="275" y1="35" x2="275" y2="20" stroke="#4a5c6d" strokeWidth="1" />
            <circle cx="275" cy="18" r="2" fill="#ef4444" opacity="0.9">
              <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
            </circle>

            {/* Depth Sensors */}
            <rect x="225" y="42" width="30" height="8" rx="2" fill="#1a2332" stroke="#3d5a6c" strokeWidth="0.5" />
            <rect x="228" y="44" width="6" height="4" rx="1" fill="#22d3ee" opacity="0.6" />
            <rect x="238" y="44" width="6" height="4" rx="1" fill="#22d3ee" opacity="0.4" />
            <rect x="248" y="44" width="4" height="4" rx="1" fill="#22d3ee" opacity="0.3" />
          </g>

          {/* === MAIN VIEWPORT/COCKPIT === */}
          <g id="mainViewport">
            {/* Viewport Frame */}
            <ellipse cx="400" cy="140" rx="30" ry="40" fill="#1a2332" stroke="#4a7c8f" strokeWidth="3" />
            
            {/* Dark Glass */}
            <ellipse cx="400" cy="140" rx="24" ry="34" fill="url(#windowGlass)" />
            
            {/* Interior Glow */}
            <ellipse cx="400" cy="140" rx="20" ry="28" fill="url(#windowGlow)" opacity="0.5">
              <animate attributeName="opacity" values="0.3;0.6;0.3" dur="4s" repeatCount="indefinite" />
            </ellipse>
            
            {/* Glass Reflection */}
            <ellipse cx="392" cy="125" rx="10" ry="15" fill="rgba(255,255,255,0.15)" />
          </g>

          {/* === SIDE PORTHOLES === */}
          <g id="portholes">
            {[{ x: 320, r: 14 }, { x: 270, r: 12 }, { x: 225, r: 10 }, { x: 185, r: 10 }].map((port, i) => (
              <g key={`porthole-${i}`}>
                {/* Frame */}
                <circle cx={port.x} cy="130" r={port.r + 3} fill="#2c3e50" stroke="#4a7c8f" strokeWidth="2" />
                {/* Glass */}
                <circle cx={port.x} cy="130" r={port.r} fill="url(#windowGlass)" />
                {/* Glow */}
                <circle cx={port.x} cy="130" r={port.r - 2} fill="url(#windowGlow)" opacity="0.4">
                  <animate 
                    attributeName="opacity" 
                    values="0.2;0.5;0.2" 
                    dur={`${3 + i * 0.5}s`} 
                    repeatCount="indefinite" 
                  />
                </circle>
                {/* Reflection */}
                <circle cx={port.x - 3} cy={127} r={port.r * 0.3} fill="rgba(255,255,255,0.2)" />
              </g>
            ))}
          </g>

          {/* === HATCHES === */}
          <g id="hatches">
            {/* Top Hatch */}
            <rect x="310" y="88" width="30" height="8" rx="2" fill="#3d4e5c" stroke="#2c3e50" strokeWidth="1" />
            <line x1="315" y1="92" x2="335" y2="92" stroke="#1a2332" strokeWidth="1" />
            <circle cx="340" cy="92" r="2" fill="#1a2332" />

            {/* Side Hatch */}
            <rect x="130" y="150" width="40" height="25" rx="4" fill="#3d4e5c" stroke="#2c3e50" strokeWidth="1.5" />
            <circle cx="160" cy="162" r="6" fill="#2c3e50" stroke="#4a7c8f" strokeWidth="1" />
            <line x1="157" y1="159" x2="163" y2="165" stroke="#4a7c8f" strokeWidth="1" />
            <line x1="163" y1="159" x2="157" y2="165" stroke="#4a7c8f" strokeWidth="1" />
          </g>

          {/* === PROPULSION SYSTEM === */}
          <g id="propulsion">
            {/* Propeller Housing */}
            <ellipse cx="35" cy="140" rx="25" ry="35" fill="url(#propHousingGradient)" stroke="#1a2332" strokeWidth="2" />
            
            {/* Propeller Blades */}
            <g className="propeller-spin" style={{ transformOrigin: '35px 140px' }}>
              <ellipse cx="35" cy="140" rx="3" ry="30" fill="#4a5c6d" opacity="0.8" />
              <ellipse cx="35" cy="140" rx="30" ry="3" fill="#4a5c6d" opacity="0.8" />
              <ellipse cx="35" cy="140" rx="2" ry="22" fill="#3d5a6c" opacity="0.6" transform="rotate(45 35 140)" />
              <ellipse cx="35" cy="140" rx="22" ry="2" fill="#3d5a6c" opacity="0.6" transform="rotate(45 35 140)" />
            </g>
            
            {/* Center Hub */}
            <circle cx="35" cy="140" r="8" fill="#2c3e50" stroke="#4a7c8f" strokeWidth="1" />
            <circle cx="35" cy="140" r="4" fill="#1a2332" />

            {/* Engine Glow */}
            <ellipse cx="20" cy="140" rx="15" ry="20" fill="url(#engineGlow)" opacity="0.7">
              <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
            </ellipse>
          </g>

          {/* === HEADLIGHT === */}
          <g id="headlight">
            <ellipse cx="450" cy="140" rx="8" ry="12" fill="#1a2332" stroke="#4a7c8f" strokeWidth="1" />
            <ellipse cx="452" cy="140" rx="5" ry="8" fill="url(#headlightGlow)">
              <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite" />
            </ellipse>
          </g>

          {/* === DIVING PLANES === */}
          <g id="divingPlanes">
            {/* Front planes */}
            <path d="M410 100 L440 90 L445 100 L415 108 Z" fill="#3d5a6c" stroke="#2c3e50" strokeWidth="1" />
            <path d="M410 180 L440 190 L445 180 L415 172 Z" fill="#3d5a6c" stroke="#2c3e50" strokeWidth="1" />
            
            {/* Rear planes */}
            <path d="M50 95 L25 85 L20 95 L45 103 Z" fill="#3d5a6c" stroke="#2c3e50" strokeWidth="1" />
            <path d="M50 185 L25 195 L20 185 L45 177 Z" fill="#3d5a6c" stroke="#2c3e50" strokeWidth="1" />
          </g>

          {/* === EXTERNAL EQUIPMENT === */}
          <g id="equipment">
            {/* Sonar Dome */}
            <ellipse cx="120" cy="195" rx="20" ry="8" fill="#2c3e50" stroke="#4a7c8f" strokeWidth="1" />
            <ellipse cx="120" cy="195" rx="12" ry="5" fill="#22d3ee" opacity="0.3">
              <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.5s" repeatCount="indefinite" />
            </ellipse>

            {/* Depth Gauge */}
            <circle cx="350" cy="175" r="10" fill="#2c3e50" stroke="#4a7c8f" strokeWidth="1" />
            <circle cx="350" cy="175" r="6" fill="#1a2332" />
            <line x1="350" y1="175" x2="350" y2="170" stroke="#22d3ee" strokeWidth="1">
              <animateTransform 
                attributeName="transform" 
                type="rotate" 
                from="0 350 175" 
                to="360 350 175" 
                dur="10s" 
                repeatCount="indefinite"
              />
            </line>

            {/* External Lights */}
            <circle cx="380" cy="100" r="4" fill="#ef4444" opacity="0.9">
              <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="380" cy="180" r="4" fill="#22c55e" opacity="0.9">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* === IDENTIFICATION === */}
          <g id="identification">
            {/* Hull Number */}
            <text x="250" y="145" textAnchor="middle" fill="#8a9ba8" fontSize="14" fontFamily="monospace" fontWeight="bold" opacity="0.7">
              AX-7 ABYSS
            </text>
          </g>

          {/* === AMBIENT CAUSTICS ON HULL === */}
          <g id="caustics" opacity="0.15">
            <ellipse cx="200" cy="120" rx="60" ry="20" fill="#22d3ee" className="caustic-shimmer">
              <animate attributeName="opacity" values="0.1;0.2;0.1" dur="4s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="320" cy="150" rx="40" ry="15" fill="#3b82f6" className="caustic-shimmer-delayed">
              <animate attributeName="opacity" values="0.15;0.05;0.15" dur="5s" repeatCount="indefinite" />
            </ellipse>
          </g>
        </svg>

        {/* Engine Bubble Trail */}
        <div className="absolute left-[5%] top-1/2 -translate-y-1/2">
          {mounted && bubbles.map((bubble) => (
            <div
              key={`engine-bubble-${bubble.id}`}
              className="absolute rounded-full engine-bubble"
              style={{
                width: bubble.size,
                height: bubble.size,
                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(200,220,255,0.4))',
                boxShadow: '0 0 4px rgba(255,255,255,0.3)',
                animationDelay: `${bubble.delay}s`,
                animationDuration: `${bubble.duration}s`,
                '--bubble-x': `${bubble.x}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* Foreground depth particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {mounted && [...Array(6)].map((_, i) => (
          <div
            key={`fg-particle-${i}`}
            className="absolute w-1 h-1 rounded-full bg-cyan-400/30 floating-particle"
            style={{
              left: `${10 + i * 15}%`,
              top: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.8}s`,
            }}
          />
        ))}
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        .submarine-float-premium {
          animation: submarineFloatPremium 4s ease-in-out infinite;
        }

        @keyframes submarineFloatPremium {
          0%, 100% { 
            transform: translateY(0) rotate(0deg); 
          }
          25% { 
            transform: translateY(-8px) rotate(-0.5deg); 
          }
          50% { 
            transform: translateY(-12px) rotate(0deg); 
          }
          75% { 
            transform: translateY(-6px) rotate(0.5deg); 
          }
        }

        .propeller-spin {
          animation: propellerSpin 0.5s linear infinite;
        }

        @keyframes propellerSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .headlight-beam {
          animation: headlightPulse 3s ease-in-out infinite;
        }

        @keyframes headlightPulse {
          0%, 100% { opacity: 0.8; transform: translateY(-50%) scaleX(1); }
          50% { opacity: 1; transform: translateY(-50%) scaleX(1.1); }
        }

        .engine-bubble {
          animation: engineBubbleRise var(--duration, 6s) ease-out infinite;
        }

        @keyframes engineBubbleRise {
          0% {
            transform: translate(0, 0) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translate(calc(-80px + var(--bubble-x, 0px)), -40px) scale(0.3);
            opacity: 0;
          }
        }

        .bioluminescent-particle {
          animation: biolumGlow 3s ease-in-out infinite;
        }

        @keyframes biolumGlow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.3); }
        }

        .seaweed-sway {
          animation: seaweedSway 6s ease-in-out infinite;
          transform-origin: bottom center;
        }

        .seaweed-sway-delayed {
          animation: seaweedSway 7s ease-in-out infinite 1s;
          transform-origin: bottom center;
        }

        @keyframes seaweedSway {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }

        .caustic-animation {
          animation: causticMove 10s ease-in-out infinite;
        }

        @keyframes causticMove {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 5% 5%; }
        }

        .floating-particle {
          animation: floatingParticle 8s ease-in-out infinite;
        }

        @keyframes floatingParticle {
          0%, 100% { 
            transform: translateY(0) translateX(0);
            opacity: 0.3;
          }
          25% {
            transform: translateY(-20px) translateX(5px);
            opacity: 0.6;
          }
          50% { 
            transform: translateY(-30px) translateX(-3px);
            opacity: 0.4;
          }
          75% {
            transform: translateY(-15px) translateX(8px);
            opacity: 0.5;
          }
        }

        .caustic-shimmer {
          animation: causticShimmer 4s ease-in-out infinite;
        }

        .caustic-shimmer-delayed {
          animation: causticShimmer 5s ease-in-out infinite 1.5s;
        }

        @keyframes causticShimmer {
          0%, 100% { 
            transform: translateX(0) scaleX(1);
            opacity: 0.1;
          }
          50% { 
            transform: translateX(10px) scaleX(1.2);
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  );
};

export default HeroSubmarine;
