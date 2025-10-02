"use client"

import { useFrame } from "@react-three/fiber"
import { useRef } from "react"

export function Submarine({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const groupRef = useRef<any>(null)
  const propellerRef = useRef<any>(null)

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Gentle bobbing motion
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.1

      // Subtle rotation
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.1
    }

    if (propellerRef.current) {
      // Rotate propeller
      propellerRef.current.rotation.z += delta * 5
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Main body */}
      <mesh castShadow>
        <capsuleGeometry args={[0.5, 1.5, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Top fin */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.6]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Viewport */}
      <mesh position={[0.6, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.1} metalness={0.3} />
      </mesh>

      {/* Propeller housing */}
      <mesh position={[-0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} metalness={0.7} />
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
    </group>
  )
}
