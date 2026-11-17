"use client"

/**
 * The play view as a 3D deep-sea scene (react-three-fiber).
 *
 * Game logic is unchanged and still lives in ocean-mining-game.tsx in 2D
 * world units (0..2000 on x and y). This component only draws that state:
 * world (x, y) maps to scene (x, z) at WORLD_SCALE, seen from an angled
 * top-down camera that follows the submarine.
 *
 * Art direction: a night dive. Murky water and fog hide everything beyond
 * the submarine's lamp; the only cold light is bioluminescence marking
 * deposits you can mine.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, type MutableRefObject } from "react"
import * as THREE from "three"
import type { PlayerPosition, ResourceNode, ResourceType } from "@/lib/types"

export const WORLD_SCALE = 1 / 20 // 2000 world units -> 100 scene units

const PALETTE = {
  abyss: "#04161a",
  silt: "#5c5a4c",
  siltDark: "#2b2c25",
  rock: "#2a2c28",
  lamp: "#f2c27a",
  bio: "#5fe3d0",
}

const DEPOSIT_COLORS: Record<ResourceType, { base: string; accent: string }> = {
  nickel: { base: "#4f5a51", accent: "#69756a" },
  cobalt: { base: "#34476b", accent: "#4b5f86" },
  copper: { base: "#8a4524", accent: "#3f7a67" }, // oxidised: rust with verdigris
  manganese: { base: "#2e2722", accent: "#4a3d33" },
}

// ── deterministic noise ─────────────────────────────────────────────────────
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
const smooth = (t: number) => t * t * (3 - 2 * t)
function valueNoise(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}
function fbm(x: number, y: number) {
  let v = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < 5; i++) {
    v += amp * valueNoise(x * f, y * f)
    f *= 2.03
    amp *= 0.5
  }
  return v
}

/** Seabed height at a scene position (shared by everything that sits on it). */
export function seabedHeight(x: number, z: number) {
  const broad = fbm(x * 0.035, z * 0.035) * 4.2
  const detail = fbm(x * 0.22 + 40, z * 0.22 + 17) * 0.55
  // current-formed sediment ripples, bent by the broad terrain
  const warp = fbm(x * 0.05 + 3, z * 0.05 - 7) * 6
  const ripples = Math.sin(x * 1.7 + z * 0.6 + warp) * 0.045
  const grit = (valueNoise(x * 1.9, z * 1.9) - 0.5) * 0.09
  return broad + detail + ripples + grit - 2.6
}

const seeded = (seed: number) => {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const hashString = (str: string) => {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ── seabed ──────────────────────────────────────────────────────────────────
function Seabed() {
  const geometry = useMemo(() => {
    const size = 140
    const seg = 320
    const geo = new THREE.PlaneGeometry(size, size, seg, seg)
    geo.rotateX(-Math.PI / 2)
    geo.translate(50, 0, 50)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const silt = new THREE.Color(PALETTE.silt)
    const dark = new THREE.Color(PALETTE.siltDark)
    const tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, seabedHeight(x, z))
      // darker silt in the hollows and in patchy streaks
      const patch = fbm(x * 0.09 + 5, z * 0.09 + 9)
      tmp.copy(silt).lerp(dark, THREE.MathUtils.clamp(patch * 1.6 - 0.45, 0, 1))
      // grain: per-vertex speckle so the lamp picks out texture
      tmp.multiplyScalar(0.82 + hash(x * 3.1, z * 3.1) * 0.3)
      colors.set([tmp.r, tmp.g, tmp.b], i * 3)
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  )
}

/** Scattered boulders and a few extinct vent chimneys, placed once. */
function Rocks() {
  const rockRef = useRef<THREE.InstancedMesh>(null)
  const ventRef = useRef<THREE.InstancedMesh>(null)
  const ROCKS = 320
  const VENTS = 14

  const rockGeometry = useMemo(() => {
    const g = new THREE.DodecahedronGeometry(1, 1)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i)
      v.multiplyScalar(0.75 + valueNoise(v.x * 2.1 + 3, v.y * 2.1 + v.z) * 0.5)
      p.setXYZ(i, v.x, v.y * 0.7, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])

  const ventGeometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.35, 0.9, 1, 9, 6, true)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const k = 1 + (valueNoise(x * 3 + y * 5, z * 3) - 0.5) * 0.45
      p.setXYZ(i, x * k, y, z * k)
    }
    g.translate(0, 0.5, 0)
    g.computeVertexNormals()
    return g
  }, [])

  useEffect(() => {
    const rand = seeded(7)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const rocks = rockRef.current
    if (rocks) {
      for (let i = 0; i < ROCKS; i++) {
        const x = -10 + rand() * 120
        const z = -10 + rand() * 120
        const big = rand() < 0.08
        const r = big ? 1.2 + rand() * 1.8 : 0.15 + rand() * 0.55
        p.set(x, seabedHeight(x, z) - r * 0.25, z)
        e.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
        q.setFromEuler(e)
        s.set(r * (0.8 + rand() * 0.6), r, r * (0.8 + rand() * 0.6))
        rocks.setMatrixAt(i, m.compose(p, q, s))
      }
      rocks.instanceMatrix.needsUpdate = true
    }
    const vents = ventRef.current
    if (vents) {
      for (let i = 0; i < VENTS; i++) {
        const x = rand() * 100
        const z = rand() * 100
        const h = 1.5 + rand() * 3.5
        p.set(x, seabedHeight(x, z) - 0.2, z)
        e.set((rand() - 0.5) * 0.15, rand() * Math.PI, (rand() - 0.5) * 0.15)
        q.setFromEuler(e)
        s.set(0.8 + rand() * 0.6, h, 0.8 + rand() * 0.6)
        vents.setMatrixAt(i, m.compose(p, q, s))
      }
      vents.instanceMatrix.needsUpdate = true
    }
  }, [])

  return (
    <>
      <instancedMesh ref={rockRef} args={[rockGeometry, undefined, ROCKS]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.rock} roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={ventRef} args={[ventGeometry, undefined, VENTS]} castShadow receiveShadow>
        <meshStandardMaterial color="#1f1d1a" roughness={0.9} side={THREE.DoubleSide} flatShading />
      </instancedMesh>
    </>
  )
}

