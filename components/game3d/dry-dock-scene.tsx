"use client"

/**
 * The hangar's dry dock: one submarine on a cradle under work lights,
 * turning slowly. Drag to look around. Uses the same model as the dive.
 */

import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { useMemo, useRef } from "react"
import * as THREE from "three"
import { PALETTE, SubmarineModel } from "./deep-sea-scene"

function Turntable({ hullColor, tier }: { hullColor: string; tier: number }) {
  const group = useRef<THREE.Group>(null)
  const prop = useRef<THREE.Group | null>(null)
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )
  useFrame((_, delta) => {
    if (!reduceMotion && group.current) group.current.rotation.y += delta * 0.18
    if (!reduceMotion && prop.current) prop.current.rotation.x += delta * 1.5
  })
  // Higher tiers are bigger boats.
  const scale = 0.9 + (tier - 1) * 0.035
  return (
    <group ref={group} rotation={[0, -0.6, 0]}>
      <group position={[0, 0.62 * scale + 0.25, 0]} scale={scale}>
        <SubmarineModel hullColor={hullColor} propRef={prop} />
      </group>
      {/* cradle */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x * scale, 0.14, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.28, 1.1 * scale]} />
          <meshStandardMaterial color="#2c2b27" roughness={0.85} metalness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

export function DryDockScene({ hullColor, tier }: { hullColor: string; tier: number }) {
  return (
    <Canvas
      className="absolute inset-0"
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 30, position: [7.6, 3.5, 8.6], near: 0.1, far: 60 }}
      aria-label="Your submarine in the dry dock"
    >
      <color attach="background" args={[PALETTE.abyss]} />
      <fog attach="fog" args={[PALETTE.abyss, 11, 24]} />
      <hemisphereLight args={["#2f5f64", "#141410", 1.1]} />
      {/* overhead work lamp */}
      <spotLight
        position={[1.5, 6.5, 2]}
        color="#f2c27a"
        intensity={90}
        angle={0.55}
        penumbra={0.8}
        decay={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
      />
      {/* cold rim from behind so the silhouette reads */}
      <directionalLight position={[-4, 3, -5]} color="#6fb6b0" intensity={1.4} />

      {/* dock floor: worn concrete, with a painted lamp-orange safety line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[9, 64]} />
        <meshStandardMaterial color="#2a2b26" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[2.35, 2.42, 96]} />
        <meshBasicMaterial color={PALETTE.lamp} transparent opacity={0.55} />
      </mesh>

      <Turntable hullColor={hullColor} tier={tier} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.9}
        maxPolarAngle={1.35}
        target={[0, 0.8, 0]}
      />
    </Canvas>
  )
}

export default DryDockScene
