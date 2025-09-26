"use client"

import { useEffect, useRef } from "react"
import type { ResourceNode, OtherPlayer, PlayerPosition } from "@/lib/types"
import { getResourceColor } from "@/lib/resource-utils"

interface SonarRadarProps {
  playerPosition: PlayerPosition
  resourceNodes: ResourceNode[]
  otherPlayers: OtherPlayer[]
}

export function SonarRadar({ playerPosition, resourceNodes, otherPlayers }: SonarRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    canvas.width = 200
    canvas.height = 200

    let animationFrame: number

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw radar background with hexagon pattern (blockchain-inspired)
      const drawHexagonPattern = () => {
        const size = 15; // Size of each hexagon
        ctx.strokeStyle = "rgba(14, 165, 233, 0.15)";
        ctx.lineWidth = 0.5;
        
        for(let x = 0; x < canvas.width + size; x += size * 1.5) {
          for(let y = 0; y < canvas.height + size; y += size * Math.sqrt(3)) {
            const offset = (Math.floor(y / (size * Math.sqrt(3))) % 2) * (size * 0.75);
            ctx.beginPath();
            for(let i = 0; i < 6; i++) {
              const angle = (i * Math.PI) / 3;
              const xPos = x + offset + size * Math.cos(angle);
              const yPos = y + size * Math.sin(angle);
              if(i === 0) {
                ctx.moveTo(xPos, yPos);
              } else {
                ctx.lineTo(xPos, yPos);
              }
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
      };
      
      // Draw main radar background
      ctx.fillStyle = "rgba(0, 20, 40, 0.85)";
      ctx.beginPath();
      ctx.arc(100, 100, 95, 0, Math.PI * 2);
      ctx.fill();
      
      // Clip to radar area for hexagon pattern
      ctx.save();
      ctx.beginPath();
      ctx.arc(100, 100, 95, 0, Math.PI * 2);
      ctx.clip();
      
      // Draw hexagon pattern inside radar (blockchain-inspired)
      drawHexagonPattern();
      
      ctx.restore();

      // Draw radar grid
      ctx.strokeStyle = "rgba(14, 165, 233, 0.4)"
      ctx.lineWidth = 1

      // Draw concentric circles
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath()
        ctx.arc(100, 100, i * 30, 0, Math.PI * 2)
        ctx.stroke()
        
        // Add distance markers (blockchain-inspired)
        ctx.fillStyle = "rgba(14, 165, 233, 0.7)";
        ctx.font = "8px monospace";
        ctx.fillText(`${i*100}m`, 105, 100 - i * 30 + 4);
      }

      // Draw digital-looking crosshairs (blockchain-inspired)
      ctx.beginPath()
      
      // Dashed lines for crosshairs
      ctx.setLineDash([4, 2]);
      ctx.moveTo(100, 5)
      ctx.lineTo(100, 195)
      ctx.moveTo(5, 100)
      ctx.lineTo(195, 100)
      ctx.stroke()
      ctx.setLineDash([]);
      
      // Hexagon center marker (blockchain-inspired)
      ctx.strokeStyle = "rgba(14, 165, 233, 0.8)";
      ctx.beginPath();
      for(let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const x = 100 + 8 * Math.cos(angle);
        const y = 100 + 8 * Math.sin(angle);
        if(i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();

      // Draw radar sweep with data particles (blockchain-inspired)
      const sweepAngle = (Date.now() / 1000) % (Math.PI * 2)
      
      // Main sweep
      const gradient = ctx.createRadialGradient(100, 100, 0, 100, 100, 95);
      gradient.addColorStop(0, "rgba(56, 189, 248, 0.9)");
      gradient.addColorStop(1, "rgba(56, 189, 248, 0.1)");
      
      ctx.fillStyle = gradient;
      ctx.beginPath()
      ctx.moveTo(100, 100)
      ctx.arc(100, 100, 95, sweepAngle - 0.3, sweepAngle)
      ctx.lineTo(100, 100)
      ctx.fill()
      
      // Add data particles along sweep line (blockchain-inspired)
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      for (let r = 10; r < 95; r += 10) {
        if (Math.random() > 0.7) {
          const particleX = 100 + Math.cos(sweepAngle) * r;
          const particleY = 100 + Math.sin(sweepAngle) * r;
          const size = Math.random() * 2 + 1;
          ctx.beginPath();
          ctx.arc(particleX, particleY, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Map coordinates from world space to radar space
      const mapToRadar = (worldX: number, worldY: number): [number, number] => {
        // Scale factor (500 world units = 90 radar pixels)
        const scale = 90 / 500

        // Calculate relative position to player
        const relX = worldX - playerPosition.x
        const relY = worldY - playerPosition.y

        // Convert to radar coordinates (centered at 100,100)
        const radarX = 100 + relX * scale
        const radarY = 100 + relY * scale

        return [radarX, radarY]
      }

      // Draw player position (always at center)
      ctx.fillStyle = "#ffffff"
      ctx.beginPath()
      ctx.arc(100, 100, 4, 0, Math.PI * 2)
      ctx.fill()

      // Draw direction indicator
      const dirX = 100 + Math.cos(playerPosition.rotation) * 8
      const dirY = 100 + Math.sin(playerPosition.rotation) * 8
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(100, 100)
      ctx.lineTo(dirX, dirY)
      ctx.stroke()

      // Draw other players
      otherPlayers.forEach((player) => {
        const [radarX, radarY] = mapToRadar(player.position.x, player.position.y)

        // Only show if within radar range
        if (radarX >= 5 && radarX <= 195 && radarY >= 5 && radarY <= 195) {
          ctx.fillStyle = "#22d3ee"
          ctx.beginPath()
          ctx.arc(radarX, radarY, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // Draw resources
      resourceNodes.forEach((node) => {
        if (node.depleted) return

        const [radarX, radarY] = mapToRadar(node.position.x, node.position.y)

        // Only show if within radar range
        if (radarX >= 5 && radarX <= 195 && radarY >= 5 && radarY <= 195) {
          // Only show resources that have been "swept" by the radar
          const resourceAngle = Math.atan2(radarY - 100, radarX - 100)
          const normalizedResourceAngle = resourceAngle < 0 ? resourceAngle + Math.PI * 2 : resourceAngle
          const normalizedSweepAngle = sweepAngle % (Math.PI * 2)

          const isVisible =
            (normalizedResourceAngle <= normalizedSweepAngle && normalizedResourceAngle >= normalizedSweepAngle - 1) ||
            (normalizedSweepAngle < 1 && normalizedResourceAngle >= Math.PI * 2 - (1 - normalizedSweepAngle))

          if (isVisible) {
            const color = getResourceColor(node.type)

            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(radarX, radarY, 3, 0, Math.PI * 2)
            ctx.fill()

            // Add a pulsing effect
            ctx.strokeStyle = color
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(radarX, radarY, 5 + Math.sin(Date.now() / 200) * 2, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
      })

      animationFrame = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [playerPosition, resourceNodes, otherPlayers])

  return (
    <div className="absolute bottom-4 left-4 z-20 rounded-full border-2 border-cyan-900/50 shadow-lg shadow-cyan-900/20">
      <canvas ref={canvasRef} width={200} height={200} className="rounded-full" />
      <div className="absolute inset-0 rounded-full border border-cyan-500/30" />
      <div className="absolute bottom-2 left-0 right-0 text-center font-mono text-xs text-cyan-400">SONAR</div>
    </div>
  )
}
