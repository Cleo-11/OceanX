"use client"

/**
 * The pilot's seat, for the first-person view: a bolted viewport frame and an
 * instrument console, drawn in front of the camera so they stay put while the
 * seabed moves past outside.
 *
 * The instruments are live. The text display shows heading, depth, altitude
 * and speed; the sonar sweeps; the gauges, throttle and joystick follow what
 * the submarine is doing. The display is amber, like the phosphor screens on
 * real submersibles, so it never competes with the cyan used for things you
 * can mine.
 */

import { useFrame, useThree } from "@react-three/fiber"
import { RoundedBox } from "@react-three/drei"
import { useMemo, useRef, type MutableRefObject } from "react"
import * as THREE from "three"
import type { PlayerPosition, ResourceNode } from "@/lib/types"

const AMBER = "#f2a33a"
const PHOSPHOR_BG = "#120a03"
/** Distance from the eye to the viewport frame, in layout units. */
const FRAME_DIST = 0.5
/**
 * The cockpit is laid out at roughly arm's length (0.5 units) and then shrunk
 * towards the eye, so it looks the same but sits closer than anything in the
 * world can get: the seabed and deposit markers can never poke through it.
 */
const COCKPIT_SCALE = 0.25
const COCKPIT_NEAR = 0.025
const DEFAULT_NEAR = 0.1
/** Sonar range, in world units, from the centre of the scope to its rim. */
const SONAR_RANGE = 500
const SCOPE_R = 0.062
const MAX_RETURNS = 48
/** The layout below is drawn for a 16:10 screen and stretched to fit. */
const DESIGN_ASPECT = 1.6

const usePrefersReducedMotion = () =>
  useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, [])

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { canvas, ctx: canvas.getContext("2d")!, texture }
}

// ── geometry ────────────────────────────────────────────────────────────────

/** The viewport frame: a wide plate with a rounded window cut out of it. */
function useFrameGeometry() {
  return useMemo(() => {
    const outer = new THREE.Shape()
    outer.moveTo(-1.2, -0.8)
    outer.lineTo(1.2, -0.8)
    outer.lineTo(1.2, 0.8)
    outer.lineTo(-1.2, 0.8)
    outer.closePath()
    const hole = new THREE.Path()
    const [x0, x1, y0, y1, r] = [-0.468, 0.468, -0.148, 0.272, 0.07]
    hole.moveTo(x0 + r, y0)
    hole.lineTo(x1 - r, y0)
    hole.quadraticCurveTo(x1, y0, x1, y0 + r)
    hole.lineTo(x1, y1 - r)
    hole.quadraticCurveTo(x1, y1, x1 - r, y1)
    hole.lineTo(x0 + r, y1)
    hole.quadraticCurveTo(x0, y1, x0, y1 - r)
    hole.lineTo(x0, y0 + r)
    hole.quadraticCurveTo(x0, y0, x0 + r, y0)
    outer.holes.push(hole)
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 3,
      curveSegments: 10,
    })
    g.translate(0, 0, -0.03)
    // bolts around the window
    const bolts: [number, number][] = []
    const inset = 0.018
    for (let i = 0; i <= 14; i++) {
      const x = x0 + r + ((x1 - x0 - 2 * r) * i) / 14
      bolts.push([x, y1 + inset])
    }
    for (let i = 0; i <= 5; i++) {
      const y = y0 + r + ((y1 - y0 - 2 * r) * i) / 5
      bolts.push([x0 - inset, y], [x1 + inset, y])
    }
    return { frame: g, bolts }
  }, [])
}

/** A pie slice for the sonar sweep. */
function useSweepGeometry() {
  return useMemo(() => new THREE.CircleGeometry(0.066, 24, 0, Math.PI / 5), [])
}

// ── live displays ───────────────────────────────────────────────────────────

