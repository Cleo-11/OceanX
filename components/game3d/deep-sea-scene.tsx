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
import { RoundedBox } from "@react-three/drei"
import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react"
import * as THREE from "three"
import type { PlayerPosition, ResourceNode, ResourceType } from "@/lib/types"
import { makeBoulderGeometry, makeNoduleGeometry } from "./procedural"
import { Cockpit } from "./cockpit"
import type { CameraMode } from "./camera-modes"

export { CAMERA_MODES, CAMERA_MODE_LABELS, type CameraMode } from "./camera-modes"

export const WORLD_SCALE = 1 / 20 // 2000 world units -> 100 scene units

export const PALETTE = {
  abyss: "#08242a",
  silt: "#5c5a4c",
  siltDark: "#2b2c25",
  rock: "#2a2c28",
  lamp: "#f2c27a",
  bio: "#5fe3d0",
}

const DEPOSIT_COLORS: Record<ResourceType, { base: string; accent: string }> = {
  nickel: { base: "#47514a", accent: "#7a8576" },
  cobalt: { base: "#2b3a5a", accent: "#5a6f99" },
  copper: { base: "#6a3219", accent: "#2f6b5a" }, // oxidised: rust with verdigris
  manganese: { base: "#24201c", accent: "#4a3d33" },
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
const BOULDER_VARIANTS = 5
const BOULDERS_PER_VARIANT = 64

/** Scattered boulders (five sculpted shapes, instanced) and a few old vent chimneys. */
function Rocks() {
  const rockRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const ventRef = useRef<THREE.InstancedMesh>(null)
  const VENTS = 14

  const boulders = useMemo(
    () => Array.from({ length: BOULDER_VARIANTS }, (_, i) => makeBoulderGeometry(i + 1)),
    [],
  )

  const ventGeometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.35, 0.9, 1, 18, 10, true)
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
    rockRefs.current.forEach((rocks) => {
      if (!rocks) return
      for (let i = 0; i < BOULDERS_PER_VARIANT; i++) {
        const x = -10 + rand() * 120
        const z = -10 + rand() * 120
        const big = rand() < 0.08
        const r = big ? 1.1 + rand() * 1.6 : 0.14 + rand() * 0.5
        // half-buried, upright (the silt dusting stays on top), random heading
        p.set(x, seabedHeight(x, z) - r * 0.18, z)
        e.set((rand() - 0.5) * 0.35, rand() * Math.PI * 2, (rand() - 0.5) * 0.35)
        q.setFromEuler(e)
        s.set(r * (0.85 + rand() * 0.5), r * (0.8 + rand() * 0.4), r * (0.85 + rand() * 0.5))
        rocks.setMatrixAt(i, m.compose(p, q, s))
      }
      rocks.instanceMatrix.needsUpdate = true
      rocks.computeBoundingSphere()
    })
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
      {boulders.map((g, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            rockRefs.current[i] = m
          }}
          args={[g, undefined, BOULDERS_PER_VARIANT]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial vertexColors roughness={0.93} metalness={0.02} />
        </instancedMesh>
      ))}
      <instancedMesh ref={ventRef} args={[ventGeometry, undefined, VENTS]} castShadow receiveShadow>
        <meshStandardMaterial color="#26241f" roughness={0.9} side={THREE.DoubleSide} />
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
const NODULE_VARIANTS = 4

/** Four sculpted nodule shapes per mineral, colours baked in. */
function useNoduleGeometries(): Record<ResourceType, THREE.BufferGeometry[]> {
  return useMemo(() => {
    const out = {} as Record<ResourceType, THREE.BufferGeometry[]>
    ;(Object.keys(DEPOSIT_COLORS) as ResourceType[]).forEach((type, t) => {
      const { base, accent } = DEPOSIT_COLORS[type]
      out[type] = Array.from({ length: NODULE_VARIANTS }, (_, i) => makeNoduleGeometry(t * 10 + i + 1, base, accent))
    })
    return out
  }, [])
}

