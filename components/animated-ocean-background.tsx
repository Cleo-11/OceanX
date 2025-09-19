"use client"

import { useRef, useEffect } from 'react'

interface AnimatedOceanBackgroundProps {
  className?: string
  showParticles?: boolean
  showSunRays?: boolean
  showFish?: boolean
}

export function AnimatedOceanBackground({ 
  className = "", 
  showParticles = true,
  showSunRays = true,
  showFish = false
}: AnimatedOceanBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Initialize canvas size
    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Animation state (similar to main game)
    const aquaticState = {
      sunRays: Array.from({ length: 8 }, (_, i) => ({
        x: (canvas.width / 8) * i + Math.random() * 100,
        y: 0,
        width: 40 + Math.random() * 30,
        opacity: 0.3 + Math.random() * 0.4,
        speed: 0.8 + Math.random() * 0.4,
      })),
      particles: Array.from({ length: 40 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: 0.3 + Math.random() * 0.4,
        life: 100,
      })),
      fish: Array.from({ length: 3 }, (_, i) => ({
        x: Math.random() * canvas.width,
        y: canvas.height * 0.3 + Math.random() * canvas.height * 0.4,
        size: 8 + Math.random() * 12,
        speed: 0.8 + Math.random() * 1.2,
        direction: Math.random() > 0.5 ? 1 : -1,
        opacity: 0.6 + Math.random() * 0.3,
        swimOffset: i * Math.PI * 0.67,
      })),
    }

    let startTime = Date.now()

    const animate = () => {
      const time = (Date.now() - startTime) * 0.001
      
      // Update canvas size if it changed
      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        resizeCanvas()
        // Reinitialize positions for new canvas size
        aquaticState.sunRays.forEach((ray, i) => {
          ray.x = (canvas.width / 8) * i + Math.random() * 100
        })
        aquaticState.particles.forEach(particle => {
          particle.x = Math.random() * canvas.width
          particle.y = Math.random() * canvas.height
        })
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // --- OCEAN GRADIENT BACKGROUND (same as main game) ---
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, "#0f172a")
      gradient.addColorStop(0.2, "#164e63")
      gradient.addColorStop(0.5, "#2563eb")
      gradient.addColorStop(0.8, "#38bdf8")
      gradient.addColorStop(1, "#a5f3fc")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // --- SUNLIGHT RAYS ---
      if (showSunRays) {
        aquaticState.sunRays.forEach((ray) => {
          ctx.save()
          ctx.globalAlpha = ray.opacity * (0.7 + 0.3 * Math.sin(time * ray.speed))
          const rayGradient = ctx.createLinearGradient(ray.x, 0, ray.x, canvas.height)
          rayGradient.addColorStop(0, "rgba(255, 255, 255, 0.18)")
          rayGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.07)")
          rayGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
          ctx.fillStyle = rayGradient
          ctx.fillRect(ray.x - ray.width / 2, 0, ray.width, canvas.height)
          ctx.restore()
        })
      }

      // --- FISH ---
      if (showFish) {
        aquaticState.fish.forEach((f) => {
          f.x += f.speed * f.direction
          f.y += Math.sin(time * 2 + f.swimOffset) * 0.5
          if (f.direction > 0 && f.x > canvas.width + f.size) {
            f.x = -f.size
          } else if (f.direction < 0 && f.x < -f.size) {
            f.x = canvas.width + f.size
          }
          ctx.save()
          ctx.globalAlpha = f.opacity
          ctx.fillStyle = "#1e293b"
          ctx.save()
          ctx.translate(f.x, f.y)
          ctx.scale(f.direction, 1)
          ctx.beginPath()
          ctx.ellipse(0, 0, f.size, f.size * 0.6, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(-f.size, 0)
          ctx.lineTo(-f.size * 1.5, -f.size * 0.3)
          ctx.lineTo(-f.size * 1.5, f.size * 0.3)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
          ctx.restore()
        })
      }

      // --- WATER PARTICLES ---
      if (showParticles) {
        aquaticState.particles.forEach((particle) => {
          particle.x += particle.speedX
          particle.y += particle.speedY
          particle.life -= 0.5
          if (particle.life <= 0) {
            particle.x = Math.random() * canvas.width
            particle.y = Math.random() * canvas.height
            particle.life = 100
          }
          ctx.save()
          ctx.globalAlpha = particle.opacity * (particle.life / 100)
          ctx.fillStyle = "rgba(173, 216, 230, 0.4)"
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, 1.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        })
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [showParticles, showSunRays, showFish])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  )
}