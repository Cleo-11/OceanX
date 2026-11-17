"use client"

import { useEffect, useRef } from "react"
import type { ResourceNode, OtherPlayer, PlayerPosition } from "@/lib/types"

interface SonarRadarProps {
  playerPosition: PlayerPosition
  resourceNodes: ResourceNode[]
  otherPlayers: OtherPlayer[]
}

const SIZE = 168
const R = SIZE / 2 - 4
const RANGE = 500 // world units shown from the centre to the rim
const SWEEP_PERIOD_S = 4

/**
 * Active sonar: a sweep that pings deposits, which then fade until the next
 * pass. North-up, matching the camera; the chevron is the submarine heading.
 */
export function SonarRadar({ playerPosition, resourceNodes, otherPlayers }: SonarRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Read the latest props from the draw loop without restarting it.
  const latest = useRef({ playerPosition, resourceNodes, otherPlayers })
  latest.current = { playerPosition, resourceNodes, otherPlayers }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    ctx.scale(dpr, dpr)
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const c = SIZE / 2
    let frame = 0

    const draw = () => {
      const { playerPosition: p, resourceNodes: nodes, otherPlayers: others } = latest.current
      const t = performance.now() / 1000
      const sweep = reduceMotion ? 0 : ((t / SWEEP_PERIOD_S) % 1) * Math.PI * 2

      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.save()
      ctx.beginPath()
      ctx.arc(c, c, R, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(4, 20, 23, 0.86)"
      ctx.fill()
      ctx.clip()

      // range rings and a north tick
      ctx.strokeStyle = "rgba(207, 218, 212, 0.10)"
      ctx.lineWidth = 1
      for (const f of [1 / 3, 2 / 3]) {
        ctx.beginPath()
        ctx.arc(c, c, R * f, 0, Math.PI * 2)
        ctx.stroke()
      }

      // the sweep: a soft trailing wedge
      if (!reduceMotion) {
        const trail = 0.9
        for (let i = 0; i < 18; i++) {
          const a0 = sweep - (trail * (i + 1)) / 18
          const a1 = sweep - (trail * i) / 18
          ctx.beginPath()
          ctx.moveTo(c, c)
          ctx.arc(c, c, R, a0, a1)
          ctx.closePath()
          ctx.fillStyle = `rgba(95, 227, 208, ${0.14 * (1 - i / 18)})`
          ctx.fill()
        }
      }

      const scale = R / RANGE
      const plot = (x: number, y: number) => [c + (x - p.x) * scale, c + (y - p.y) * scale] as const

      // deposits: bright when the sweep has just passed, fading afterwards
      for (const node of nodes) {
        if (node.depleted) continue
        const [x, y] = plot(node.position.x, node.position.y)
        const dx = x - c
        const dy = y - c
        if (dx * dx + dy * dy > (R - 3) * (R - 3)) continue
        let since = 0.6
        if (!reduceMotion) {
          const ang = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)
          since = ((sweep - ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) // 0 = just pinged
        }
        const glow = 0.25 + 0.75 * Math.pow(1 - since, 2)
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(95, 227, 208, ${glow})`
        ctx.fill()
      }

      for (const other of others) {
        const [x, y] = plot(other.position.x, other.position.y)
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(207, 218, 212, 0.7)"
        ctx.fill()
      }
      ctx.restore()

      // rim
      ctx.beginPath()
      ctx.arc(c, c, R, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(207, 218, 212, 0.16)"
      ctx.stroke()

      // the submarine: a small chevron pointing along its heading
      ctx.save()
      ctx.translate(c, c)
      ctx.rotate(p.rotation)
      ctx.beginPath()
      ctx.moveTo(6, 0)
      ctx.lineTo(-4, -3.5)
      ctx.lineTo(-2, 0)
      ctx.lineTo(-4, 3.5)
      ctx.closePath()
      ctx.fillStyle = "#f2a33a"
      ctx.fill()
      ctx.restore()

      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <figure className="dive-hud m-0 flex flex-col items-center gap-1.5">
      <canvas
        ref={canvasRef}
        style={{ width: SIZE, height: SIZE }}
        role="img"
        aria-label={`Sonar: ${resourceNodes.filter((n) => !n.depleted).length} deposits mapped`}
      />
      <figcaption className="text-xs text-[var(--ink-dim)]">Sonar</figcaption>
    </figure>
  )
}