function Deposit({
  node,
  targeted,
  geometries,
  insideRef,
}: {
  node: ResourceNode
  targeted: boolean
  geometries: Record<ResourceType, THREE.BufferGeometry[]>
  /** in the cockpit, the target ring must stay behind the console */
  insideRef: MutableRefObject<boolean>
}) {
  const x = node.position.x * WORLD_SCALE
  const z = node.position.y * WORLD_SCALE
  const y = seabedHeight(x, z)
  const shapes = geometries[node.type]

  const lumps = useMemo(() => {
    const rand = seeded(hashString(node.id))
    const count = Math.max(3, Math.min(9, Math.round(node.amount / 2)))
    return Array.from({ length: count }, (_, i) => {
      const a = rand() * Math.PI * 2
      const d = i === 0 ? 0 : 0.25 + rand() * 0.75
      const r = (i === 0 ? 0.42 : 0.18 + rand() * 0.24) * (0.8 + node.size / 60)
      return {
        key: i,
        // nodules lie half-sunk in the silt, top side up
        position: [Math.cos(a) * d, r * 0.2, Math.sin(a) * d] as [number, number, number],
        rotation: [(rand() - 0.5) * 0.4, rand() * Math.PI * 2, (rand() - 0.5) * 0.4] as [number, number, number],
        scale: r,
        geometry: shapes[Math.floor(rand() * shapes.length)],
      }
    })
  }, [node.id, node.amount, node.size, shapes])

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
      mat.depthTest = insideRef.current
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
            vertexColors
            roughness={node.type === "cobalt" ? 0.55 : 0.82}
            metalness={node.type === "cobalt" || node.type === "nickel" ? 0.3 : 0.08}
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
/** Hull profile (radius along the length), turned on a lathe: a long teardrop. */
const HULL_PROFILE: [number, number][] = [
  [0.0, -1.5], [0.07, -1.47], [0.2, -1.36], [0.33, -1.15], [0.44, -0.86], [0.51, -0.5],
  [0.54, -0.1], [0.54, 0.45], [0.52, 0.78], [0.47, 1.0], [0.38, 1.17], [0.25, 1.29], [0.11, 1.36], [0.0, 1.38],
]

function useHullGeometry() {
  return useMemo(() => {
    const g = new THREE.LatheGeometry(
      HULL_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      48,
    )
    g.rotateZ(-Math.PI / 2) // lathe axis (y) -> forward (x)
    // Grime: darker underneath and in streaks running aft, baked per vertex.
    const pos = g.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const under = THREE.MathUtils.smoothstep(-y, 0.0, 0.5) * 0.35
      const streak = Math.max(0, valueNoise(z * 9 + 3, x * 1.2) - 0.55) * 0.6
      const k = 1 - under - streak
      colors.set([k, k * 0.99, k * 0.97], i * 3)
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return g
  }, [])
}

/** A ducted thruster: a short shroud with a propeller inside. Axis along x. */
function DuctedThruster({
  radius,
  metal,
  propRef,
}: {
  radius: number
  metal: THREE.Material
  propRef?: MutableRefObject<THREE.Group | null>
}) {
  return (
    <group>
      <mesh rotation={[0, Math.PI / 2, 0]} material={metal} castShadow>
        <cylinderGeometry args={[radius, radius * 0.92, radius * 0.9, 28, 1, true]} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} material={metal}>
        <torusGeometry args={[radius, radius * 0.08, 8, 28]} />
      </mesh>
      <group {...(propRef ? { ref: propRef } : {})}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[(i * Math.PI) / 2, 0, 0.35]} material={metal}>
            <boxGeometry args={[0.02, radius * 1.6, radius * 0.38]} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]} material={metal}>
          <coneGeometry args={[radius * 0.22, radius * 0.5, 12]} />
        </mesh>
      </group>
    </group>
  )
}

