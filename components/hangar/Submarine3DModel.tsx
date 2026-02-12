"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

/**
 * Submarine3DModel – Hangar display submarine
 *
 * Uses LatheGeometry for a proper teardrop hull, tapered conning tower,
 * cruciform stern fins, 6-blade propeller with shroud, portholes,
 * and tier-specific accent lights.
 */

interface Submarine3DModelProps {
  tier: number
  color: string
}

/* Shared material configs */
const hullProps = (c: string) => ({
  color: c,
  roughness: 0.15,
  metalness: 0.55,
  transparent: true as const,
  opacity: 0.88,
  clearcoat: 0.8,
  clearcoatRoughness: 0.15,
  envMapIntensity: 1.2,
})
const glassProps = {
  color: "#67e8f9",
  roughness: 0.02,
  metalness: 0.05,
  transparent: true as const,
  opacity: 0.55,
  clearcoat: 1,
  clearcoatRoughness: 0.02,
  envMapIntensity: 2.5,
}
const metalProps = { roughness: 0.25, metalness: 0.9 }

export function Submarine3DModel({ tier, color }: Submarine3DModelProps) {
  const groupRef = useRef<any>(null)
  const propRef = useRef<any>(null)

  /* Teardrop hull via LatheGeometry */
  const hullGeo = useMemo(() => {
    const pts: THREE.Vector2[] = []
    const len = 2.2
    const maxR = 0.52
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const x = -len / 2 + t * len
      const r = maxR * Math.sqrt(1 - ((x + 0.15) / (len / 2 + 0.15)) ** 2)
      pts.push(new THREE.Vector2(Math.max(r, 0.001), x))
    }
    return new THREE.LatheGeometry(pts, 32)
  }, [])

  useFrame((state, delta) => {
    if (propRef.current) propRef.current.rotation.x += delta * 4
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.08
      groupRef.current.rotation.y += delta * 0.15
    }
  })

  const scale = 0.8 + tier * 0.08

  return (
    <group ref={groupRef} scale={scale}>
      {/* ── Hull ── */}
      <mesh geometry={hullGeo} rotation={[0, 0, Math.PI / 2]} castShadow>
        <meshPhysicalMaterial {...hullProps(color)} />
      </mesh>

      {/* Hull accent rings */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.5, 0.015, 8, 32]} />
        <meshStandardMaterial color="#22d3ee" {...metalProps} />
      </mesh>
      <mesh position={[0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.47, 0.012, 8, 32]} />
        <meshStandardMaterial color={color} {...metalProps} />
      </mesh>

      {/* ── Conning Tower ── */}
      <group position={[0.1, 0.45, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.18, 0.5, 16]} />
          <meshPhysicalMaterial {...hullProps(color)} opacity={0.92} />
        </mesh>
        <mesh position={[0, 0.28, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial {...hullProps(color)} />
        </mesh>
        {/* Periscope */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.35, 8]} />
          <meshStandardMaterial color="#334155" {...metalProps} />
        </mesh>
        <mesh position={[0.04, 0.68, 0]}>
          <boxGeometry args={[0.06, 0.04, 0.03]} />
          <meshStandardMaterial color="#1e293b" {...metalProps} />
        </mesh>
      </group>

      {/* ── Bow viewport ── */}
      <mesh position={[1.0, 0.05, 0]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshPhysicalMaterial {...glassProps} />
      </mesh>
      <mesh position={[0.96, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.17, 0.02, 8, 24]} />
        <meshStandardMaterial color="#083344" {...metalProps} />
      </mesh>

      {/* Side portholes */}
      {[0.5, 0.15, -0.2].map((x, i) => (
        <group key={`port-${i}`}>
          <mesh position={[x, 0.1, 0.48]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshPhysicalMaterial {...glassProps} />
          </mesh>
          <mesh position={[x, 0.1, -0.48]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshPhysicalMaterial {...glassProps} />
          </mesh>
        </group>
      ))}

      {/* ── Dive planes ── */}
      <mesh position={[0.7, 0, 0.55]} castShadow>
        <boxGeometry args={[0.3, 0.03, 0.25]} />
        <meshPhysicalMaterial {...hullProps(color)} />
      </mesh>
      <mesh position={[0.7, 0, -0.55]} castShadow>
        <boxGeometry args={[0.3, 0.03, 0.25]} />
        <meshPhysicalMaterial {...hullProps(color)} />
      </mesh>

      {/* ── Stern fins ── */}
      <mesh position={[-0.9, 0, 0.45]} castShadow>
        <boxGeometry args={[0.35, 0.03, 0.3]} />
        <meshPhysicalMaterial {...hullProps(color)} />
      </mesh>
      <mesh position={[-0.9, 0, -0.45]} castShadow>
        <boxGeometry args={[0.35, 0.03, 0.3]} />
        <meshPhysicalMaterial {...hullProps(color)} />
      </mesh>
      <mesh position={[-0.9, 0.35, 0]} castShadow>
        <boxGeometry args={[0.35, 0.3, 0.03]} />
        <meshPhysicalMaterial {...hullProps(color)} />
      </mesh>
      <mesh position={[-0.9, -0.3, 0]} castShadow>
        <boxGeometry args={[0.35, 0.25, 0.03]} />
        <meshPhysicalMaterial {...hullProps(color)} />
      </mesh>

      {/* ── Propulsion ── */}
      <group position={[-1.15, 0, 0]}>
        {/* Shroud */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.28, 0.025, 8, 24]} />
          <meshStandardMaterial color="#0c4a6e" {...metalProps} />
        </mesh>
        {/* Blades */}
        <group ref={propRef}>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <mesh key={deg} rotation={[0, 0, (deg * Math.PI) / 180]}>
              <boxGeometry args={[0.02, 0.24, 0.06]} />
              <meshStandardMaterial color="#334155" {...metalProps} />
            </mesh>
          ))}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.04, 0.1, 12]} />
            <meshStandardMaterial color="#1e293b" {...metalProps} />
          </mesh>
        </group>
      </group>

      {/* ── Headlight ── */}
      <pointLight position={[1.1, 0.05, 0]} intensity={1} color="#e0f2fe" distance={5} />
      <mesh position={[1.14, 0.05, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#e0f2fe" emissiveIntensity={3} />
      </mesh>

      {/* ── Tier indicator lights ── */}
      {Array.from({ length: Math.min(tier, 5) }).map((_, i) => (
        <mesh key={i} position={[0.1 - i * 0.12, 0.95, 0]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial 
            color={tier >= 8 ? "#f59e0b" : "#22d3ee"} 
            emissive={tier >= 8 ? "#f59e0b" : "#22d3ee"} 
            emissiveIntensity={1.8} 
          />
        </mesh>
      ))}

      {/* Nav lights */}
      <mesh position={[0.3, 0.52, 0.15]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.3, 0.52, -0.15]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}