/** A round, soft-edged sprite (points render as squares without one). */
function useSoftDot() {
  return useMemo(() => {
    const c = document.createElement("canvas")
    c.width = c.height = 64
    const g = c.getContext("2d")!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, "rgba(255,255,255,1)")
    grad.addColorStop(0.45, "rgba(255,255,255,0.55)")
    grad.addColorStop(1, "rgba(255,255,255,0)")
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

// ── marine snow: organic flakes drifting down, always around the camera ────
function MarineSnow({ followRef }: { followRef: MutableRefObject<THREE.Vector3> }) {
  const COUNT = 1600
  const SPAN = { x: 44, y: 16, z: 40 }
  const pointsRef = useRef<THREE.Points>(null)
  const flake = useSoftDot()
  const { base, speeds, geometry } = useMemo(() => {
    const rand = seeded(42)
    const base = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      base[i * 3] = rand() * SPAN.x
      base[i * 3 + 1] = rand() * SPAN.y
      base[i * 3 + 2] = rand() * SPAN.z
      speeds[i] = 0.15 + rand() * 0.35
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    return { base, speeds, geometry }
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const c = followRef.current
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const wrap = (v: number, span: number) => ((v % span) + span) % span
    for (let i = 0; i < COUNT; i++) {
      const sx = base[i * 3] + Math.sin(t * 0.3 + i) * 0.4
      const sy = base[i * 3 + 1] - t * speeds[i]
      const sz = base[i * 3 + 2] + Math.cos(t * 0.21 + i * 0.7) * 0.4
      arr[i * 3] = c.x - SPAN.x / 2 + wrap(sx - c.x, SPAN.x)
      arr[i * 3 + 1] = c.y - 3 + wrap(sy, SPAN.y)
      arr[i * 3 + 2] = c.z - SPAN.z / 2 + wrap(sz - c.z, SPAN.z)
    }
    pos.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial map={flake} color="#b4c2ba" size={0.09} sizeAttenuation transparent opacity={0.6} alphaTest={0.02} depthWrite={false} />
    </points>
  )
}

// ── deposits: clusters of lumpy polymetallic nodules ───────────────────────
function useNoduleGeometries() {
  return useMemo(
    () =>
      Array.from({ length: 6 }, (_, k) => {
        const g = new THREE.IcosahedronGeometry(1, 2)
        const p = g.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < p.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(p, i)
          const n = valueNoise(v.x * 2.4 + k * 9, v.y * 2.4 + v.z * 1.7 + k)
          const n2 = valueNoise(v.x * 6 + k, v.z * 6 - k)
          v.multiplyScalar(0.72 + n * 0.45 + n2 * 0.12)
          p.setXYZ(i, v.x, v.y * 0.68, v.z)
        }
        g.computeVertexNormals()
        return g
      }),
    [],
  )
}

function Deposit({
  node,
  targeted,
  geometries,
}: {
  node: ResourceNode
  targeted: boolean
  geometries: THREE.BufferGeometry[]
}) {
  const x = node.position.x * WORLD_SCALE
  const z = node.position.y * WORLD_SCALE
  const y = seabedHeight(x, z)
  const colors = DEPOSIT_COLORS[node.type]

  const lumps = useMemo(() => {
    const rand = seeded(hashString(node.id))
    const count = Math.max(3, Math.min(9, Math.round(node.amount / 2)))
    return Array.from({ length: count }, (_, i) => {
      const a = rand() * Math.PI * 2
      const d = i === 0 ? 0 : 0.25 + rand() * 0.75
      const r = (i === 0 ? 0.42 : 0.18 + rand() * 0.24) * (0.8 + node.size / 60)
      return {
        key: i,
        position: [Math.cos(a) * d, r * 0.35, Math.sin(a) * d] as [number, number, number],
        rotation: [rand() * 3, rand() * 3, rand() * 3] as [number, number, number],
        scale: r,
        geometry: geometries[Math.floor(rand() * geometries.length)],
        accent: i > 0 && rand() < 0.3,
      }
    })
  }, [node.id, node.amount, node.size, geometries])

  // Bioluminescent specks: a few faint lights that cut through the dark so
  // deposits can be found without the lamp. Not fogged, very small.
  const specks = useMemo(() => {
    const rand = seeded(hashString(node.id) ^ 0x9e3779b9)
    return Array.from({ length: 5 }, () => ({
      p: [(rand() - 0.5) * 1.8, 0.15 + rand() * 0.5, (rand() - 0.5) * 1.8] as [number, number, number],
      phase: rand() * Math.PI * 2,
    }))
  }, [node.id])
  const speckRefs = useRef<(THREE.Mesh | null)[]>([])
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    speckRefs.current.forEach((m, i) => {
      if (!m) return
      const mat = m.material as THREE.MeshBasicMaterial
      mat.opacity = 0.25 + 0.55 * Math.max(0, Math.sin(t * 0.8 + specks[i].phase))
    })
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = targeted ? 0.3 + 0.18 * Math.sin(t * 2.4) : 0
    }
  })

  if (node.depleted) return null

  return (
    <group position={[x, y, z]}>
      {lumps.map((l) => (
        <mesh
          key={l.key}
          geometry={l.geometry}
          position={l.position}
          rotation={l.rotation}
          scale={l.scale}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={l.accent ? colors.accent : colors.base}
            roughness={node.type === "cobalt" ? 0.55 : 0.85}
            metalness={node.type === "cobalt" || node.type === "nickel" ? 0.35 : 0.1}
          />
        </mesh>
      ))}
      {specks.map((s, i) => (
        <mesh key={i} position={s.p} ref={(m) => {
            speckRefs.current[i] = m
          }}>
          <sphereGeometry args={[0.035, 6, 6]} />
          <meshBasicMaterial color={PALETTE.bio} transparent opacity={0.5} fog={false} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} renderOrder={2}>
        <ringGeometry args={[1.5, 1.56, 64]} />
        <meshBasicMaterial color={PALETTE.bio} transparent opacity={0} fog={false} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  )
}

/** Silt kicked up while drilling. */
function SiltPlume({ origin, active }: { origin: THREE.Vector3 | null; active: boolean }) {
  const COUNT = 140
  const startRef = useRef(-1)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    return g
  }, [])
  const dirs = useMemo(() => {
    const rand = seeded(99)
    return Array.from({ length: COUNT }, () => [rand() - 0.5, rand(), rand() - 0.5, 0.4 + rand()])
  }, [])
  const matRef = useRef<THREE.PointsMaterial>(null)
  const puff = useSoftDot()

  useFrame(({ clock }) => {
    const mat = matRef.current
    if (!mat) return
    if (active && origin && startRef.current < 0) startRef.current = clock.elapsedTime
    if (startRef.current < 0 || !origin) {
      mat.opacity = 0
      return
    }
    const age = clock.elapsedTime - startRef.current
    if (age > 3.5) {
      startRef.current = -1
      mat.opacity = 0
      return
    }
    const arr = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
    const spread = 1 - Math.exp(-age * 1.4)
    for (let i = 0; i < COUNT; i++) {
      const [dx, dy, dz, sp] = dirs[i]
      arr[i * 3] = origin.x + dx * 3.2 * spread * sp
      arr[i * 3 + 1] = origin.y + 0.1 + dy * 1.6 * spread * sp
      arr[i * 3 + 2] = origin.z + dz * 3.2 * spread * sp
    }
    geometry.attributes.position.needsUpdate = true
    mat.opacity = 0.65 * Math.max(0, 1 - age / 3.5)
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial ref={matRef} map={puff} color="#cfc4a6" size={2.6} sizeAttenuation transparent opacity={0} depthWrite={false} />
    </points>
  )
}

