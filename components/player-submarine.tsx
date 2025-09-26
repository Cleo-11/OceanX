"use client"

import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import type * as THREE from "three"

interface PlayerSubmarineProps {
  position: [number, number, number]
  rotation: [number, number, number]
  tier: number
  isMoving: boolean
}

export function PlayerSubmarine({ position, rotation, tier, isMoving }: PlayerSubmarineProps) {
  const groupRef = useRef<THREE.Group>(null)
  const propellerRef = useRef<THREE.Mesh>(null)
  const bubbleTimeRef = useRef(0)
  const bubblePositionsRef = useRef<Array<{ pos: [number, number, number]; size: number; speed: number }>>([])

  const submarineData = getSubmarineByTier(tier)
  const submarineColor = submarineData.color

  useFrame((_, delta) => {
    if (propellerRef.current) {
      // Rotate propeller faster when moving
      propellerRef.current.rotation.z += delta * (isMoving ? 10 : 3)
    }

    // Create bubbles when moving
    if (isMoving) {
      bubbleTimeRef.current += delta

      if (bubbleTimeRef.current > 0.2) {
        bubbleTimeRef.current = 0

        // Add new bubble
        if (bubblePositionsRef.current.length < 15) {
          bubblePositionsRef.current.push({
            pos: [
              position[0] + Math.random() * 0.5 - 0.25,
              position[1] - 0.3,
              position[2] + Math.random() * 0.5 - 0.25,
            ],
            size: Math.random() * 0.1 + 0.05,
            speed: Math.random() * 0.5 + 0.5,
          })
        }
      }
    }

    // Update bubbles
    for (let i = 0; i < bubblePositionsRef.current.length; i++) {
      const bubble = bubblePositionsRef.current[i]
      bubble.pos[1] += bubble.speed * delta

      // Remove bubbles that have risen too high
      if (bubble.pos[1] > position[1] + 5) {
        bubblePositionsRef.current.splice(i, 1)
        i--
      }
    }
  })

  return (
    <>
      <group ref={groupRef} position={position} rotation={rotation}>
        {/* Main body */}
        <mesh castShadow>
          <capsuleGeometry args={[0.5, 1.5, 16, 16]} />
          <meshStandardMaterial color={submarineColor} roughness={0.3} metalness={0.7} />
        </mesh>

        {/* Top fin */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.1, 0.4, 0.6]} />
          <meshStandardMaterial color={submarineColor} roughness={0.3} metalness={0.7} />
        </mesh>

        {/* Viewport */}
        <mesh position={[0.6, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#7dd3fc" roughness={0.1} metalness={0.3} />
        </mesh>

        {/* Propeller housing */}
        <mesh position={[-0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
          <meshStandardMaterial color={submarineColor} roughness={0.3} metalness={0.7} />
        </mesh>

        {/* Propeller */}
        <mesh ref={propellerRef} position={[-1, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.3, 0.03, 16, 4]} />
          <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.8} />
        </mesh>

        {/* Lights */}
        <pointLight position={[0.8, 0, 0]} intensity={1} color="#ffffff" distance={5} />
        <mesh position={[0.8, 0, 0]} castShadow>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
        </mesh>

        {/* Tier-specific decorations for higher tiers */}
        {tier >= 3 && (
          <mesh position={[0, -0.3, 0]} castShadow>
            <boxGeometry args={[0.8, 0.2, 0.4]} />
            <meshStandardMaterial color={submarineColor} roughness={0.3} metalness={0.7} />
          </mesh>
        )}

        {tier >= 5 && (
          <>
            <mesh position={[0, 0, 0.6]} rotation={[0, 0, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.1, 0.8, 8]} />
              <meshStandardMaterial color={submarineColor} roughness={0.3} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0, -0.6]} rotation={[0, 0, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.1, 0.8, 8]} />
              <meshStandardMaterial color={submarineColor} roughness={0.3} metalness={0.7} />
            </mesh>
          </>
        )}

        {tier >= 7 && <pointLight position={[0, 0.5, 0]} intensity={0.5} color="#0ea5e9" distance={3} />}
      </group>

      {/* Bubbles */}
      {bubblePositionsRef.current.map((bubble, index) => (
        <mesh key={index} position={bubble.pos}>
          <sphereGeometry args={[bubble.size, 8, 8]} />
          <meshStandardMaterial color="#7dd3fc" transparent opacity={0.6} />
        </mesh>
      ))}
    </>
  )
}
