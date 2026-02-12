"use client"

import { useFrame } from "@react-three/fiber"
import { useRef, useMemo } from "react"
import * as THREE from "three"

/* Shared material config */
const hullMat = {
  roughness: 0.15,
  metalness: 0.55,
  transparent: true as const,
  opacity: 0.88,
  clearcoat: 0.8,
  clearcoatRoughness: 0.15,
  envMapIntensity: 1.2,
}
const glassMat = {
  color: "#67e8f9",
  roughness: 0.02,
  metalness: 0.05,
  transparent: true as const,
  opacity: 0.55,
  clearcoat: 1,
  clearcoatRoughness: 0.02,
  envMapIntensity: 2.5,
}
const metalMat = { roughness: 0.25, metalness: 0.9 }

export function Submarine({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  const groupRef = useRef<any>(null)
  const propRef = useRef<any>(null)

  /* Teardrop hull profile via LatheGeometry */
  const hullGeo = useMemo(() => {
    const pts: THREE.Vector2[] = []
    const len = 2.2
    const maxR = 0.52
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const x = -len / 2 + t * len
      // elliptical cross-section, slightly fatter forward
      const r = maxR * Math.sqrt(1 - ((x + 0.15) / (len / 2 + 0.15)) ** 2)
      pts.push(new THREE.Vector2(Math.max(r, 0.001), x))
    }
    return new THREE.LatheGeometry(pts, 32)
  }, [])

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.08
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.08
    }
    if (propRef.current) propRef.current.rotation.z += delta * 5
  })

  return (
    <group ref={groupRef} position={position}>
      {/* ── Hull ── */}
      <mesh geometry={hullGeo} rotation={[0, 0, Math.PI / 2]} castShadow>
        <meshPhysicalMaterial color="#0e7490" {...hullMat} />
      </mesh>

      {/* Hull accent stripe */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.5, 0.015, 8, 32]} />
        <meshStandardMaterial color="#22d3ee" {...metalMat} />
      </mesh>
      <mesh position={[0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.48, 0.012, 8, 32]} />
        <meshStandardMaterial color="#155e75" {...metalMat} />
      </mesh>

      {/* ── Conning Tower ── */}
      <group position={[0.1, 0.45, 0]}>
        {/* Tower body — tapered */}
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.18, 0.5, 16]} />
          <meshPhysicalMaterial color="#0c4a6e" {...hullMat} />
        </mesh>
        {/* Tower cap */}
        <mesh position={[0, 0.28, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#0c4a6e" {...hullMat} />
        </mesh>
        {/* Periscope */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.35, 8]} />
          <meshStandardMaterial color="#334155" {...metalMat} />
        </mesh>
        <mesh position={[0.04, 0.68, 0]}>
          <boxGeometry args={[0.06, 0.04, 0.03]} />
          <meshStandardMaterial color="#1e293b" {...metalMat} />
        </mesh>
      </group>

      {/* ── Bow viewport ── */}
      <mesh position={[1.0, 0.05, 0]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshPhysicalMaterial {...glassMat} />
      </mesh>
      {/* Viewport frame */}
      <mesh position={[0.96, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.17, 0.02, 8, 24]} />
        <meshStandardMaterial color="#083344" {...metalMat} />
      </mesh>

      {/* Side portholes */}
      {[0.5, 0.15, -0.2].map((x, i) => (
        <group key={`port-${i}`}>
          <mesh position={[x, 0.1, 0.48]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshPhysicalMaterial {...glassMat} />
          </mesh>
          <mesh position={[x, 0.1, -0.48]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshPhysicalMaterial {...glassMat} />
          </mesh>
        </group>
      ))}

      {/* ── Dive planes (bow) ── */}
      <mesh position={[0.7, 0, 0.55]} rotation={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[0.3, 0.03, 0.25]} />
        <meshPhysicalMaterial color="#155e75" {...hullMat} />
      </mesh>
      <mesh position={[0.7, 0, -0.55]} rotation={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[0.3, 0.03, 0.25]} />
        <meshPhysicalMaterial color="#155e75" {...hullMat} />
      </mesh>

      {/* ── Stern fins (cruciform) ── */}
      {/* Horizontal */}
      <mesh position={[-0.9, 0, 0.45]} castShadow>
        <boxGeometry args={[0.35, 0.03, 0.3]} />
        <meshPhysicalMaterial color="#155e75" {...hullMat} />
      </mesh>
      <mesh position={[-0.9, 0, -0.45]} castShadow>
        <boxGeometry args={[0.35, 0.03, 0.3]} />
        <meshPhysicalMaterial color="#155e75" {...hullMat} />
      </mesh>
      {/* Vertical */}
      <mesh position={[-0.9, 0.35, 0]} castShadow>
        <boxGeometry args={[0.35, 0.3, 0.03]} />
        <meshPhysicalMaterial color="#155e75" {...hullMat} />
      </mesh>
      <mesh position={[-0.9, -0.3, 0]} castShadow>
        <boxGeometry args={[0.35, 0.25, 0.03]} />
        <meshPhysicalMaterial color="#155e75" {...hullMat} />
      </mesh>

      {/* ── Propulsion ── */}
      <group position={[-1.15, 0, 0]}>
        {/* Shroud ring */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.28, 0.025, 8, 24]} />
          <meshStandardMaterial color="#0c4a6e" {...metalMat} />
        </mesh>
        {/* Blades */}
        <group ref={propRef}>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <mesh key={deg} rotation={[0, 0, (deg * Math.PI) / 180]}>
              <boxGeometry args={[0.02, 0.24, 0.06]} />
              <meshStandardMaterial color="#334155" {...metalMat} />
            </mesh>
          ))}
          {/* Hub */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.04, 0.1, 12]} />
            <meshStandardMaterial color="#1e293b" {...metalMat} />
          </mesh>
        </group>
      </group>

      {/* ── Headlight ── */}
      <pointLight position={[1.1, 0.05, 0]} intensity={1.2} color="#e0f2fe" distance={6} />
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
    </group>
  )
}