// ── submarine ───────────────────────────────────────────────────────────────
function Submarine({
  playerRef,
  hullColor,
  followRef,
}: {
  playerRef: MutableRefObject<PlayerPosition>
  hullColor: string
  followRef: MutableRefObject<THREE.Vector3>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const propRef = useRef<THREE.Group>(null)
  const lightTarget = useMemo(() => new THREE.Object3D(), [])
  const spotRef = useRef<THREE.SpotLight>(null)
  const last = useRef({ x: NaN, y: NaN, speed: 0 })
  const smoothPos = useRef(new THREE.Vector3())
  const initialised = useRef(false)

  // Weathered paint: the tier colour, pulled towards grey.
  const paint = useMemo(() => new THREE.Color(hullColor).lerp(new THREE.Color("#5b5a52"), 0.35), [hullColor])

  useEffect(() => {
    if (spotRef.current) spotRef.current.target = lightTarget
  }, [lightTarget])

  useFrame(({ clock }, delta) => {
    const g = groupRef.current
    if (!g) return
    const p = playerRef.current
    const x = p.x * WORLD_SCALE
    const z = p.y * WORLD_SCALE
    const ground = seabedHeight(x, z)
    const t = clock.elapsedTime
    const target = new THREE.Vector3(x, Math.max(ground, -1.5) + 2.4 + Math.sin(t * 0.9) * 0.08, z)
    if (!initialised.current) {
      smoothPos.current.copy(target)
      initialised.current = true
    }
    smoothPos.current.lerp(target, 1 - Math.exp(-delta * 10))
    g.position.copy(smoothPos.current)
    g.rotation.y = -p.rotation
    g.rotation.z = Math.sin(t * 0.7) * 0.03
    followRef.current.copy(smoothPos.current)

    const moved = Number.isFinite(last.current.x) ? Math.hypot(p.x - last.current.x, p.y - last.current.y) : 0
    last.current.x = p.x
    last.current.y = p.y
    last.current.speed += ((moved > 0.01 ? 1 : 0) - last.current.speed) * Math.min(1, delta * 4)
    if (propRef.current) propRef.current.rotation.x += delta * (2 + last.current.speed * 22)
  })

  return (
    <group ref={groupRef}>
      {/* pressure hull: forward is +x */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.52, 1.7, 8, 20]} />
        <meshStandardMaterial color={paint} roughness={0.62} metalness={0.35} />
      </mesh>
      {/* hull bands */}
      {[-0.55, 0.15, 0.75].map((bx) => (
        <mesh key={bx} position={[bx, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.53, 0.025, 8, 32]} />
          <meshStandardMaterial color="#2b2a26" roughness={0.6} metalness={0.6} />
        </mesh>
      ))}
      {/* side thrusters */}
      {[-0.6, 0.6].map((zz) => (
        <mesh key={zz} position={[-0.55, -0.1, zz]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.42, 14]} />
          <meshStandardMaterial color="#3d3b35" roughness={0.55} metalness={0.6} />
        </mesh>
      ))}
      {/* hatch */}
      <mesh position={[-0.1, 0.79, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.05, 16]} />
        <meshStandardMaterial color="#3a3a35" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* sail */}
      <mesh position={[-0.1, 0.55, 0]} castShadow>
        <boxGeometry args={[0.75, 0.42, 0.34]} />
        <meshStandardMaterial color={paint} roughness={0.7} metalness={0.3} />
      </mesh>
      {/* viewport */}
      <mesh position={[1.22, 0.05, 0]}>
        <sphereGeometry args={[0.26, 20, 16]} />
        <meshStandardMaterial color="#0c1a1c" roughness={0.08} metalness={0.9} emissive="#3a2a12" emissiveIntensity={0.35} />
      </mesh>
      {/* skids */}
      {[-0.32, 0.32].map((zz) => (
        <mesh key={zz} position={[0.05, -0.55, zz]} castShadow>
          <boxGeometry args={[1.9, 0.06, 0.07]} />
          <meshStandardMaterial color="#3a3934" roughness={0.8} metalness={0.5} />
        </mesh>
      ))}
      {/* lamp housings */}
      {[-0.3, 0.3].map((zz) => (
        <mesh key={zz} position={[1.05, -0.32, zz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.09, 0.14, 12]} />
          <meshStandardMaterial color="#262521" emissive={PALETTE.lamp} emissiveIntensity={2.2} />
        </mesh>
      ))}
      {/* tail fins + propeller */}
      <mesh position={[-1.25, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.9, 0.05]} />
        <meshStandardMaterial color={paint} roughness={0.7} />
      </mesh>
      <mesh position={[-1.25, 0, 0]} castShadow>
        <boxGeometry args={[0.4, 0.05, 0.9]} />
        <meshStandardMaterial color={paint} roughness={0.7} />
      </mesh>
      <group ref={propRef} position={[-1.52, 0, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[(i * Math.PI * 2) / 3, 0, 0]} position={[0, 0, 0]}>
            <boxGeometry args={[0.04, 0.5, 0.1]} />
            <meshStandardMaterial color="#6d5a3a" roughness={0.4} metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* the lamp: the only warm light in the scene */}
      <primitive object={lightTarget} position={[7, -3.2, 0]} />
      <spotLight
        ref={spotRef}
        position={[1.1, -0.3, 0]}
        color={PALETTE.lamp}
        intensity={240}
        distance={42}
        angle={0.78}
        penumbra={0.65}
        decay={1.35}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
      />
      {/* faint fill so the hull reads against the dark */}
      <pointLight position={[0, 1.8, 0.6]} color="#9dbfb8" intensity={12} distance={6} decay={2} />
      {/* lamp spill under and around the hull */}
      <pointLight position={[1.4, -1.2, 0]} color={PALETTE.lamp} intensity={2.5} distance={6} decay={1.8} />
    </group>
  )
}