/** Warm interior light, as seen through windows. */
const CABIN_LIGHT = "#ffc47a"

// Portholes along both sides of the hull and on the sail: [x, y, z, radius]
const PORTHOLES: [number, number, number, number][] = [
  [-0.55, 0.06, 0.545, 0.07],
  [-0.15, 0.06, 0.552, 0.07],
  [0.25, 0.06, 0.552, 0.07],
  [-0.55, 0.06, -0.545, 0.07],
  [-0.15, 0.06, -0.552, 0.07],
  [0.25, 0.06, -0.552, 0.07],
  [0.12, 0.72, 0.176, 0.04],
  [0.3, 0.72, 0.176, 0.04],
  [0.12, 0.72, -0.176, 0.04],
  [0.3, 0.72, -0.176, 0.04],
]

/**
 * Signs of life inside: lit portholes, and a cockpit behind the forward
 * viewport with a pilot and a glowing instrument panel. The light shifts now
 * and then, as if someone is moving around in the cabin; that is the only
 * animation, and it is off when the viewer prefers reduced motion.
 */
function CabinLights({ frame }: { frame: THREE.Material }) {
  const windows = useMemo(
    () =>
      PORTHOLES.map(
        () =>
          new THREE.MeshStandardMaterial({ color: "#120c05", emissive: CABIN_LIGHT, emissiveIntensity: 2.2, roughness: 0.2, toneMapped: false }),
      ),
    [],
  )
  const screen = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#081514", emissive: "#5fe3d0", emissiveIntensity: 1.4, side: THREE.DoubleSide }),
    [],
  )
  const cabinGlow = useMemo(
    // the cabin's back wall: dim, so the pilot reads as a silhouette against it
    () => new THREE.MeshStandardMaterial({ color: "#16100a", emissive: "#d98a3c", emissiveIntensity: 0.28, roughness: 0.9 }),
    [],
  )
  const pilot = useMemo(() => new THREE.MeshStandardMaterial({ color: "#151311", roughness: 0.9 }), [])
  const halo = useSoftDot()
  const pilotRef = useRef<THREE.Group>(null)
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )

  useFrame(({ clock }) => {
    if (reduceMotion) return
    const t = clock.elapsedTime
    windows.forEach((mat, i) => {
      // slow drift, plus a rare dip when someone passes the window
      const drift = 0.12 * Math.sin(t * 0.7 + i * 1.9)
      const pass = Math.max(0, Math.sin(t * 0.23 + i * 2.7) - 0.92) * 9
      mat.emissiveIntensity = 2.2 + drift - pass
    })
    // the instrument screen changes what it shows every few seconds
    screen.emissiveIntensity = 1.2 + 0.35 * Math.sign(Math.sin(t * 0.45)) + 0.08 * Math.sin(t * 9)
    // the pilot glances around
    if (pilotRef.current) pilotRef.current.rotation.y = Math.sin(t * 0.3) * 0.5 + Math.sin(t * 1.1) * 0.08
  })

  return (
    <>
      {PORTHOLES.map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, z < 0 ? Math.PI : 0, 0]}>
          <mesh material={windows[i]}>
            <circleGeometry args={[r, 20]} />
          </mesh>
          <mesh material={frame} position={[0, 0, 0.004]}>
            <torusGeometry args={[r, r * 0.17, 6, 20]} />
          </mesh>
          {/* light spilling out into the water */}
          <sprite position={[0, 0, 0.02]} scale={[r * 5, r * 5, 1]}>
            <spriteMaterial map={halo} color={CABIN_LIGHT} transparent opacity={0.32} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </group>
      ))}

      {/* skylights along the top of the fairing (what you see from above) */}
      {[-0.55, -0.2, 0.15].map((x, i) => (
        <group key={x} position={[x - 0.05, 0.585, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh material={windows[i]}>
            <planeGeometry args={[0.16, 0.09]} />
          </mesh>
          <sprite position={[0, 0, 0.02]} scale={[0.5, 0.5, 1]}>
            <spriteMaterial map={halo} color={CABIN_LIGHT} transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
        </group>
      ))}

      {/* cockpit, seen through the forward viewport */}
      {/* bulkhead behind the pilot: a dark, warmly lit cabin wall */}
      <mesh position={[1.27, -0.06, 0]} rotation={[0, Math.PI / 2, 0]} material={cabinGlow}>
        <circleGeometry args={[0.235, 28]} />
      </mesh>
      <group ref={pilotRef} position={[1.42, -0.15, 0]}>
        <mesh material={pilot} position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.05, 12, 10]} />
        </mesh>
        <mesh material={pilot} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.045, 0.09, 4, 10]} />
        </mesh>
      </group>
      <mesh position={[1.55, -0.2, 0]} rotation={[0, -Math.PI / 2, 0.3]} material={screen}>
        <planeGeometry args={[0.14, 0.06]} />
      </mesh>
      <pointLight position={[1.47, 0.08, 0]} color={CABIN_LIGHT} intensity={0.8} distance={0.7} decay={2} />
    </>
  )
}

