"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Mesh } from "three"

/**
 * Submarine3DModel Component
 * 
 * 3D submarine model using Three.js primitives
 * Creates a simple submarine shape with:
 * - Main hull (cylinder)
 * - Conning tower
 * - Propellers
 * - Color based on tier
 * 
 * For production, replace with actual 3D models (GLTF/GLB files)
 */

interface Submarine3DModelProps {
  tier: number
  color: string
}

export function Submarine3DModel({ tier, color }: Submarine3DModelProps) {
  const groupRef = useRef<any>(null)
  const propellerRef = useRef<Mesh>(null)

  // Rotate propeller
  useFrame((state, delta) => {
    if (propellerRef.current) {
      propellerRef.current.rotation.x += delta * 5
    }
    // Gentle floating animation
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
  })

  // Scale based on tier (higher tier = bigger submarine)
  const scale = 0.8 + (tier * 0.1)

  return (
    <group ref={groupRef} scale={scale}>
      {/* Main Hull */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 2, 32]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Front Nose Cone */}
      <mesh position={[1.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.4, 0.6, 32]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Rear Cone */}
      <mesh position={[-1.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.4, 0.6, 32]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Conning Tower */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.3]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Tower Top */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.3, 16]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Propeller (animated) */}
      <group position={[-1.7, 0, 0]}>
        <mesh ref={propellerRef}>
          {/* Blade 1 */}
          <boxGeometry args={[0.05, 0.6, 0.1]} />
          <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Blade 2 */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.05, 0.6, 0.1]} />
          <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Center hub */}
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* Side fins */}
      <mesh position={[0.5, -0.3, 0.4]} rotation={[0, 0, Math.PI / 6]}>
        <boxGeometry args={[0.4, 0.05, 0.3]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0.5, -0.3, -0.4]} rotation={[0, 0, Math.PI / 6]}>
        <boxGeometry args={[0.4, 0.05, 0.3]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Rear fins */}
      <mesh position={[-1.3, 0.3, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.3, 0.05, 0.3]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Windows/Lights */}
      <mesh position={[0.8, 0.1, 0.35]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.8, 0.1, -0.35]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
      </mesh>

      {/* Tier indicator lights on tower */}
      {Array.from({ length: Math.min(tier, 5) }).map((_, i) => (
        <mesh key={i} position={[0.1 - i * 0.15, 0.95, 0]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial 
            color={tier >= 8 ? "#ffaa00" : "#00ff00"} 
            emissive={tier >= 8 ? "#ffaa00" : "#00ff00"} 
            emissiveIntensity={1.5} 
          />
        </mesh>
      ))}
    </group>
  )
}