function FollowCamera({ followRef }: { followRef: MutableRefObject<THREE.Vector3> }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3())
  const ready = useRef(false)
  useFrame((_, delta) => {
    const f = followRef.current
    const desired = new THREE.Vector3(f.x, f.y + 15, f.z + 11)
    if (!ready.current) {
      camera.position.copy(desired)
      look.current.copy(f)
      ready.current = true
    }
    const k = 1 - Math.exp(-delta * 3)
    camera.position.lerp(desired, k)
    look.current.lerp(f, k)
    camera.lookAt(look.current)
  })
  return null
}

export interface DeepSeaSceneProps {
  /** Live player position (read every frame, so it never lags a render). */
  playerRef: MutableRefObject<PlayerPosition>
  nodes: ResourceNode[]
  targetNodeId: string | null
  hullColor: string
  isMining: boolean
}

export function DeepSeaScene({ playerRef, nodes, targetNodeId, hullColor, isMining }: DeepSeaSceneProps) {
  const followRef = useRef(new THREE.Vector3(25, 0, 25))
  const geometries = useNoduleGeometries()
  const target = nodes.find((n) => n.id === targetNodeId) ?? null
  const plumeOrigin = useMemo(() => {
    if (!target) return null
    const x = target.position.x * WORLD_SCALE
    const z = target.position.y * WORLD_SCALE
    return new THREE.Vector3(x, seabedHeight(x, z), z)
  }, [target?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Canvas
      className="absolute inset-0"
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: 40, near: 0.1, far: 90, position: [25, 15, 36] }}
      aria-label="Seabed around your submarine"
    >
      <color attach="background" args={[PALETTE.abyss]} />
      <fogExp2 attach="fog" args={[PALETTE.abyss, 0.038]} />
      <hemisphereLight args={["#3d7f86", "#1a1a14", 2.4]} />
      <directionalLight position={[20, 40, 10]} color="#5f8f96" intensity={0.5} />

      <Seabed />
      <Rocks />
      {nodes.map((n) => (
        <Deposit key={n.id} node={n} targeted={n.id === targetNodeId} geometries={geometries} />
      ))}
      <Submarine playerRef={playerRef} hullColor={hullColor} followRef={followRef} />
      <SiltPlume origin={plumeOrigin} active={isMining} />
      <MarineSnow followRef={followRef} />
      <FollowCamera followRef={followRef} />
    </Canvas>
  )
}

export default DeepSeaScene
