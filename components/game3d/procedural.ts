/**
 * Procedural geometry for the seabed: boulders and polymetallic nodules.
 *
 * Why they no longer look faceted: three's polyhedron geometries are
 * non-indexed (every triangle has its own vertices), so normals computed on
 * them are per-face and every triangle shows as a flat plane. Here the mesh is
 * welded first (mergeVertices), displaced with layered 3D noise, and then its
 * normals are smoothed across neighbours. Colour is baked per vertex:
 * crevices go dark, and silt settles on upward-facing surfaces, which is what
 * makes rocks read as sitting on the seabed rather than floating in a render.
 */

import * as THREE from "three"
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js"

// ── 3D value noise ──────────────────────────────────────────────────────────
const hash3 = (x: number, y: number, z: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return s - Math.floor(s)
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi)
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz)
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  )
}

/** Fractal noise in [-0.5, 0.5]-ish. */
export function fbm3(x: number, y: number, z: number, octaves = 5) {
  let v = 0, amp = 0.5, f = 1, norm = 0
  for (let i = 0; i < octaves; i++) {
    v += amp * (noise3(x * f, y * f, z * f) - 0.5)
    norm += amp
    f *= 2.07
    amp *= 0.5
  }
  return v / norm
}

/** Ridged noise: sharp creases, good for weathered rock and nodule lobes. */
function ridged3(x: number, y: number, z: number, octaves = 4) {
  let v = 0, amp = 0.5, f = 1
  for (let i = 0; i < octaves; i++) {
    v += amp * (1 - Math.abs(noise3(x * f, y * f, z * f) * 2 - 1))
    f *= 2.1
    amp *= 0.5
  }
  return v
}

interface BakeOptions {
  /** displacement in units of the unit sphere, given a point on it */
  radius: (p: THREE.Vector3) => number
  /** non-uniform scale applied after displacement */
  scale: THREE.Vector3
  base: THREE.Color
  /** colour flecks and variation */
  tint: (p: THREE.Vector3, out: THREE.Color) => void
  silt: THREE.Color
  /** how much sediment collects on top (0..1) */
  dusting: number
  detail: number
}

function bake({ radius, scale, base, tint, silt, dusting, detail }: BakeOptions) {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute("normal").deleteAttribute("uv"))
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const radii = new Float32Array(pos.count)
  let sum = 0
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const r = radius(v)
    radii[i] = r
    sum += r
    v.multiplyScalar(r).multiply(scale)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  const mean = sum / pos.count

  const normals = geo.attributes.normal as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(normals, i)
    c.copy(base)
    tint(v, c)
    // crevices: below-average radius reads darker (cheap ambient occlusion)
    const cavity = THREE.MathUtils.clamp((radii[i] - mean) * 6 + 0.8, 0.3, 1.12)
    c.multiplyScalar(cavity)
    // sediment settles on top, patchily
    const up = THREE.MathUtils.smoothstep(n.y, 0.35, 0.95)
    const patch = THREE.MathUtils.clamp(0.55 + fbm3(v.x * 3.1, v.y * 3.1, v.z * 3.1, 3) * 1.6, 0, 1)
    c.lerp(silt, up * patch * dusting)
    colors.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geo.computeBoundingSphere()
  return geo
}

const SILT = new THREE.Color("#7d7a66")

/** A weathered basalt boulder. Bottom is flattened so it sits on the seabed. */
export function makeBoulderGeometry(seed: number, detail = 4) {
  const s = seed * 17.31
  const layered = seed % 3 === 0 // some boulders show sediment layering
  // Two or three fracture planes: flat, chipped faces like broken basalt.
  const planes = Array.from({ length: 2 + (seed % 2) }, (_, k) => {
    const a = seed * 2.39 + k * 2.1
    const b = 0.3 + ((seed * 7 + k * 3) % 5) * 0.12
    return { n: new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)).normalize(), d: 0.62 + (k % 2) * 0.1 }
  })
  return bake({
    detail,
    radius: (p) => {
      let r = 1 + fbm3(p.x * 1.1 + s, p.y * 1.1, p.z * 1.1 - s) * 0.7
      r += (ridged3(p.x * 3.2 - s, p.y * 3.2, p.z * 3.2 + s) - 0.55) * 0.3
      r += fbm3(p.x * 9 + s, p.y * 9, p.z * 9, 3) * 0.07
      for (const pl of planes) {
        const along = p.dot(pl.n) * r
        if (along > pl.d) r *= pl.d / along + (along - pl.d) * 0.08
      }
      if (layered) r += Math.sin(p.y * 22 + fbm3(p.x * 2, p.y, p.z * 2) * 4) * 0.012
      // flatten the underside
      if (p.y < -0.25) r *= 1 - (-0.25 - p.y) * 0.55
      return r
    },
    scale: new THREE.Vector3(1, 0.68, 0.9),
    base: new THREE.Color("#3b3a35"),
    tint: (p, c) => {
      const k = fbm3(p.x * 2.3 + s, p.y * 2.3, p.z * 2.3, 3)
      c.offsetHSL(0.01 * k, 0.04 * k, 0.07 * k)
      // iron staining in streaks
      const rust = THREE.MathUtils.clamp(fbm3(p.x * 4 - s, p.y * 9, p.z * 4) * 3 - 0.35, 0, 1)
      c.lerp(new THREE.Color("#4a3426"), rust * 0.55)
    },
    silt: SILT,
    dusting: 0.8,
  })
}

/**
 * A polymetallic nodule: a potato-shaped lump with a knobbly, cauliflower-like
 * (botryoidal) surface, as photographed on the Clarion-Clipperton plain.
 */
export function makeNoduleGeometry(seed: number, base: string, accent: string, detail = 4) {
  const s = seed * 9.73
  const baseColor = new THREE.Color(base)
  const accentColor = new THREE.Color(accent)
  return bake({
    detail,
    radius: (p) => {
      let r = 1 + fbm3(p.x * 0.9 + s, p.y * 0.9, p.z * 0.9 + s, 3) * 0.5
      // botryoidal knobs: rounded bumps, not spikes
      const knob = noise3(p.x * 5.5 + s, p.y * 5.5 - s, p.z * 5.5)
      r += (knob * knob - 0.33) * 0.32
      r += (noise3(p.x * 14 - s, p.y * 14, p.z * 14 + s) - 0.5) * 0.07
      return r
    },
    scale: new THREE.Vector3(1, 0.72, 0.88),
    base: baseColor,
    tint: (p, c) => {
      const k = fbm3(p.x * 2 + s, p.y * 2, p.z * 2 - s, 3)
      c.offsetHSL(0, 0.05 * k, 0.08 * k)
      const fleck = THREE.MathUtils.clamp(fbm3(p.x * 6 - s, p.y * 6, p.z * 6 + s, 3) * 3.2 - 0.25, 0, 1)
      c.lerp(accentColor, fleck * 0.7)
    },
    silt: SILT,
    dusting: 0.22,
  })
}
