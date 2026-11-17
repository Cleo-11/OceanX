"use client"

/**
 * Life on the abyssal plain, modelled on what ROV surveys of nodule fields
 * actually find: sea pigs (Scotoplanes) grazing the silt, brittle stars,
 * stalked sea lilies, glass sponges, rattail fish cruising just above the
 * bottom, drifting jellyfish, and tiny amphipods drawn to the lamp.
 *
 * Everything is instanced (one draw call per species) and purely visual:
 * none of it affects gameplay. Glowing animals use violet, not cyan, because
 * cyan is reserved for things the player can mine.
 */

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef, type MutableRefObject } from "react"
import * as THREE from "three"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

type HeightAt = (x: number, z: number) => number

const seeded = (seed: number) => {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const usePrefersReducedMotion = () =>
  useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, [])

/** Strip uv so geometries from different generators can be merged. */
const prep = (g: THREE.BufferGeometry) => {
  const out = g.index ? g.toNonIndexed() : g
  out.deleteAttribute("uv")
  return out
}

// ── geometry ────────────────────────────────────────────────────────────────

/** Sea pig: a plump, translucent pink cucumber with tube feet and papillae. Forward is +x. */
function seaPigGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.CapsuleGeometry(0.075, 0.2, 6, 14)
  body.rotateZ(Math.PI / 2)
  body.scale(1, 0.75, 1)
  parts.push(prep(body))
  for (let i = 0; i < 6; i++) {
    for (const side of [-1, 1]) {
      const foot = new THREE.ConeGeometry(0.014, 0.05, 6)
      foot.rotateX(Math.PI)
      foot.translate(-0.11 + i * 0.045, -0.06, side * 0.055)
      parts.push(prep(foot))
    }
  }
  // the "legs" on top that give sea pigs their face
  for (const [x, z, r] of [
    [0.1, 0.03, -0.35],
    [0.1, -0.03, 0.35],
    [0.06, 0.035, -0.2],
    [0.06, -0.035, 0.2],
  ]) {
    const papilla = new THREE.ConeGeometry(0.01, 0.07, 6)
    papilla.rotateZ(-0.6)
    papilla.rotateX(r)
    papilla.translate(x, 0.075, z)
    parts.push(prep(papilla))
  }
  return mergeGeometries(parts)!
}

/** Brittle star: a small disc and five long, curling arms lying on the silt. */
function brittleStarGeometry(seed: number) {
  const rand = seeded(seed)
  const parts: THREE.BufferGeometry[] = [prep(new THREE.CylinderGeometry(0.05, 0.055, 0.02, 10))]
  for (let a = 0; a < 5; a++) {
    const base = (a / 5) * Math.PI * 2 + rand() * 0.2
    const curl = (rand() - 0.5) * 1.6
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 6; i++) {
      const t = i / 6
      const ang = base + curl * t * t
      const r = 0.04 + t * (0.38 + rand() * 0.08)
      pts.push(new THREE.Vector3(Math.cos(ang) * r, 0.006 + Math.sin(t * Math.PI) * 0.025, Math.sin(ang) * r))
    }
    parts.push(prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.008, 4, false)))
  }
  return mergeGeometries(parts)!
}

/** Stalked sea lily: a long thin stalk and a crown of feathery arms. */
function crinoidGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const stalk = new THREE.CylinderGeometry(0.008, 0.014, 1, 6)
  stalk.translate(0, 0.5, 0)
  parts.push(prep(stalk))
  for (let a = 0; a < 10; a++) {
    const ang = (a / 10) * Math.PI * 2
    const pts = [0, 0.33, 0.66, 1].map((t) => {
      const r = 0.02 + t * 0.2
      return new THREE.Vector3(Math.cos(ang) * r, 1 + Math.sin(t * Math.PI * 0.8) * 0.12 - t * t * 0.08, Math.sin(ang) * r)
    })
    parts.push(prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.006, 4, false)))
  }
  return mergeGeometries(parts)!
}