/** Heading, depth, altitude and speed, redrawn a few times a second. */
function useReadout() {
  return useMemo(() => {
    if (typeof document === "undefined") return null
    const c = makeCanvas(512, 256)
    let lastKey = ""
    const draw = (heading: number, depth: number, altitude: number, speed: number, blink: boolean) => {
      const key = `${heading}|${depth}|${altitude}|${speed}|${blink}`
      if (key === lastKey) return
      lastKey = key
      const { ctx, canvas, texture } = c
      ctx.fillStyle = PHOSPHOR_BG
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // faint scanlines
      ctx.fillStyle = "rgba(242,163,58,0.05)"
      for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 1)
      ctx.fillStyle = AMBER
      ctx.shadowColor = AMBER
      ctx.shadowBlur = 10
      ctx.font = "500 34px 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif"
      const rows: [string, string][] = [
        ["Heading", `${String(heading).padStart(3, "0")}°`],
        ["Depth", `${depth.toLocaleString("en-US")} m`],
        ["Altitude", `${altitude.toFixed(1)} m`],
        ["Speed", `${speed.toFixed(1)} kn`],
      ]
      rows.forEach(([label, value], i) => {
        const y = 62 + i * 54
        ctx.globalAlpha = 0.65
        ctx.textAlign = "left"
        ctx.fillText(label, 30, y)
        ctx.globalAlpha = 1
        ctx.textAlign = "right"
        ctx.fillText(value, 482, y)
      })
      // recording light
      if (blink) {
        ctx.beginPath()
        ctx.arc(482, 22, 7, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
      texture.needsUpdate = true
    }
    return { texture: c.texture, draw }
  }, [])
}

/** A gauge face with ticks and a label. */
function useGaugeFace(label: string, ticks: number) {
  return useMemo(() => {
    if (typeof document === "undefined") return null
    const { ctx, texture } = makeCanvas(256, 256)
    ctx.fillStyle = "#e7e0cc"
    ctx.beginPath()
    ctx.arc(128, 128, 128, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "#1d1b17"
    ctx.lineCap = "round"
    for (let i = 0; i <= ticks; i++) {
      // the needle sweeps 270°, from bottom-left to bottom-right
      const a = Math.PI * 0.75 + (i / ticks) * Math.PI * 1.5
      const major = i % 2 === 0
      ctx.lineWidth = major ? 6 : 3
      ctx.beginPath()
      ctx.moveTo(128 + Math.cos(a) * (major ? 86 : 96), 128 + Math.sin(a) * (major ? 86 : 96))
      ctx.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110)
      ctx.stroke()
    }
    // red zone at the top of the range
    ctx.strokeStyle = "#b8452f"
    ctx.lineWidth = 10
    ctx.beginPath()
    ctx.arc(128, 128, 104, Math.PI * 1.95, Math.PI * 2.25)
    ctx.stroke()
    ctx.fillStyle = "#1d1b17"
    ctx.font = "600 30px 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(label, 128, 196)
    return texture
  }, [label, ticks])
}

/** A small printed label, like the ones stuck under switches. */
function useLabel(text: string, w = 256, h = 64, fg = "#d9d3c1", bg = "#24292a") {
  return useMemo(() => {
    if (typeof document === "undefined") return null
    const { ctx, texture } = makeCanvas(w, h)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = fg
    ctx.font = `500 ${Math.round(h * 0.55)}px 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, w / 2, h / 2 + 1)
    return texture
  }, [text, w, h, fg, bg])
}

/** The handwritten dive note taped to the frame. */
function useNote() {
  return useMemo(() => {
    if (typeof document === "undefined") return null
    const { ctx, texture } = makeCanvas(256, 256)
    ctx.fillStyle = "#e9d98a"
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = "rgba(0,0,0,0.06)"
    ctx.fillRect(0, 220, 256, 36)
    ctx.fillStyle = "#2b2a5a"
    ctx.font = "italic 30px 'Comic Sans MS', 'Bradley Hand', 'Segoe Print', cursive"
    ;["Dive 0412", "Ballast trim +2", "Mind the", "chimneys!"].forEach((line, i) => {
      ctx.save()
      ctx.translate(22, 50 + i * 46)
      ctx.rotate(-0.02 + i * 0.01)
      ctx.fillText(line, 0, 0)
      ctx.restore()
    })
    return texture
  }, [])
}

// ── the cockpit ─────────────────────────────────────────────────────────────

export function Cockpit({
  playerRef,
  nodes,
  heightAt,
  visibleRef,
}: {
  playerRef: MutableRefObject<PlayerPosition>
  /** deposits, shown as returns on the sonar scope (heading up) */
  nodes: ResourceNode[]
  /** seabed height at a scene-space point, for the altitude readout */
  heightAt: (x: number, z: number) => number
  /** true while the camera is in the pilot's seat */
  visibleRef: MutableRefObject<boolean>
}) {
  const { camera } = useThree()
  const reduce = usePrefersReducedMotion()
  const root = useRef<THREE.Group>(null)
  const stretch = useRef<THREE.Group>(null)
  const sweep = useRef<THREE.Mesh>(null)
  const needleA = useRef<THREE.Group>(null)
  const needleB = useRef<THREE.Group>(null)
  const stick = useRef<THREE.Group>(null)
  const throttle = useRef<THREE.Group>(null)
  const leds = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const returns = useRef<THREE.InstancedMesh>(null)
  const tint = useMemo(() => new THREE.Color(), [])
  const tempM = useMemo(() => new THREE.Matrix4(), [])
  const motion = useRef({ x: NaN, y: NaN, rot: NaN, speed: 0, turn: 0 })

  const { frame, bolts } = useFrameGeometry()
  const sweepGeo = useSweepGeometry()
  const readout = useReadout()
  const speedFace = useGaugeFace("Thrust", 10)
  const ballastFace = useGaugeFace("Ballast", 8)
  const note = useNote()
  const sonarLabel = useLabel("Sonar")
  const lightsLabel = useLabel("Lamps   Pumps   Cams", 768, 54)
  const armLabel = useLabel("Arm")

  const mats = useMemo(
    () => ({
      frame: new THREE.MeshStandardMaterial({ color: "#3a4144", roughness: 0.55, metalness: 0.55 }),
      console: new THREE.MeshStandardMaterial({ color: "#2b3133", roughness: 0.7, metalness: 0.35 }),
      panel: new THREE.MeshStandardMaterial({ color: "#1b2022", roughness: 0.8, metalness: 0.2 }),
      bolt: new THREE.MeshStandardMaterial({ color: "#8b8f8a", roughness: 0.35, metalness: 0.9 }),
      bezel: new THREE.MeshStandardMaterial({ color: "#6d716c", roughness: 0.3, metalness: 0.85 }),
      rubber: new THREE.MeshStandardMaterial({ color: "#111313", roughness: 0.95 }),
      knob: new THREE.MeshStandardMaterial({ color: "#c8452d", roughness: 0.45 }),
      crt: new THREE.MeshStandardMaterial({ color: PHOSPHOR_BG, emissive: "#3a1f05", emissiveIntensity: 0.6, roughness: 0.15 }),
      sweep: new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }),
      ring: new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.35, toneMapped: false }),
      needle: new THREE.MeshStandardMaterial({ color: "#b8452f", roughness: 0.5 }),
    }),
    [],
  )

  useFrame(({ clock }, delta) => {
    const g = root.current
    if (!g) return
    const cam = camera as THREE.PerspectiveCamera
    const inside = visibleRef.current
    const near = inside ? COCKPIT_NEAR : DEFAULT_NEAR
    if (cam.near !== near) {
      cam.near = near
      cam.updateProjectionMatrix()
    }
    g.visible = inside
    if (!inside) return
    // ride with the camera
    g.position.copy(camera.position)
    g.quaternion.copy(camera.quaternion)
    g.scale.setScalar(COCKPIT_SCALE)
    if (stretch.current) stretch.current.scale.x = Math.max(1, cam.aspect / DESIGN_ASPECT)

    // what the submarine is doing
    const p = playerRef.current
    const m = motion.current
    const dt = Math.max(delta, 1e-3)
    const moved = Number.isFinite(m.x) ? Math.hypot(p.x - m.x, p.y - m.y) : 0
    const turned = Number.isFinite(m.rot) ? Math.atan2(Math.sin(p.rotation - m.rot), Math.cos(p.rotation - m.rot)) : 0
    m.x = p.x
    m.y = p.y
    m.rot = p.rotation
    const k = 1 - Math.exp(-delta * 5)
    m.speed += (Math.min(1, moved / dt / 260) - m.speed) * k
    m.turn += (THREE.MathUtils.clamp(turned / dt / 2.5, -1, 1) - m.turn) * k

    const t = clock.elapsedTime
    if (stick.current) {
      stick.current.rotation.z = -m.turn * 0.35
      stick.current.rotation.x = -m.speed * 0.3
    }
    if (throttle.current) throttle.current.rotation.x = 0.5 - m.speed * 1.0
    if (needleA.current) needleA.current.rotation.z = Math.PI * 0.75 - m.speed * Math.PI * 1.4 - (reduce ? 0 : Math.sin(t * 13) * 0.01 * m.speed)
    if (needleB.current) needleB.current.rotation.z = Math.PI * 0.75 - (0.45 + Math.sin(t * 0.2) * 0.04) * Math.PI * 1.5
    const sweepAngle = reduce ? 0 : -t * 1.6
    if (sweep.current) sweep.current.rotation.z = sweepAngle

    // sonar returns, heading up: each one flares as the sweep passes it
    const rm = returns.current
    if (rm) {
      const fx = Math.cos(p.rotation)
      const fy = Math.sin(p.rotation)
      let n = 0
      for (const node of nodes) {
        if (n >= MAX_RETURNS) break
        if (node.depleted) continue
        const dx = node.position.x - p.x
        const dy = node.position.y - p.y
        const ahead = dx * fx + dy * fy
        const right = -dx * fy + dy * fx
        const dist = Math.hypot(ahead, right)
        if (dist > SONAR_RANGE * 0.96) continue
        const lx = (right / SONAR_RANGE) * SCOPE_R
        const ly = (ahead / SONAR_RANGE) * SCOPE_R
        const since = ((((Math.atan2(ly, lx) - sweepAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / 1.6
        const glow = reduce ? 0.8 : 0.22 + 0.9 * Math.exp(-since * 0.9)
        tempM.makeTranslation(lx, ly, 0.003)
        rm.setMatrixAt(n, tempM)
        rm.setColorAt(n, tint.set(AMBER).multiplyScalar(glow))
        n++
      }
      rm.count = n
      rm.instanceMatrix.needsUpdate = true
      if (rm.instanceColor) rm.instanceColor.needsUpdate = true
    }
    if (!reduce) {
      leds.current.forEach((mat, i) => {
        if (!mat) return
        const on = i % 3 === 2 ? Math.sin(t * 2.2 + i) > 0.6 : true
        mat.emissiveIntensity = on ? 2.2 : 0.15
      })
    }

    // the readout: heading clockwise from north, a plausible abyssal depth
    if (readout) {
      const x = p.x / 20
      const z = p.y / 20
      const ground = heightAt(x, z)
      const altitude = Math.max(0.3, camera.position.y - ground)
      const heading = Math.round(((((p.rotation + Math.PI / 2) * 180) / Math.PI) % 360 + 360) % 360)
      const depth = Math.round(4812 - ground * 6)
      readout.draw(heading, depth, Math.round(altitude * 10) / 10, Math.round(m.speed * 18) / 10, Math.floor(t * 1.2) % 2 === 0)
    }
  })

  // switches and their indicator lights
  const switches = [-0.27, -0.245, -0.22, -0.195, -0.17, -0.145]

  return (
    <group ref={root} visible={false}>
      {/* lit by a small warm cabin lamp, so the console reads in the dark */}
      <pointLight position={[0, 0.12, -0.18]} color="#ffcf98" intensity={0.55 * COCKPIT_SCALE * COCKPIT_SCALE} distance={1.1 * COCKPIT_SCALE} decay={2} />

      <group ref={stretch}>
        {/* viewport frame */}
        <mesh geometry={frame} material={mats.frame} position={[0, 0, -FRAME_DIST]} renderOrder={10} />
        {bolts.map(([x, y], i) => (
          <mesh key={i} position={[x, y, -FRAME_DIST + 0.012]} rotation={[Math.PI / 2, 0, 0]} material={mats.bolt}>
            <cylinderGeometry args={[0.0048, 0.0048, 0.005, 6]} />
          </mesh>
        ))}
        {/* a dive note taped to the corner */}
        {note && (
          <mesh position={[0.4, 0.24, -FRAME_DIST + 0.016]} rotation={[0, 0, -0.08]}>
            <planeGeometry args={[0.075, 0.075]} />
            <meshStandardMaterial map={note} roughness={0.9} />
          </mesh>
        )}

        {/* console */}
        <group position={[0, -0.215, -0.38]} rotation={[0.42, 0, 0]}>
          <RoundedBox args={[1.6, 0.06, 0.34]} radius={0.02} smoothness={3} material={mats.console} position={[0, -0.03, 0]} />
          {/* recessed instrument panel */}
          <RoundedBox args={[0.7, 0.01, 0.13]} radius={0.004} smoothness={2} material={mats.panel} position={[0, 0.002, -0.07]} />

          {/* centre: sonar scope */}
          <group position={[0, 0.009, -0.075]} rotation={[-Math.PI / 2, 0, 0]} scale={0.78}>
            <mesh material={mats.bezel}>
              <torusGeometry args={[0.072, 0.007, 8, 40]} />
            </mesh>
            <mesh material={mats.crt}>
              <circleGeometry args={[0.07, 40]} />
            </mesh>
            {[0.025, 0.048].map((r) => (
              <mesh key={r} position={[0, 0, 0.001]} material={mats.ring}>
                <ringGeometry args={[r - 0.0008, r + 0.0008, 40]} />
              </mesh>
            ))}
            <mesh ref={sweep} geometry={sweepGeo} position={[0, 0, 0.002]} material={mats.sweep} />
            {/* your submarine, and the deposits around it */}
            <mesh position={[0, 0, 0.003]} rotation={[0, 0, Math.PI / 2]} material={mats.ring}>
              <circleGeometry args={[0.0035, 3]} />
            </mesh>
            <instancedMesh ref={returns} args={[undefined, undefined, MAX_RETURNS]} frustumCulled={false}>
              <circleGeometry args={[0.0032, 10]} />
              <meshBasicMaterial toneMapped={false} />
            </instancedMesh>
          </group>
          {sonarLabel && (
            <mesh position={[0.075, 0.0085, -0.03]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.04, 0.01]} />
              <meshBasicMaterial map={sonarLabel} toneMapped={false} />
            </mesh>
          )}

          {/* left: navigation readout */}
          {readout && (
            <group position={[-0.2, 0.009, -0.08]} rotation={[-Math.PI / 2, 0, 0]} scale={0.72}>
              <mesh material={mats.bezel} position={[0, 0, -0.002]}>
                <planeGeometry args={[0.22, 0.118]} />
              </mesh>
              <mesh>
                <planeGeometry args={[0.205, 0.103]} />
                <meshBasicMaterial map={readout.texture} toneMapped={false} />
              </mesh>
            </group>
          )}

          {/* right: thrust and ballast gauges */}
          {[
            { x: 0.15, face: speedFace, needle: needleA },
            { x: 0.245, face: ballastFace, needle: needleB },
          ].map(({ x, face, needle }) => (
            <group key={x} position={[x, 0.009, -0.08]} rotation={[-Math.PI / 2, 0, 0]} scale={0.8}>
              <mesh material={mats.bezel}>
                <torusGeometry args={[0.047, 0.006, 8, 32]} />
              </mesh>
              {face && (
                <mesh>
                  <circleGeometry args={[0.046, 32]} />
                  <meshStandardMaterial map={face} roughness={0.4} emissive="#ffffff" emissiveMap={face} emissiveIntensity={0.15} />
                </mesh>
              )}
              <group ref={needle} position={[0, 0, 0.002]}>
                <mesh position={[0.017, 0, 0]} material={mats.needle}>
                  <boxGeometry args={[0.036, 0.003, 0.001]} />
                </mesh>
              </group>
              <mesh position={[0, 0, 0.003]} material={mats.bezel}>
                <circleGeometry args={[0.004, 10]} />
              </mesh>
            </group>
          ))}

          {/* toggle switches with indicator lights */}
          {switches.map((x, i) => (
            <group key={x} position={[x, 0.006, -0.008]} scale={0.7}>
              <mesh material={mats.bezel}>
                <cylinderGeometry args={[0.008, 0.009, 0.004, 12]} />
              </mesh>
              <mesh position={[0, 0.01, 0]} rotation={[i % 4 === 1 ? -0.5 : 0.5, 0, 0]} material={mats.bolt}>
                <cylinderGeometry args={[0.0022, 0.0028, 0.022, 6]} />
              </mesh>
              <mesh position={[0, 0.003, -0.022]}>
                <sphereGeometry args={[0.0045, 10, 6]} />
                <meshStandardMaterial
                  ref={(mat: THREE.MeshStandardMaterial | null) => {
                    leds.current[i] = mat
                  }}
                  color="#2a0d07"
                  emissive={i % 4 === 1 ? "#e5604a" : "#9adf6a"}
                  emissiveIntensity={2.2}
                  toneMapped={false}
                />
              </mesh>
            </group>
          ))}
          {lightsLabel && (
            <mesh position={[-0.207, 0.0045, 0.009]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.15, 0.0105]} />
              <meshBasicMaterial map={lightsLabel} toneMapped={false} />
            </mesh>
          )}

          {/* throttle, left of the pilot's hand */}
          <group position={[-0.32, 0.0, -0.05]} scale={0.8}>
            <RoundedBox args={[0.05, 0.02, 0.14]} radius={0.006} smoothness={2} material={mats.panel} />
            <group ref={throttle} position={[0, 0.01, 0]}>
              <mesh position={[0, 0.045, 0]} material={mats.bezel}>
                <cylinderGeometry args={[0.005, 0.006, 0.09, 8]} />
              </mesh>
              <RoundedBox args={[0.05, 0.022, 0.026]} radius={0.008} smoothness={2} position={[0, 0.094, 0]} material={mats.rubber} />
            </group>
          </group>

          {/* joystick: thrust and yaw */}
          <group position={[0.32, 0.0, -0.05]} scale={0.8}>
            <mesh material={mats.panel}>
              <cylinderGeometry args={[0.042, 0.048, 0.016, 20]} />
            </mesh>
            <mesh position={[0, 0.018, 0]} material={mats.rubber}>
              <coneGeometry args={[0.03, 0.03, 16]} />
            </mesh>
            <group ref={stick} position={[0, 0.01, 0]}>
              <mesh position={[0, 0.045, 0]} material={mats.bezel}>
                <cylinderGeometry args={[0.006, 0.007, 0.09, 8]} />
              </mesh>
              <mesh position={[0, 0.1, 0]} material={mats.rubber}>
                <capsuleGeometry args={[0.014, 0.035, 4, 10]} />
              </mesh>
              <mesh position={[0, 0.126, -0.008]} material={mats.knob}>
                <sphereGeometry args={[0.006, 10, 8]} />
              </mesh>
            </group>
          </group>
          {armLabel && (
            <mesh position={[0.32, 0.0085, 0.0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.04, 0.012]} />
              <meshBasicMaterial map={armLabel} toneMapped={false} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  )
}
