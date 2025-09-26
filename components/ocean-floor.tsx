"use client"

import { useState } from "react"

import { useEffect, useRef } from "react"
// import { Rock, SeaPlant, UnderwaterVent, CaveEntrance } from "./decorative-elements"

export function OceanFloor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Animation state
    let animationId: number
    let time = 0

    // Bubble particles
    const bubbles = Array.from({ length: 20 }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 200,
      size: Math.random() * 8 + 2,
      speed: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.6 + 0.2,
      wobble: Math.random() * 0.02 + 0.01,
    }))

    // Fish shadows
    const fish = Array.from({ length: 12 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.8 + 100,
      size: Math.random() * 30 + 15,
      speed: Math.random() * 1 + 0.3,
      direction: Math.random() > 0.5 ? 1 : -1,
      opacity: Math.random() * 0.3 + 0.1,
      swimOffset: Math.random() * Math.PI * 2,
    }))

    // Seaweed
    const seaweed = Array.from({ length: 25 }, () => ({
      x: Math.random() * canvas.width,
      height: Math.random() * 150 + 50,
      segments: 8,
      swayAmount: Math.random() * 0.3 + 0.1,
      swaySpeed: Math.random() * 0.02 + 0.01,
      color: `hsl(${120 + Math.random() * 40}, 60%, ${25 + Math.random() * 15}%)`,
    }))

    // Kelp (taller seaweed)
    const kelp = Array.from({ length: 8 }, () => ({
      x: Math.random() * canvas.width,
      height: Math.random() * 300 + 200,
      segments: 12,
      swayAmount: Math.random() * 0.5 + 0.2,
      swaySpeed: Math.random() * 0.015 + 0.008,
      color: `hsl(${100 + Math.random() * 30}, 50%, ${20 + Math.random() * 10}%)`,
    }))

    // Coral formations
    const coral = Array.from({ length: 15 }, () => ({
      x: Math.random() * canvas.width,
      y: canvas.height - Math.random() * 100 - 20,
      size: Math.random() * 40 + 20,
      type: Math.floor(Math.random() * 3),
      color: `hsl(${Math.random() * 60 + 300}, 70%, ${50 + Math.random() * 30}%)`,
      glow: Math.random() * 0.5 + 0.3,
    }))

    // Water particles
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 3 + 1,
      speedX: (Math.random() - 0.5) * 0.5,
      speedY: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.4 + 0.1,
      life: Math.random() * 100,
    }))

    // Sunlight rays
    const sunRays = Array.from({ length: 6 }, () => ({
      x: Math.random() * canvas.width,
      width: Math.random() * 100 + 50,
      opacity: Math.random() * 0.1 + 0.05,
      speed: Math.random() * 0.5 + 0.2,
    }))

    const animate = () => {
      time += 0.016 // ~60fps

      // Clear canvas with ocean gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, "#0f172a") // Deep ocean blue
      gradient.addColorStop(0.3, "#1e293b")
      gradient.addColorStop(0.6, "#334155")
      gradient.addColorStop(1, "#475569") // Lighter blue at bottom

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw sunlight rays
      sunRays.forEach((ray) => {
        ctx.save()
        ctx.globalAlpha = ray.opacity * (0.8 + 0.2 * Math.sin(time * ray.speed))

        const rayGradient = ctx.createLinearGradient(ray.x, 0, ray.x, canvas.height)
        rayGradient.addColorStop(0, "rgba(255, 255, 200, 0.3)")
        rayGradient.addColorStop(0.5, "rgba(255, 255, 200, 0.1)")
        rayGradient.addColorStop(1, "rgba(255, 255, 200, 0)")

        ctx.fillStyle = rayGradient
        ctx.fillRect(ray.x - ray.width / 2, 0, ray.width, canvas.height)
        ctx.restore()
      })

      // Draw and animate seaweed
      seaweed.forEach((weed) => {
        ctx.save()
        ctx.strokeStyle = weed.color
        ctx.lineWidth = 3
        ctx.lineCap = "round"

        const baseX = weed.x
        const baseY = canvas.height

        for (let i = 0; i < weed.segments; i++) {
          const segmentHeight = weed.height / weed.segments
          const y1 = baseY - i * segmentHeight
          const y2 = baseY - (i + 1) * segmentHeight

          const sway1 = Math.sin(time * weed.swaySpeed + i * 0.5) * weed.swayAmount * i
          const sway2 = Math.sin(time * weed.swaySpeed + (i + 1) * 0.5) * weed.swayAmount * (i + 1)

          const x1 = baseX + sway1 * 20
          const x2 = baseX + sway2 * 20

          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
        ctx.restore()
      })

      // Draw and animate kelp
      kelp.forEach((k) => {
        ctx.save()
        ctx.strokeStyle = k.color
        ctx.lineWidth = 5
        ctx.lineCap = "round"

        const baseX = k.x
        const baseY = canvas.height

        for (let i = 0; i < k.segments; i++) {
          const segmentHeight = k.height / k.segments
          const y1 = baseY - i * segmentHeight
          const y2 = baseY - (i + 1) * segmentHeight

          const sway1 = Math.sin(time * k.swaySpeed + i * 0.3) * k.swayAmount * i
          const sway2 = Math.sin(time * k.swaySpeed + (i + 1) * 0.3) * k.swayAmount * (i + 1)

          const x1 = baseX + sway1 * 30
          const x2 = baseX + sway2 * 30

          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
        ctx.restore()
      })

      // Draw coral
      coral.forEach((c) => {
        ctx.save()
        ctx.globalAlpha = c.glow * (0.8 + 0.2 * Math.sin(time * 2))
        ctx.fillStyle = c.color

        if (c.type === 0) {
          // Branch coral
          ctx.beginPath()
          ctx.arc(c.x, c.y, c.size / 2, 0, Math.PI * 2)
          ctx.fill()

          // Branches
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2
            const branchX = c.x + Math.cos(angle) * c.size * 0.3
            const branchY = c.y + Math.sin(angle) * c.size * 0.3
            ctx.beginPath()
            ctx.arc(branchX, branchY, c.size / 4, 0, Math.PI * 2)
            ctx.fill()
          }
        } else if (c.type === 1) {
          // Fan coral
          ctx.beginPath()
          ctx.ellipse(c.x, c.y, c.size / 2, c.size / 3, 0, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // Tube coral
          ctx.fillRect(c.x - c.size / 6, c.y - c.size, c.size / 3, c.size)
          ctx.beginPath()
          ctx.arc(c.x, c.y - c.size, c.size / 6, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      })

      // Draw and animate fish
      fish.forEach((f) => {
        f.x += f.speed * f.direction
        f.y += Math.sin(time * 2 + f.swimOffset) * 0.5

        // Wrap around screen
        if (f.direction > 0 && f.x > canvas.width + f.size) {
          f.x = -f.size
        } else if (f.direction < 0 && f.x < -f.size) {
          f.x = canvas.width + f.size
        }

        ctx.save()
        ctx.globalAlpha = f.opacity
        ctx.fillStyle = "#1e293b"

        // Fish body (ellipse)
        ctx.save()
        ctx.translate(f.x, f.y)
        ctx.scale(f.direction, 1)

        ctx.beginPath()
        ctx.ellipse(0, 0, f.size, f.size * 0.6, 0, 0, Math.PI * 2)
        ctx.fill()

        // Fish tail
        ctx.beginPath()
        ctx.moveTo(-f.size, 0)
        ctx.lineTo(-f.size * 1.5, -f.size * 0.3)
        ctx.lineTo(-f.size * 1.5, f.size * 0.3)
        ctx.closePath()
        ctx.fill()

        ctx.restore()
        ctx.restore()
      })

      // Draw and animate bubbles
      bubbles.forEach((bubble) => {
        bubble.y -= bubble.speed
        bubble.x += Math.sin(time * bubble.wobble + bubble.y * 0.01) * 0.5

        // Reset bubble when it reaches top
        if (bubble.y < -bubble.size) {
          bubble.y = canvas.height + bubble.size
          bubble.x = Math.random() * canvas.width
        }

        ctx.save()
        ctx.globalAlpha = bubble.opacity
        ctx.fillStyle = "rgba(173, 216, 230, 0.6)"
        ctx.beginPath()
        ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2)
        ctx.fill()

        // Bubble highlight
        ctx.globalAlpha = bubble.opacity * 0.8
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
        ctx.beginPath()
        ctx.arc(bubble.x - bubble.size * 0.3, bubble.y - bubble.size * 0.3, bubble.size * 0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // Draw and animate water particles
      particles.forEach((particle) => {
        particle.x += particle.speedX
        particle.y += particle.speedY
        particle.life -= 0.5

        // Reset particle
        if (particle.life <= 0) {
          particle.x = Math.random() * canvas.width
          particle.y = Math.random() * canvas.height
          particle.life = 100
        }

        ctx.save()
        ctx.globalAlpha = particle.opacity * (particle.life / 100)
        ctx.fillStyle = "rgba(173, 216, 230, 0.4)"
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // Add ocean floor texture
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = "#8b7355"
      ctx.fillRect(0, canvas.height - 20, canvas.width, 20)

      // Sand texture dots
      for (let i = 0; i < canvas.width; i += 10) {
        if (Math.random() > 0.7) {
          ctx.fillStyle = "#a0916b"
          ctx.beginPath()
          ctx.arc(i + Math.random() * 10, canvas.height - Math.random() * 15, 1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [])

  if (!mounted) {
    return (
      <group>
        <mesh rotation-x={-Math.PI / 2} position={[0, -1, 0]} receiveShadow>
          <planeGeometry args={[100, 100, 64, 64]} />
          <meshStandardMaterial color="#0c4a6e" roughness={1} metalness={0.2} displacementScale={2} wireframe={false} />
        </mesh>
      </group>
    )
  }

  return (
    <div className="absolute inset-0 overflow-hidden ocean-background">
      {/* Sunlight Rays */}
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={`sunlight-${i}`}
          className="sunlight-ray"
          style={{
            left: `${15 + i * 12}%`,
            top: "0%",
            width: "2px",
            height: "60%",
            animationDelay: `${i * 1.2}s`,
            animationDuration: "6s",
          }}
        />
      ))}

      {/* Animated Bubbles */}
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={`bubble-${i}`}
          className="bubble"
          style={{
            left: `${Math.random() * 100}%`,
            width: `${5 + Math.random() * 15}px`,
            height: `${5 + Math.random() * 15}px`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${10 + Math.random() * 6}s`,
          }}
        />
      ))}

      {/* Swimming Fish */}
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={`fish-${i}`}
          className={`fish-shadow ${i % 2 === 0 ? "fish-left" : "fish-right"}`}
          style={{
            top: `${15 + Math.random() * 70}%`,
            animationDelay: `${Math.random() * 12}s`,
            animationDuration: `${18 + Math.random() * 12}s`,
            transform: `scale(${0.8 + Math.random() * 0.6})`,
          }}
        />
      ))}

      {/* Water Particles */}
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={`particle-${i}`}
          className="water-particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${8 + Math.random() * 6}s`,
          }}
        />
      ))}

      {/* Ocean Floor */}
      <div className="absolute bottom-0 left-0 right-0 h-24 ocean-floor">
        {/* Seaweed */}
        {Array.from({ length: 25 }, (_, i) => (
          <div
            key={`seaweed-${i}`}
            className="seaweed"
            style={{
              left: `${Math.random() * 100}%`,
              bottom: "0px",
              width: `${4 + Math.random() * 6}px`,
              height: `${25 + Math.random() * 35}px`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${4 + Math.random() * 3}s`,
            }}
          />
        ))}

        {/* Kelp Forest */}
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={`kelp-${i}`}
            className="kelp"
            style={{
              left: `${10 + i * 10 + Math.random() * 5}%`,
              bottom: "0px",
              width: `${8 + Math.random() * 4}px`,
              height: `${50 + Math.random() * 30}px`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${6 + Math.random() * 2}s`,
            }}
          />
        ))}

        {/* Coral Formations */}
        {Array.from({ length: 15 }, (_, i) => {
          const coralColors = [
            "background: radial-gradient(circle, #ff6b6b 0%, #ff5252 50%, #d32f2f 100%)",
            "background: radial-gradient(circle, #ff9800 0%, #f57c00 50%, #e65100 100%)",
            "background: radial-gradient(circle, #e91e63 0%, #c2185b 50%, #880e4f 100%)",
            "background: radial-gradient(circle, #9c27b0 0%, #7b1fa2 50%, #4a148c 100%)",
          ]

          return (
            <div
              key={`coral-${i}`}
              className="coral"
              style={{
                left: `${Math.random() * 100}%`,
                bottom: `${Math.random() * 15}px`,
                width: `${15 + Math.random() * 20}px`,
                height: `${12 + Math.random() * 15}px`,
                background: coralColors[i % coralColors.length].split(": ")[1],
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${8 + Math.random() * 4}s`,
              }}
            />
          )
        })}
      </div>

      {/* 3D Ocean Floor for Three.js compatibility */}
      <group>
        <mesh rotation-x={-Math.PI / 2} position={[0, -1, 0]} receiveShadow>
          <planeGeometry args={[100, 100, 64, 64]} />
          <meshStandardMaterial color="#0c4a6e" roughness={1} metalness={0.2} displacementScale={2} wireframe={false} />
        </mesh>

        {/* 3D Decorative elements */}
        {/*
        {Array.from({ length: 30 }, (_, i) => {
          const x = Math.random() * 50 - 25
          const z = Math.random() * 50 - 25
          const scale = Math.random() * 1.5 + 0.5
          const rotation = Math.random() * Math.PI

          return (
            <Rock
              key={`rock-${i}`}
              position={[x, -0.5 - Math.random() * 0.5, z]}
              scale={[scale, scale * 0.8, scale * 1.2]}
              rotation={[0, rotation, 0]}
            />
          )
        })}

        {Array.from({ length: 40 }, (_, i) => {
          const x = Math.random() * 50 - 25
          const z = Math.random() * 50 - 25
          const scale = Math.random() * 0.5 + 0.3

          return <SeaPlant key={`plant-${i}`} position={[x, -0.9, z]} scale={[scale, scale * 1.5, scale]} />
        })}

        <UnderwaterVent position={[-15, -0.8, -10]} />
        <UnderwaterVent position={[12, -0.8, 8]} />
        <UnderwaterVent position={[5, -0.8, -18]} />

        <CaveEntrance position={[-8, -0.5, 15]} rotation={[0, Math.PI / 3, 0]} />
        <CaveEntrance position={[20, -0.5, -5]} rotation={[0, -Math.PI / 4, 0]} />
        */}
      </group>

      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />
    </div>
  )
}