/** Glass sponge: a tall, open vase. */
function spongeGeometry() {
  // a squat, slightly bulging barrel with a flared lip, like Euplectella or Hyalonema
  const profile = [
    [0.05, 0],
    [0.11, 0.06],
    [0.16, 0.2],
    [0.17, 0.32],
    [0.15, 0.44],
    [0.14, 0.5],
    [0.17, 0.54],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const g = new THREE.LatheGeometry(profile, 18)
  // lumpy, so no two read as turned on a lathe
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const a = Math.atan2(z, x)
    const k = 1 + Math.sin(a * 3 + y * 9) * 0.07 + Math.sin(a * 5 - y * 4) * 0.04
    pos.setXYZ(i, x * k, y, z * k)
  }
  g.computeVertexNormals()
  return g
}

/** Rattail (grenadier): big head, body tapering to a long whip tail. Forward is +x. */
function rattailGeometry() {
  const profile = [
    [0.0, -0.62],
    [0.008, -0.5],
    [0.02, -0.3],
    [0.04, -0.1],
    [0.06, 0.05],
    [0.07, 0.13],
    [0.06, 0.2],
    [0.035, 0.25],
    [0.0, 0.27],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  const body = new THREE.LatheGeometry(profile, 10)
  body.rotateZ(-Math.PI / 2)
  body.scale(1, 1.15, 0.7)
  const fin = new THREE.ConeGeometry(0.03, 0.1, 4)
  fin.translate(0.08, 0.09, 0)
  return mergeGeometries([prep(body), prep(fin)])!
}

/** Jellyfish bell. */
function bellGeometry() {
  const profile = [
    [0.0, 0.12],
    [0.06, 0.11],
    [0.11, 0.07],
    [0.14, 0.02],
    [0.15, 0.0],
    [0.13, -0.01],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  return new THREE.LatheGeometry(profile, 18)
}

// ── species ─────────────────────────────────────────────────────────────────

interface FaunaProps {
  heightAt: HeightAt
  /** the submarine's position (smoothed), in scene units */
  followRef: MutableRefObject<THREE.Vector3>
  /** where the lamp beam lands, in scene units */
  lampTargetRef?: MutableRefObject<THREE.Vector3>
  /** scene-space area to populate: [minX, minZ, maxX, maxZ] */
  bounds?: [number, number, number, number]
}

/** Static seabed life: brittle stars, sea lilies, glass sponges. */
function SessileLife({ heightAt, bounds }: { heightAt: HeightAt; bounds: [number, number, number, number] }) {
  const stars = useMemo(() => [brittleStarGeometry(3), brittleStarGeometry(11)], [])
  const crinoid = useMemo(() => crinoidGeometry(), [])
  const sponge = useMemo(() => spongeGeometry(), [])
  const starRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const crinoidRef = useRef<THREE.InstancedMesh>(null)
  const spongeRef = useRef<THREE.InstancedMesh>(null)
  const STARS = 170
  const CRINOIDS = 90
  const SPONGES = 55
  const reduce = usePrefersReducedMotion()
  const crinoidData = useRef<{ x: number; z: number; y: number; h: number; yaw: number; phase: number }[]>([])

  useEffect(() => {
    const rand = seeded(2024)
    const [x0, z0, x1, z1] = bounds
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const place = () => {
      const x = x0 + rand() * (x1 - x0)
      const z = z0 + rand() * (z1 - z0)
      return { x, z, y: heightAt(x, z) }
    }
    starRefs.current.forEach((mesh) => {
      if (!mesh) return
      for (let i = 0; i < STARS; i++) {
        const { x, z, y } = place()
        e.set(0, rand() * Math.PI * 2, 0)
        const k = 0.7 + rand() * 0.6
        mesh.setMatrixAt(i, m.compose(p.set(x, y + 0.01, z), q.setFromEuler(e), s.set(k, k, k)))
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    })
    crinoidData.current = Array.from({ length: CRINOIDS }, () => {
      const { x, z, y } = place()
      return { x, z, y, h: 0.7 + rand() * 0.8, yaw: rand() * Math.PI * 2, phase: rand() * 10 }
    })
    const c = crinoidRef.current
    if (c) {
      crinoidData.current.forEach((d, i) => {
        e.set(0, d.yaw, 0)
        c.setMatrixAt(i, m.compose(p.set(d.x, d.y, d.z), q.setFromEuler(e), s.set(1, d.h, 1)))
      })
      c.instanceMatrix.needsUpdate = true
      c.computeBoundingSphere()
    }
    const sp = spongeRef.current
    if (sp) {
      for (let i = 0; i < SPONGES; i++) {
        const { x, z, y } = place()
        e.set((rand() - 0.5) * 0.1, rand() * Math.PI, (rand() - 0.5) * 0.1)
        const k = 0.7 + rand() * 0.9
        sp.setMatrixAt(i, m.compose(p.set(x, y - 0.02, z), q.setFromEuler(e), s.set(k, k * (0.9 + rand() * 0.6), k)))
      }
      sp.instanceMatrix.needsUpdate = true
      sp.computeBoundingSphere()
    }
  }, [bounds, heightAt])

  // sea lilies sway in the current
  useFrame(({ clock }) => {
    const c = crinoidRef.current
    if (!c || reduce || crinoidData.current.length === 0) return
    const t = clock.elapsedTime
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    crinoidData.current.forEach((d, i) => {
      e.set(Math.sin(t * 0.6 + d.phase) * 0.06, d.yaw, Math.cos(t * 0.45 + d.phase) * 0.06)
      c.setMatrixAt(i, m.compose(p.set(d.x, d.y, d.z), q.setFromEuler(e), s.set(1, d.h, 1)))
    })
    c.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      {stars.map((g, i) => (
        <instancedMesh
          key={i}
          ref={(m) => {
            starRefs.current[i] = m
          }}
          args={[g, undefined, STARS]}
          receiveShadow
        >
          <meshStandardMaterial color={i ? "#b98d6a" : "#c9a882"} roughness={0.8} />
        </instancedMesh>
      ))}
      <instancedMesh ref={crinoidRef} args={[crinoid, undefined, CRINOIDS]} castShadow>
        <meshStandardMaterial color="#d8cfa6" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={spongeRef} args={[sponge, undefined, SPONGES]} castShadow receiveShadow>
        <meshStandardMaterial
          color="#a9a58d"
          roughness={0.9}
          transparent
          opacity={0.62}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </>
  )
}

/** Sea pigs: slow grazers that wander the silt, turning now and then. */
function SeaPigs({ heightAt, bounds }: { heightAt: HeightAt; bounds: [number, number, number, number] }) {
  const COUNT = 70
  const geometry = useMemo(() => seaPigGeometry(), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  const reduce = usePrefersReducedMotion()
  const pigs = useMemo(() => {
    const rand = seeded(77)
    const [x0, z0, x1, z1] = bounds
    return Array.from({ length: COUNT }, () => ({
      x: x0 + rand() * (x1 - x0),
      z: z0 + rand() * (z1 - z0),
      heading: rand() * Math.PI * 2,
      turn: (rand() - 0.5) * 0.3,
      speed: 0.05 + rand() * 0.05,
      size: 0.8 + rand() * 0.6,
      phase: rand() * 10,
    }))
  }, [bounds])

  useFrame(({ clock }, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    const dt = reduce ? 0 : Math.min(delta, 0.1)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const [x0, z0, x1, z1] = bounds
    pigs.forEach((pig, i) => {
      // graze: drift forward, wander, stop now and then
      const grazing = Math.sin(t * 0.25 + pig.phase) > 0.4 ? 0.15 : 1
      pig.heading += (pig.turn + Math.sin(t * 0.2 + pig.phase) * 0.3) * dt
      pig.x += Math.cos(pig.heading) * pig.speed * grazing * dt
      pig.z += Math.sin(pig.heading) * pig.speed * grazing * dt
      if (pig.x < x0 || pig.x > x1 || pig.z < z0 || pig.z > z1) pig.heading += Math.PI
      const y = heightAt(pig.x, pig.z)
      const squish = 1 + Math.sin(t * 3 + pig.phase) * 0.04 * grazing
      e.set(0, -pig.heading, 0)
      mesh.setMatrixAt(i, m.compose(p.set(pig.x, y + 0.06 * pig.size, pig.z), q.setFromEuler(e), s.set(pig.size * squish, pig.size / squish, pig.size)))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (!mesh.boundingSphere) mesh.computeBoundingSphere()
  })

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, COUNT]} castShadow frustumCulled={false}>
      <meshStandardMaterial
        color="#d9a2a3"
        roughness={0.35}
        transparent
        opacity={0.88}
        emissive="#5a2a30"
        emissiveIntensity={0.25}
      />
    </instancedMesh>
  )
}

/**
 * Animals that live around the player rather than at fixed places: rattail
 * fish cruising near the bottom and jellyfish drifting higher up. They wrap
 * around a box centred on the submarine, so there are always a few in view.
 */
function DriftingLife({ heightAt, followRef }: { heightAt: HeightAt; followRef: MutableRefObject<THREE.Vector3> }) {
  const FISH = 14
  const JELLIES = 12
  const SPAN = 40
  const fishGeo = useMemo(() => rattailGeometry(), [])
  const bellGeo = useMemo(() => bellGeometry(), [])
  const fishRef = useRef<THREE.InstancedMesh>(null)
  const bellRef = useRef<THREE.InstancedMesh>(null)
  const glowRef = useRef<THREE.InstancedMesh>(null)
  const reduce = usePrefersReducedMotion()

  const fish = useMemo(() => {
    const rand = seeded(5)
    return Array.from({ length: FISH }, () => ({
      ox: rand() * SPAN,
      oz: rand() * SPAN,
      heading: rand() * Math.PI * 2,
      speed: 0.35 + rand() * 0.4,
      height: 0.4 + rand() * 1.4,
      size: 0.8 + rand() * 0.9,
      phase: rand() * 10,
    }))
  }, [])
  const jellies = useMemo(() => {
    const rand = seeded(9)
    return Array.from({ length: JELLIES }, () => ({
      ox: rand() * SPAN,
      oz: rand() * SPAN,
      height: 2.5 + rand() * 6,
      size: 0.6 + rand() * 1.1,
      phase: rand() * 10,
      drift: (rand() - 0.5) * 0.2,
    }))
  }, [])

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    const dt = reduce ? 0 : Math.min(delta, 0.1)
    const c = followRef.current
    const wrap = (v: number) => ((v % SPAN) + SPAN) % SPAN
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()

    const fm = fishRef.current
    if (fm) {
      fish.forEach((f, i) => {
        f.heading += Math.sin(t * 0.3 + f.phase) * 0.25 * dt
        f.ox += Math.cos(f.heading) * f.speed * dt
        f.oz += Math.sin(f.heading) * f.speed * dt
        const x = c.x - SPAN / 2 + wrap(f.ox - c.x)
        const z = c.z - SPAN / 2 + wrap(f.oz - c.z)
        const y = heightAt(x, z) + f.height + Math.sin(t * 0.7 + f.phase) * 0.1
        // body sways as it swims
        e.set(0, -f.heading + Math.sin(t * 4 + f.phase) * 0.12, Math.sin(t * 0.5 + f.phase) * 0.05)
        fm.setMatrixAt(i, m.compose(p.set(x, y, z), q.setFromEuler(e), s.setScalar(f.size)))
      })
      fm.instanceMatrix.needsUpdate = true
    }

    const bm = bellRef.current
    const gm = glowRef.current
    if (bm && gm) {
      jellies.forEach((j, i) => {
        j.ox += j.drift * dt
        j.oz += j.drift * 0.6 * dt
        const x = c.x - SPAN / 2 + wrap(j.ox - c.x)
        const z = c.z - SPAN / 2 + wrap(j.oz - c.z)
        // a pulse pushes the bell up; it sinks a little between pulses
        const pulse = reduce ? 0 : Math.max(0, Math.sin(t * 1.3 + j.phase))
        const y = heightAt(x, z) + j.height + Math.sin(t * 0.4 + j.phase) * 0.3
        e.set(Math.sin(t * 0.3 + j.phase) * 0.15, 0, Math.cos(t * 0.25 + j.phase) * 0.15)
        q.setFromEuler(e)
        s.set(j.size * (1 - pulse * 0.12), j.size * (1 + pulse * 0.18), j.size * (1 - pulse * 0.12))
        bm.setMatrixAt(i, m.compose(p.set(x, y, z), q, s))
        gm.setMatrixAt(i, m.compose(p.set(x, y + 0.03 * j.size, z), q, s.setScalar(j.size * (0.9 + pulse * 0.2))))
      })
      bm.instanceMatrix.needsUpdate = true
      gm.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={fishRef} args={[fishGeo, undefined, FISH]} castShadow frustumCulled={false}>
        <meshStandardMaterial color="#8d8c86" roughness={0.35} metalness={0.45} />
      </instancedMesh>
      <instancedMesh ref={bellRef} args={[bellGeo, undefined, JELLIES]} frustumCulled={false}>
        <meshStandardMaterial
          color="#a58fc9"
          transparent
          opacity={0.35}
          roughness={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
          emissive="#6d4fb0"
          emissiveIntensity={0.4}
        />
      </instancedMesh>
      {/* bioluminescent rim: unfogged, so it shows through the dark */}
      <instancedMesh ref={glowRef} args={[undefined, undefined, JELLIES]} frustumCulled={false}>
        <torusGeometry args={[0.13, 0.01, 6, 24]} />
        <meshBasicMaterial color="#b796ff" transparent opacity={0.55} fog={false} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  )
}

/** Amphipods: tiny crustaceans that swarm into the lamp's light. */
function LampSwarm({ lampTargetRef }: { lampTargetRef: MutableRefObject<THREE.Vector3> }) {
  const COUNT = 60
  const reduce = usePrefersReducedMotion()
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    return g
  }, [])
  const seeds = useMemo(() => {
    const rand = seeded(13)
    return Array.from({ length: COUNT }, () => [rand() * 10, rand() * 10, rand() * 10, 0.6 + rand() * 1.6])
  }, [])
  const dot = useMemo(() => {
    if (typeof document === "undefined") return null
    const cv = document.createElement("canvas")
    cv.width = cv.height = 32
    const ctx = cv.getContext("2d")!
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    g.addColorStop(0, "rgba(255,255,255,1)")
    g.addColorStop(0.4, "rgba(255,255,255,.7)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 32, 32)
    return new THREE.CanvasTexture(cv)
  }, [])
  useFrame(({ clock }) => {
    const t = reduce ? 0 : clock.elapsedTime
    const c = lampTargetRef.current
    const arr = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
    seeds.forEach(([a, b, d, r], i) => {
      // orbit loosely in the beam, with little darting hops
      const hop = Math.sin(t * 7 + a * 5) > 0.97 ? 0.3 : 0
      arr[i * 3] = c.x + Math.sin(t * 0.9 + a) * r + Math.sin(t * 3.1 + b) * 0.15
      arr[i * 3 + 1] = c.y + 0.4 + Math.abs(Math.sin(t * 0.7 + b)) * 1.6 + hop
      arr[i * 3 + 2] = c.z + Math.cos(t * 0.8 + d) * r + Math.cos(t * 2.7 + a) * 0.15
    })
    geometry.attributes.position.needsUpdate = true
  })
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#f3d7a8"
        size={0.07}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
        {...(dot ? { map: dot, alphaTest: 0.02 } : {})}
      />
    </points>
  )
}

const DEFAULT_BOUNDS: [number, number, number, number] = [-5, -5, 105, 105]

export function Fauna({ heightAt, followRef, lampTargetRef, bounds = DEFAULT_BOUNDS }: FaunaProps) {
  return (
    <>
      <SessileLife heightAt={heightAt} bounds={bounds} />
      <SeaPigs heightAt={heightAt} bounds={bounds} />
      <DriftingLife heightAt={heightAt} followRef={followRef} />
      {lampTargetRef && <LampSwarm lampTargetRef={lampTargetRef} />}
    </>
  )
}