/**
 * The submarine (forward is +x), modelled on deep research submersibles:
 * a white syntactic-foam body with a painted upper fairing in the tier
 * colour, a forward viewport, a manipulator arm and sample basket, lamp bar,
 * and ducted thrusters. Shared by the dive scene and the hangar; `propRef`
 * lets the owner spin the main propeller.
 */
export function SubmarineModel({
  hullColor,
  propRef,
  children,
}: {
  hullColor: string
  propRef?: MutableRefObject<THREE.Group | null>
  children?: ReactNode
}) {
  const hull = useHullGeometry()
  const ownPropRef = useRef<THREE.Group | null>(null)
  const m = useMemo(() => {
    const paint = new THREE.Color(hullColor).lerp(new THREE.Color("#6b6a62"), 0.25)
    return {
      body: new THREE.MeshStandardMaterial({ color: "#d9d6cc", vertexColors: true, roughness: 0.55, metalness: 0.05 }),
      paint: new THREE.MeshStandardMaterial({ color: paint, roughness: 0.45, metalness: 0.15 }),
      metal: new THREE.MeshStandardMaterial({ color: "#5d5f5c", roughness: 0.42, metalness: 0.75 }),
      dark: new THREE.MeshStandardMaterial({ color: "#1f2322", roughness: 0.7, metalness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: "#9fc4c4", roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }),
      lamp: new THREE.MeshStandardMaterial({ color: "#2a2722", emissive: PALETTE.lamp, emissiveIntensity: 2.4 }),
      strobe: new THREE.MeshStandardMaterial({ color: "#552", emissive: "#f2a33a", emissiveIntensity: 1.2 }),
    }
  }, [hullColor])

  return (
    <>
      {/* pressure body */}
      <mesh geometry={hull} material={m.body} castShadow receiveShadow />

      {/* painted upper fairing and sail */}
      <RoundedBox args={[2.05, 0.3, 0.7]} radius={0.12} smoothness={4} position={[-0.05, 0.43, 0]} material={m.paint} castShadow />
      <RoundedBox args={[0.6, 0.34, 0.34]} radius={0.12} smoothness={4} position={[0.2, 0.7, 0]} material={m.paint} castShadow />
      {/* sail: hatch, antenna, strobe */}
      <mesh position={[0.05, 0.89, 0]} material={m.metal}>
        <cylinderGeometry args={[0.1, 0.11, 0.04, 20]} />
      </mesh>
      <mesh position={[0.4, 1.02, 0]} material={m.dark}>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 6]} />
      </mesh>
      <mesh position={[0.4, 1.21, 0]} material={m.strobe}>
        <sphereGeometry args={[0.03, 10, 8]} />
      </mesh>
      {/* handrails along the fairing */}
      {[-0.37, 0.37].map((z) => (
        <mesh key={z} position={[-0.05, 0.52, z]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
          <cylinderGeometry args={[0.014, 0.014, 1.5, 6]} />
        </mesh>
      ))}

      {/* forward acrylic bubble where the pilot sits, with a bolted ring */}
      <mesh position={[1.38, -0.06, 0]} material={m.glass} renderOrder={3}>
        <sphereGeometry args={[0.27, 32, 20]} />
      </mesh>
      <mesh position={[1.22, -0.06, 0]} rotation={[0, Math.PI / 2, 0]} material={m.metal}>
        <torusGeometry args={[0.215, 0.026, 8, 32]} />
      </mesh>

      {/* the crew's lights */}
      <CabinLights frame={m.metal} />

      {/* lamp bar across the bow */}
      <mesh position={[1.05, -0.38, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.metal}>
        <cylinderGeometry args={[0.02, 0.02, 0.86, 8]} />
      </mesh>
      {[-0.36, -0.12, 0.12, 0.36].map((z) => (
        <group key={z} position={[1.1, -0.38, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={m.dark}>
            <cylinderGeometry args={[0.055, 0.065, 0.09, 14]} />
          </mesh>
          <mesh position={[0.046, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.lamp}>
            <circleGeometry args={[0.05, 14]} />
          </mesh>
        </group>
      ))}

      {/* manipulator arm (starboard), folded forward */}
      <group position={[0.9, -0.42, 0.26]}>
        <mesh material={m.metal}>
          <sphereGeometry args={[0.055, 12, 10]} />
        </mesh>
        <mesh position={[0.15, -0.06, 0]} rotation={[0, 0, Math.PI / 2 + 0.4]} material={m.paint}>
          <cylinderGeometry args={[0.03, 0.035, 0.32, 10]} />
        </mesh>
        <mesh position={[0.3, -0.13, 0]} material={m.metal}>
          <sphereGeometry args={[0.04, 10, 8]} />
        </mesh>
        <mesh position={[0.43, -0.1, 0]} rotation={[0, 0, Math.PI / 2 - 0.25]} material={m.paint}>
          <cylinderGeometry args={[0.025, 0.03, 0.26, 10]} />
        </mesh>
        {[-0.03, 0.03].map((dz) => (
          <mesh key={dz} position={[0.58, -0.07, dz]} rotation={[0, dz * 6, 0]} material={m.dark}>
            <boxGeometry args={[0.1, 0.02, 0.016]} />
          </mesh>
        ))}
      </group>

      {/* sample basket under the bow */}
      <group position={[0.7, -0.6, 0]}>
        <mesh material={m.dark}>
          <boxGeometry args={[0.5, 0.02, 0.56]} />
        </mesh>
        {[-0.25, 0.25].map((x) =>
          [-0.28, 0.28].map((z) => (
            <mesh key={`${x}${z}`} position={[x, 0.07, z]} material={m.metal}>
              <boxGeometry args={[0.02, 0.14, 0.02]} />
            </mesh>
          )),
        )}
        {[-0.28, 0.28].map((z) => (
          <mesh key={z} position={[0, 0.14, z]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
            <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
          </mesh>
        ))}
      </group>

      {/* skids */}
      {[-0.34, 0.34].map((z) => (
        <group key={z}>
          <mesh position={[-0.05, -0.66, z]} rotation={[0, 0, Math.PI / 2]} material={m.metal} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 2.0, 8]} />
          </mesh>
          {[-0.6, 0.45].map((x) => (
            <mesh key={x} position={[x, -0.56, z * 0.85]} rotation={[z > 0 ? -0.3 : 0.3, 0, 0]} material={m.metal}>
              <boxGeometry args={[0.04, 0.22, 0.03]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ballast / battery pods */}
      {[-0.5, 0.5].map((z) => (
        <mesh key={z} position={[-0.25, -0.3, z]} rotation={[0, 0, Math.PI / 2]} material={m.paint} castShadow>
          <capsuleGeometry args={[0.1, 0.7, 6, 14]} />
        </mesh>
      ))}

      {/* stern: main ducted thruster on a short shaft, plus vertical thrusters */}
      <mesh position={[-1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
        <cylinderGeometry args={[0.035, 0.035, 0.18, 8]} />
      </mesh>
      <group position={[-1.62, 0, 0]}>
        <DuctedThruster radius={0.2} metal={m.metal} propRef={propRef ?? ownPropRef} />
      </group>
      {[-0.42, 0.42].map((z) => (
        <group key={z} position={[-1.1, 0.12, z]} rotation={[0, 0, Math.PI / 2]}>
          <DuctedThruster radius={0.11} metal={m.metal} />
        </group>
      ))}
      {/* stabilisers */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[-1.25, 0, side * 0.32]} material={m.paint} castShadow>
          <boxGeometry args={[0.32, 0.03, 0.22]} />
        </mesh>
      ))}

      {children}
    </>
  )
}

function Submarine({
  playerRef,
  hullColor,
  followRef,
  insideRef,
}: {
  playerRef: MutableRefObject<PlayerPosition>
  hullColor: string
  followRef: MutableRefObject<THREE.Vector3>
  /** true while the camera is in the pilot's seat: the hull is hidden so it can't clip into view */
  insideRef: MutableRefObject<boolean>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const hullRef = useRef<THREE.Group>(null)
  const propRef = useRef<THREE.Group | null>(null)
  const lightTarget = useMemo(() => new THREE.Object3D(), [])
  const spotRef = useRef<THREE.SpotLight>(null)
  const last = useRef({ x: NaN, y: NaN, speed: 0 })
  const smoothPos = useRef(new THREE.Vector3())
  const initialised = useRef(false)

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
    if (hullRef.current) hullRef.current.visible = !insideRef.current
    followRef.current.copy(smoothPos.current)

    const moved = Number.isFinite(last.current.x) ? Math.hypot(p.x - last.current.x, p.y - last.current.y) : 0
    last.current.x = p.x
    last.current.y = p.y
    last.current.speed += ((moved > 0.01 ? 1 : 0) - last.current.speed) * Math.min(1, delta * 4)
    if (propRef.current) propRef.current.rotation.x += delta * (2 + last.current.speed * 22)
  })

  return (
    <group ref={groupRef}>
      <group ref={hullRef}>
        <SubmarineModel hullColor={hullColor} propRef={propRef} />
      </group>
      <>
        {/* the lamp: the only warm light in the scene */}
        <primitive object={lightTarget} position={[7, -3.2, 0]} />
        <spotLight
          ref={spotRef}
          position={[1.15, -0.38, 0]}
          color={PALETTE.lamp}
          intensity={200}
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
        <pointLight position={[0, 1.9, 0.6]} color="#a8c8c2" intensity={18} distance={6.5} decay={2} />
        {/* lamp spill under and around the hull */}
        <pointLight position={[1.4, -1.2, 0]} color={PALETTE.lamp} intensity={2.5} distance={6} decay={1.8} />
      </>
    </group>
  )
}

/** Shortest signed difference between two angles. */
const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

function FollowCamera({
  followRef,
  playerRef,
  framing,
  mode,
  insideRef,
}: {
  insideRef: MutableRefObject<boolean>
  followRef: MutableRefObject<THREE.Vector3>
  playerRef: MutableRefObject<PlayerPosition>
  framing: { x: number; z: number }
  mode: CameraMode
}) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3())
  const heading = useRef<number | null>(null)
  const ready = useRef(false)
  const lastMode = useRef(mode)

  useFrame((_, delta) => {
    const f = followRef.current
    // Heading in scene space: the 2D game rotation maps to yaw -rotation.
    const target = playerRef.current.rotation
    if (heading.current === null) heading.current = target
    const turnRate = mode === "cockpit" ? 14 : 4
    heading.current += angleDelta(heading.current, target) * (1 - Math.exp(-delta * turnRate))
    const h = heading.current
    const fwd = new THREE.Vector3(Math.cos(h), 0, Math.sin(h))

    let desired: THREE.Vector3
    let focus: THREE.Vector3
    if (mode === "cockpit") {
      // the pilot's eye, inside the acrylic bubble, looking down the lamp beam
      desired = f.clone().addScaledVector(fwd, 1.5).add(new THREE.Vector3(0, -0.02, 0))
      focus = desired.clone().addScaledVector(fwd, 10).add(new THREE.Vector3(0, -2.6, 0))
    } else if (mode === "chase") {
      desired = f.clone().addScaledVector(fwd, -6.2).add(new THREE.Vector3(0, 2.9, 0))
      focus = f.clone().addScaledVector(fwd, 3.5).add(new THREE.Vector3(0, -0.4, 0))
    } else {
      // framing shifts the view so the submarine sits off-centre (e.g. to
      // leave room for text on the landing page)
      focus = f.clone().add(new THREE.Vector3(framing.x, 0, framing.z))
      desired = new THREE.Vector3(focus.x, focus.y + 15, focus.z + 11)
    }

    // Snap on the first frame; ease on a mode switch; then follow. The
    // cockpit is rigidly attached to the hull, so it follows tightly.
    const switching = lastMode.current !== mode
    if (!ready.current) {
      camera.position.copy(desired)
      look.current.copy(focus)
      ready.current = true
    }
    const rate = mode === "cockpit" && !switching ? 18 : mode === "chase" ? 4 : 3
    const k = 1 - Math.exp(-delta * rate)
    camera.position.lerp(desired, k)
    look.current.lerp(focus, k)
    camera.lookAt(look.current)
    // wider lens in the cockpit, a touch wider when chasing
    const cam = camera as THREE.PerspectiveCamera
    const fov = mode === "cockpit" ? 64 : mode === "chase" ? 50 : 40
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * (1 - Math.exp(-delta * 4))
      cam.updateProjectionMatrix()
    }
    if (switching && camera.position.distanceTo(desired) < 0.05) lastMode.current = mode
    // swap the hull for the cockpit once the camera is nearly in the seat
    insideRef.current = mode === "cockpit" && camera.position.distanceTo(desired) < 0.9
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
  /** Offset of the camera target from the submarine, in scene units (overhead view). */
  framing?: { x: number; z: number }
  /** Overhead (default), third-person chase, or first-person cockpit. */
  cameraMode?: CameraMode
}

const CENTRED = { x: 0, z: 0 }

export function DeepSeaScene({
  playerRef,
  nodes,
  targetNodeId,
  hullColor,
  isMining,
  framing = CENTRED,
  cameraMode = "overhead",
}: DeepSeaSceneProps) {
  const followRef = useRef(new THREE.Vector3(25, 0, 25))
  const insideRef = useRef(false)
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
      <fogExp2 attach="fog" args={[PALETTE.abyss, 0.031]} />
      <hemisphereLight args={["#559aa0", "#26261d", 3.1]} />
      <directionalLight position={[20, 40, 10]} color="#7fb0b5" intensity={0.9} />

      <Seabed />
      <Rocks />
      {nodes.map((n) => (
        <Deposit key={n.id} node={n} targeted={n.id === targetNodeId} geometries={geometries} insideRef={insideRef} />
      ))}
      <Submarine playerRef={playerRef} hullColor={hullColor} followRef={followRef} insideRef={insideRef} />
      <SiltPlume origin={plumeOrigin} active={isMining} />
      <MarineSnow followRef={followRef} />
      <FollowCamera followRef={followRef} playerRef={playerRef} framing={framing} mode={cameraMode} insideRef={insideRef} />
      {/* after the camera, so it reads this frame's camera position */}
      <Cockpit playerRef={playerRef} nodes={nodes} heightAt={seabedHeight} visibleRef={insideRef} />
    </Canvas>
  )
}

export default DeepSeaScene
