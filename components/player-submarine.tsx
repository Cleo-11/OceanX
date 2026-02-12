"use client"

import { useFrame } from "@react-three/fiber"
import { useRef, useMemo } from "react"
import * as THREE from "three"
import { getSubmarineByTier } from "@/lib/submarine-tiers"

interface PlayerSubmarineProps {
  position: [number, number, number]
  rotation: [number, number, number]
  tier: number
  isMoving: boolean
}

/* Shared material helpers */
const hull = (color: string) => ({
  color,
  roughness: 0.15,
  metalness: 0.55,
  transparent: true as const,
  opacity: 0.88,
  clearcoat: 0.8,
  clearcoatRoughness: 0.15,
  envMapIntensity: 1.2,
})
const glass = {
  color: "#67e8f9",
  roughness: 0.02,
  metalness: 0.05,
  transparent: true as const,
  opacity: 0.55,
  clearcoat: 1,
  clearcoatRoughness: 0.02,
  envMapIntensity: 2.5,
}
const metal = { roughness: 0.25, metalness: 0.9 }

export function PlayerSubmarine({ position, rotation, tier, isMoving }: PlayerSubmarineProps) {
  const groupRef = useRef<any>(null)
  const propRef = useRef<any>(null)
  const bubbleTimeRef = useRef(0)
  const bubblePositionsRef = useRef<Array<{ pos: [number, number, number]; size: number; speed: number }>>([])

  const submarineData = getSubmarineByTier(tier)
  const c = submarineData.color

  /* Teardrop hull */
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

  useFrame((_, delta) => {
    if (propRef.current) propRef.current.rotation.z += delta * (isMoving ? 12 : 3)

    if (isMoving) {
      bubbleTimeRef.current += delta
      if (bubbleTimeRef.current > 0.2) {
        bubbleTimeRef.current = 0
        if (bubblePositionsRef.current.length < 15) {
          bubblePositionsRef.current.push({
            pos: [
              position[0] + Math.random() * 0.5 - 0.25,
              position[1] - 0.3,
              position[2] + Math.random() * 0.5 - 0.25,
            ],
            size: Math.random() * 0.08 + 0.03,
            speed: Math.random() * 0.5 + 0.5,
          })
        }
      }
    }

    for (let i = 0; i < bubblePositionsRef.current.length; i++) {
      const b = bubblePositionsRef.current[i]
      b.pos[1] += b.speed * delta
      if (b.pos[1] > position[1] + 5) { bubblePositionsRef.current.splice(i, 1); i-- }
    }
  })

  return (
    <>
      <group ref={groupRef} position={position} rotation={rotation}>
        {/* ── Hull ── */}
        <mesh geometry={hullGeo} rotation={[0, 0, Math.PI / 2]} castShadow>
          <meshPhysicalMaterial {...hull(c)} />
        </mesh>

        {/* Hull accent rings */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.5, 0.015, 8, 32]} />
          <meshStandardMaterial color="#22d3ee" {...metal} />
        </mesh>
        <mesh position={[0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.48, 0.012, 8, 32]} />
          <meshStandardMaterial color={c} {...metal} />
        </mesh>

        {/* ── Conning Tower ── */}
        <group position={[0.1, 0.45, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.12, 0.18, 0.5, 16]} />
            <meshPhysicalMaterial {...hull(c)} opacity={0.92} />
          </mesh>
          <mesh position={[0, 0.28, 0]} castShadow>
            <sphereGeometry args={[0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial {...hull(c)} />
          </mesh>
          {/* Periscope */}
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.35, 8]} />
            <meshStandardMaterial color="#334155" {...metal} />
          </mesh>
          <mesh position={[0.04, 0.68, 0]}>
            <boxGeometry args={[0.06, 0.04, 0.03]} />
            <meshStandardMaterial color="#1e293b" {...metal} />
          </mesh>
        </group>

        {/* ── Bow viewport ── */}
        <mesh position={[1.0, 0.05, 0]} castShadow>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshPhysicalMaterial {...glass} />
        </mesh>
        <mesh position={[0.96, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.17, 0.02, 8, 24]} />
          <meshStandardMaterial color="#083344" {...metal} />
        </mesh>

        {/* Side portholes */}
        {[0.5, 0.15, -0.2].map((x, i) => (
          <group key={`port-${i}`}>
            <mesh position={[x, 0.1, 0.48]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshPhysicalMaterial {...glass} />
            </mesh>
            <mesh position={[x, 0.1, -0.48]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshPhysicalMaterial {...glass} />
            </mesh>
          </group>
        ))}

        {/* ── Dive planes ── */}
        <mesh position={[0.7, 0, 0.55]} rotation={[0, 0, 0.1]} castShadow>
          <boxGeometry args={[0.3, 0.03, 0.25]} />
          <meshPhysicalMaterial {...hull(c)} />
        </mesh>
        <mesh position={[0.7, 0, -0.55]} rotation={[0, 0, 0.1]} castShadow>
          <boxGeometry args={[0.3, 0.03, 0.25]} />
          <meshPhysicalMaterial {...hull(c)} />
        </mesh>

        {/* ── Stern fins ── */}
        <mesh position={[-0.9, 0, 0.45]} castShadow>
          <boxGeometry args={[0.35, 0.03, 0.3]} />
          <meshPhysicalMaterial {...hull(c)} />
        </mesh>
        <mesh position={[-0.9, 0, -0.45]} castShadow>
          <boxGeometry args={[0.35, 0.03, 0.3]} />
          <meshPhysicalMaterial {...hull(c)} />
        </mesh>
        <mesh position={[-0.9, 0.35, 0]} castShadow>
          <boxGeometry args={[0.35, 0.3, 0.03]} />
          <meshPhysicalMaterial {...hull(c)} />
        </mesh>
        <mesh position={[-0.9, -0.3, 0]} castShadow>
          <boxGeometry args={[0.35, 0.25, 0.03]} />
          <meshPhysicalMaterial {...hull(c)} />
        </mesh>

        {/* ── Propulsion ── */}
        <group position={[-1.15, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.28, 0.025, 8, 24]} />
            <meshStandardMaterial color="#0c4a6e" {...metal} />
          </mesh>
          <group ref={propRef}>
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <mesh key={deg} rotation={[0, 0, (deg * Math.PI) / 180]}>
                <boxGeometry args={[0.02, 0.24, 0.06]} />
                <meshStandardMaterial color="#334155" {...metal} />
              </mesh>
            ))}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.05, 0.04, 0.1, 12]} />
              <meshStandardMaterial color="#1e293b" {...metal} />
            </mesh>
          </group>
        </group>

        {/* ── Headlight ── */}
        <pointLight position={[1.1, 0.05, 0]} intensity={1.4} color="#e0f2fe" distance={6} />
        <mesh position={[1.14, 0.05, 0]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#e0f2fe" emissiveIntensity={3} />
        </mesh>

        {/* Nav lights */}
        <mesh position={[0.3, 0.52, 0.15]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} />
        </mesh>
        <mesh position={[0.3, 0.52, -0.15]}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} />
        </mesh>

        {/* ── Tier-specific upgrades ── */}

        {/* Tier 3+: cargo bay */}
        {tier >= 3 && (
          <mesh position={[0, -0.45, 0]} castShadow>
            <boxGeometry args={[0.9, 0.15, 0.3]} />
            <meshPhysicalMaterial {...hull(c)} opacity={0.85} />
          </mesh>
        )}

        {/* Tier 5+: torpedo tubes */}
        {tier >= 5 && (
          <>
            <mesh position={[0.85, -0.15, 0.35]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.3, 12]} />
              <meshPhysicalMaterial {...hull(c)} opacity={0.9} />
            </mesh>
            <mesh position={[0.85, -0.15, -0.35]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.3, 12]} />
              <meshPhysicalMaterial {...hull(c)} opacity={0.9} />
            </mesh>
          </>
        )}

        {/* Tier 7+: glowing energy aura */}
        {tier >= 7 && (
          <pointLight position={[0, 0.5, 0]} intensity={0.6} color={c} distance={3} />
        )}

        {/* Tier 10+: antenna array */}
        {tier >= 10 && (
          <group position={[-0.2, 0.72, 0]}>
            <mesh>
              <cylinderGeometry args={[0.01, 0.01, 0.25, 6]} />
              <meshStandardMaterial color="#94a3b8" {...metal} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.5} />
            </mesh>
          </group>
        )}
      </group>

      {/* Bubbles */}
      {bubblePositionsRef.current.map((bubble, index) => (
        <mesh key={index} position={bubble.pos}>
          <sphereGeometry args={[bubble.size, 8, 8]} />
          <meshStandardMaterial color="#a5f3fc" transparent opacity={0.45} />
        </mesh>
      ))}
    </>
  )
}
