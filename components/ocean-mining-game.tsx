"use client"

import { useState, useEffect, useRef } from "react"
import { PlayerHUD } from "./player-hud"
import { SonarRadar } from "./sonar-radar"
import { ResourceSidebar } from "./resource-sidebar"
import { SubmarineStore } from "./submarine-store"
import { MineButton } from "./mine-button"
import { UpgradeModal } from "./upgrade-modal"
import { WalletInfo } from "./wallet-info"
import { StorageFullAlert } from "./storage-full-alert"
import { EnergyDepletedAlert } from "./energy-depleted-alert"
import { apiClient } from "@/lib/api"
import { walletManager } from "@/lib/wallet"
import { wsManager } from "@/lib/websocket"
import { ContractManager } from "@/lib/contracts"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { canMineResource, getStoragePercentage, getResourceColor } from "@/lib/resource-utils"
import type { GameState, ResourceNode, PlayerStats, PlayerResources, OtherPlayer, PlayerPosition } from "@/lib/types"
import { ShoppingCart } from "lucide-react"

interface OceanMiningGameProps {
  walletConnected: boolean
  gameState: GameState
  setGameState: (state: GameState) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  onFullDisconnect: () => void // NEW PROP
}

export function OceanMiningGame({
  walletConnected,
  gameState,
  setGameState,
  sidebarOpen,
  setSidebarOpen,
  onFullDisconnect, // NEW PROP
}: OceanMiningGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  // Player position and movement
  const [playerPosition, setPlayerPosition] = useState<PlayerPosition>({ x: 500, y: 500, rotation: 0 })
  const [movementKeys, setMovementKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
  })

  // Player stats and resources
  const [playerTier, setPlayerTier] = useState(1)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([])
  const submarineData = getSubmarineByTier(playerTier)

  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    ...submarineData.baseStats,
    energy: submarineData.baseStats.energy, // Start at max energy
    capacity: {
      nickel: 0,
      cobalt: 0,
      copper: 0,
      manganese: 0,
    },
  })

  const [resources, setResources] = useState<PlayerResources>({
    nickel: 0,
    cobalt: 0,
    copper: 0,
    manganese: 0,
  })

  const [balance, setBalance] = useState(0)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showSubmarineStore, setShowSubmarineStore] = useState(false)
  const [targetNode, setTargetNode] = useState<ResourceNode | null>(null)
  const [resourceNodes, setResourceNodes] = useState<ResourceNode[]>([])
  const [showStorageAlert, setShowStorageAlert] = useState(false)
  const [storagePercentage, setStoragePercentage] = useState(0)
  const [showEnergyAlert, setShowEnergyAlert] = useState(false)
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 })
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected")

  // --- AQUATIC FEATURE STATE ---
  const [aquaticState] = useState(() => {
    // Sunlight rays
    const sunRays = Array.from({ length: 8 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      width: 60 + Math.random() * 40,
      opacity: 0.12 + Math.random() * 0.08,
      speed: 0.5 + Math.random() * 0.5,
    }))
    // Seaweed
    const seaweed = Array.from({ length: 8 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      height: 80 + Math.random() * 60,
      segments: 8 + Math.floor(Math.random() * 4),
      swaySpeed: 0.5 + Math.random() * 0.5,
      swayAmount: 0.2 + Math.random() * 0.2,
      color: ["#14532d", "#166534", "#22c55e"][Math.floor(Math.random() * 3)],
    }))
    // Kelp
    const kelp = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      height: 120 + Math.random() * 80,
      segments: 10 + Math.floor(Math.random() * 4),
      swaySpeed: 0.3 + Math.random() * 0.3,
      swayAmount: 0.15 + Math.random() * 0.15,
      color: ["#a3e635", "#65a30d", "#4d7c0f"][Math.floor(Math.random() * 3)],
    }))
    // Coral
    const coral = Array.from({ length: 7 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight - 30 - Math.random() * 40,
      size: 30 + Math.random() * 20,
      color: ["#f472b6", "#fbbf24", "#f87171", "#facc15"][Math.floor(Math.random() * 4)],
      type: Math.floor(Math.random() * 3),
      glow: 0.5 + Math.random() * 0.5,
    }))
    // Fish
    const fish = Array.from({ length: 10 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: 100 + Math.random() * (window.innerHeight - 200),
      size: 12 + Math.random() * 8,
      speed: 0.7 + Math.random() * 0.7,
      direction: Math.random() > 0.5 ? 1 : -1,
      opacity: 0.5 + Math.random() * 0.5,
      swimOffset: Math.random() * Math.PI * 2,
    }))
    // Bubbles
    const bubbles = Array.from({ length: 18 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: 6 + Math.random() * 8,
      speed: 0.5 + Math.random() * 0.7,
      opacity: 0.3 + Math.random() * 0.5,
      wobble: Math.random() * 2,
    }))
    // Water particles
    const particles = Array.from({ length: 30 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      opacity: 0.2 + Math.random() * 0.3,
      life: 100,
    }))
    return { sunRays, seaweed, kelp, coral, fish, bubbles, particles }
  })

  // Generate initial resource nodes immediately when component mounts
  useEffect(() => {
    generateInitialResourceNodes()
  }, [])

  // Initialize WebSocket connection when wallet is connected
  useEffect(() => {
    if (walletConnected) {
      initializeGame()
    } else {
      cleanup()
    }

    return () => cleanup()
  }, [walletConnected])

  const initializeGame = async () => {
    try {
      setConnectionStatus("connecting")

      // Connect to WebSocket server
      await wsManager.connect()

      // Set up WebSocket event listeners
      wsManager.on("game-state", handleGameState)
      wsManager.on("player-joined", handlePlayerJoined)
      wsManager.on("player-left", handlePlayerLeft)
      wsManager.on("player-moved", handlePlayerMoved)
      wsManager.on("resource-mined", handleResourceMined)
      wsManager.on("error", handleWebSocketError)

      // Join game session
      const connection = walletManager.getConnection()
      if (connection) {
        const { message, signature } = createSignaturePayload(connection.address, "join game")
        const joinResponse = await apiClient.joinGame(connection.address, signature, message)
        if (joinResponse.success && joinResponse.data) {
          setSessionId(joinResponse.data.sessionId)
          wsManager.joinSession(connection.address, joinResponse.data.sessionId)

          // Load player data
          await loadPlayerData(connection.address)

          // Use server resource nodes if available, otherwise keep the generated ones
          if (joinResponse.data.resourceNodes && joinResponse.data.resourceNodes.length > 0) {
            console.log("Using server resource nodes:", joinResponse.data.resourceNodes.length)
            // Convert server nodes to match our 2D format
            const convertedNodes = joinResponse.data.resourceNodes.map((node: any) => ({
              id: node.id,
              position: { x: node.position.x, y: node.position.y },
              type: node.type,
              amount: node.amount,
              depleted: node.depleted || false,
              size: node.size || 15,
            }))
            setResourceNodes(convertedNodes)
          }
        }
      }

      setConnectionStatus("connected")
    } catch (error) {
      console.error("Failed to initialize game:", error)
      setConnectionStatus("disconnected")
      // Keep the generated nodes even if connection fails
    }
  }

  // Generate resource nodes function
  const generateInitialResourceNodes = () => {
    const types = ["nickel", "cobalt", "copper", "manganese"] as const
    const nodes: ResourceNode[] = []

    console.log("🎯 Generating resource nodes...")

    for (let i = 0; i < 30; i++) {
      const node: ResourceNode = {
        id: `node-${i}`,
        position: {
          x: Math.random() * 1800 + 100, // 100-1900 range
          y: Math.random() * 1800 + 100,
        },
        type: types[Math.floor(Math.random() * types.length)],
        amount: Math.floor(Math.random() * 15) + 5, // 5-20 resources per node
        depleted: false,
        size: Math.random() * 10 + 15, // Size between 15-25 for rendering
      }
      nodes.push(node)
    }

    console.log(`✅ Generated ${nodes.length} resource nodes`)
    setResourceNodes(nodes)
  }

  const cleanup = () => {
    wsManager.disconnect()
    setConnectionStatus("disconnected")
    setSessionId(null)
    setOtherPlayers([])
    // Don't clear resource nodes on cleanup - keep them for offline play
  }

  const loadPlayerData = async (walletAddress: string) => {
    try {
      const { message: balanceMessage, signature: balanceSignature } = createSignaturePayload(
        walletAddress,
        "get balance",
      )
      // Load player balance
      const balanceResponse = await apiClient.getPlayerBalance(walletAddress, balanceSignature, balanceMessage)
      if (balanceResponse.success && balanceResponse.data) {
        setBalance(Number.parseFloat(balanceResponse.data.balance))
      }

      const { message: submarineMessage, signature: submarineSignature } = createSignaturePayload(
        walletAddress,
        "get submarine",
      )
      // Load player submarine info
      const submarineResponse = await apiClient.getPlayerSubmarine(walletAddress, submarineSignature, submarineMessage)
      if (submarineResponse.success && submarineResponse.data) {
        const { current: currentSubmarine } = submarineResponse.data
        setPlayerTier(currentSubmarine.id)
        setPlayerStats({
          ...currentSubmarine,
          energy: submarineData.baseStats.energy, // Ensure energy is max on load
          capacity: {
            nickel: 0,
            cobalt: 0,
            copper: 0,
            manganese: 0,
          },
        })
      }
    } catch (error) {
      console.error("Failed to load player data:", error)
    }
  }

  // WebSocket event handlers
  const handleGameState = (state: any) => {
    if (state.resourceNodes && state.resourceNodes.length > 0) {
      setResourceNodes(state.resourceNodes)
    }
    // Map players to OtherPlayer shape
    setOtherPlayers(
      (state.players || []).filter((p: any) => p.id !== walletManager.getConnection()?.address)
    )
  }

  const handlePlayerJoined = (data: any) => {
    setOtherPlayers((prev) => {
      // Avoid duplicates
      if (prev.some((p) => p.id === data.id)) return prev
      return [...prev, data]
    })
  }

  const handlePlayerLeft = (data: any) => {
    setOtherPlayers((prev) => prev.filter((p) => p.id !== data.id))
  }

  const handlePlayerMoved = (data: any) => {
    setOtherPlayers((prev) => prev.map((p) => (p.id === data.id ? { ...p, position: data.position, rotation: data.rotation } : p)))
  }

  const handleResourceMined = (data: any) => {
    setResourceNodes((prev) =>
      prev.map((node) =>
        node.id === data.nodeId ? { ...node, amount: data.remainingAmount, depleted: data.depleted } : node,
      ),
    )

    // If this player mined the resource, update their inventory
    const connection = walletManager.getConnection()
    if (connection && data.minedBy === connection.address) {
      // Update resources based on node type
      const nodeType = resourceNodes.find((n) => n.id === data.nodeId)?.type
      if (nodeType) {
        setResources((prev) => ({
          ...prev,
          [nodeType]: prev[nodeType] + data.minedAmount,
        }))
      }
    }
  }

  const handleWebSocketError = (error: any) => {
    console.error("WebSocket error:", error)
    setConnectionStatus("disconnected")
  }

  // Update storage percentage when resources change
  useEffect(() => {
    const percentage = getStoragePercentage(resources, playerStats)
    setStoragePercentage(percentage)

    if (percentage >= 90 && percentage < 100) {
      setShowStorageAlert(true)
      setTimeout(() => setShowStorageAlert(false), 5000)
    }
  }, [resources, playerStats])

  // Check for energy depletion
  useEffect(() => {
    if (playerStats.energy <= 0) {
      setShowEnergyAlert(true)
      // Hide alert after 5 seconds
      setTimeout(() => setShowEnergyAlert(false), 5000)
    }
  }, [playerStats.energy])

  // Energy regeneration over time
  useEffect(() => {
    if (playerStats.energy > 0) return; // Only start regen when energy is 0
    // Calculate fill time in seconds for this tier
    const minFill = 20 * 60 // 20 min
    const maxFill = 45 * 60 // 45 min
    const tier = submarineData.baseStats.tier
    const fillTime = minFill + ((maxFill - minFill) * (tier - 1) / 14) // linear interpolation
    const regenRate = submarineData.baseStats.energy / fillTime // energy per second

    const energyRegenInterval = setInterval(() => {
      setPlayerStats((prev) => {
        const maxEnergy = submarineData.baseStats.energy
        if (prev.energy < maxEnergy) {
          return {
            ...prev,
            energy: Math.min(prev.energy + regenRate, maxEnergy),
          }
        }
        return prev;
      })
    }, 1000)
    return () => clearInterval(energyRegenInterval)
  }, [playerStats.energy, submarineData.baseStats.energy, submarineData.baseStats.tier])

  // Handle keyboard input for submarine movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow movement even when not connected to server
      if (!walletConnected) return

      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          setMovementKeys((prev) => ({ ...prev, forward: true }))
          break
        case "s":
        case "arrowdown":
          setMovementKeys((prev) => ({ ...prev, backward: true }))
          break
        case "a":
        case "arrowleft":
          setMovementKeys((prev) => ({ ...prev, left: true }))
          break
        case "d":
        case "arrowright":
          setMovementKeys((prev) => ({ ...prev, right: true }))
          break
        case "f":
          if (targetNode) handleMine(targetNode)
          break
        case "u":
          setShowUpgradeModal(true)
          break
        case "i":
          setSidebarOpen((prev) => !prev)
          break
        case "p":
          setShowSubmarineStore(true)
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          setMovementKeys((prev) => ({ ...prev, forward: false }))
          break
        case "s":
        case "arrowdown":
          setMovementKeys((prev) => ({ ...prev, backward: false }))
          break
        case "a":
        case "arrowleft":
          setMovementKeys((prev) => ({ ...prev, left: false }))
          break
        case "d":
        case "arrowright":
          setMovementKeys((prev) => ({ ...prev, right: false }))
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [walletConnected, targetNode, setSidebarOpen])

  // Game loop - runs even when not connected to server for offline play
  useEffect(() => {
    if (!walletConnected) return

    const gameLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const deltaTime = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp

      if (gameState !== "mining") {
        updatePlayerPosition(deltaTime)
      }

      checkNearbyNodes()
      renderGame()

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(gameLoopRef.current)
    }
  }, [walletConnected, playerPosition, movementKeys, gameState, resourceNodes, playerStats.speed])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const updatePlayerPosition = (deltaTime: number) => {
    if (playerStats.energy === 0) return; // Block movement when energy is 0
    const speed = playerStats.speed * 0.2 * (deltaTime / 16)
    let newX = playerPosition.x
    let newY = playerPosition.y
    let newRotation = playerPosition.rotation

    if (movementKeys.left) {
      newRotation -= 0.05
    }
    if (movementKeys.right) {
      newRotation += 0.05
    }
    if (movementKeys.forward) {
      newX += Math.cos(newRotation) * speed
      newY += Math.sin(newRotation) * speed
    }
    if (movementKeys.backward) {
      newX -= Math.cos(newRotation) * speed
      newY -= Math.sin(newRotation) * speed
    }

    newX = Math.max(50, Math.min(1950, newX))
    newY = Math.max(50, Math.min(1950, newY))

    const newPosition = { x: newX, y: newY, rotation: newRotation }
    setPlayerPosition(newPosition)

    // Send position update to server if connected
    if (connectionStatus === "connected" && sessionId && walletManager.getConnection()) {
      wsManager.sendPlayerMove(newPosition, walletManager.getConnection().address, sessionId)
    }

    const canvas = canvasRef.current
    if (canvas) {
      setViewportOffset({
        x: Math.max(0, Math.min(1000, newX - canvas.width / 2)),
        y: Math.max(0, Math.min(1000, newY - canvas.height / 2)),
      })
    }
  }

  const checkNearbyNodes = () => {
    const nearbyNode = resourceNodes.find((node) => {
      if (node.depleted) return false

      const dx = node.position.x - playerPosition.x
      const dy = node.position.y - playerPosition.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      return distance < 60
    })

    setTargetNode(nearbyNode || null)
  }

  const renderGame = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const time = Date.now() / 1000

    // --- OCEAN GRADIENT BACKGROUND ---
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    gradient.addColorStop(0, "#0f172a") // Deep ocean blue
    gradient.addColorStop(0.3, "#1e293b")
    gradient.addColorStop(0.6, "#334155")
    gradient.addColorStop(1, "#475569") // Lighter blue at bottom
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // --- SUNLIGHT RAYS ---
    aquaticState.sunRays.forEach((ray) => {
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

    // --- SEAWEED ---
    aquaticState.seaweed.forEach((weed) => {
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

    // --- KELP ---
    aquaticState.kelp.forEach((k) => {
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

    // --- CORAL ---
    aquaticState.coral.forEach((c) => {
      ctx.save()
      ctx.globalAlpha = c.glow * (0.8 + 0.2 * Math.sin(time * 2))
      ctx.fillStyle = c.color
      if (c.type === 0) {
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.size / 2, 0, Math.PI * 2)
        ctx.fill()
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2
          const branchX = c.x + Math.cos(angle) * c.size * 0.3
          const branchY = c.y + Math.sin(angle) * c.size * 0.3
          ctx.beginPath()
          ctx.arc(branchX, branchY, c.size / 4, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (c.type === 1) {
        ctx.beginPath()
        ctx.ellipse(c.x, c.y, c.size / 2, c.size / 3, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(c.x - c.size / 6, c.y - c.size, c.size / 3, c.size)
        ctx.beginPath()
        ctx.arc(c.x, c.y - c.size, c.size / 6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    })

    // --- FISH ---
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

    // --- BUBBLES ---
    aquaticState.bubbles.forEach((bubble) => {
      bubble.y -= bubble.speed
      bubble.x += Math.sin(time * bubble.wobble + bubble.y * 0.01) * 0.5
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
      ctx.globalAlpha = bubble.opacity * 0.8
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
      ctx.beginPath()
      ctx.arc(bubble.x - bubble.size * 0.3, bubble.y - bubble.size * 0.3, bubble.size * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })

    // --- WATER PARTICLES ---
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

    // Draw grid
    ctx.strokeStyle = "#1e40af30"
    ctx.lineWidth = 1
    const gridSize = 100
    const offsetX = -viewportOffset.x % gridSize
    const offsetY = -viewportOffset.y % gridSize

    for (let x = offsetX; x < canvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }

    for (let y = offsetY; y < canvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Draw resource nodes as colored circles
    let visibleNodes = 0
    resourceNodes.forEach((node) => {
      if (node.depleted) return

      const screenX = node.position.x - viewportOffset.x
      const screenY = node.position.y - viewportOffset.y

      // Only render nodes that are visible on screen
      if (screenX > -100 && screenX < canvas.width + 100 && screenY > -100 && screenY < canvas.height + 100) {
        visibleNodes++
        const resourceColor = getResourceColor(node.type)
        const nodeSize = node.size || 20

        // Draw outer glow
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, nodeSize * 1.5)
        gradient.addColorStop(0, resourceColor + "80")
        gradient.addColorStop(0.7, resourceColor + "40")
        gradient.addColorStop(1, resourceColor + "00")
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(screenX, screenY, nodeSize * 1.5, 0, Math.PI * 2)
        ctx.fill()

        // Draw main resource node circle
        ctx.fillStyle = resourceColor
        ctx.beginPath()
        ctx.arc(screenX, screenY, nodeSize, 0, Math.PI * 2)
        ctx.fill()

        // Add subtle pulsing effect
        const pulseSize = nodeSize + Math.sin(Date.now() / 1000) * 2
        ctx.strokeStyle = resourceColor + "AA"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(screenX, screenY, pulseSize, 0, Math.PI * 2)
        ctx.stroke()

        // Draw resource type indicator
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 14px Arial"
        ctx.textAlign = "center"
        ctx.shadowColor = "#000000"
        ctx.shadowBlur = 2
        ctx.fillText(getResourceEmoji(node.type), screenX, screenY + 4)
        ctx.shadowBlur = 0

        // Highlight target node
        if (targetNode && node.id === targetNode.id) {
          ctx.strokeStyle = "#ffffff"
          ctx.lineWidth = 3
          ctx.setLineDash([5, 5])
          ctx.beginPath()
          ctx.arc(screenX, screenY, nodeSize + 8, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])

          // Show resource info
          ctx.fillStyle = "#ffffff"
          ctx.font = "bold 12px Arial"
          ctx.textAlign = "center"
          ctx.shadowColor = "#000000"
          ctx.shadowBlur = 2
          ctx.fillText(
            `${node.type.charAt(0).toUpperCase() + node.type.slice(1)} (${node.amount})`,
            screenX,
            screenY - nodeSize - 15,
          )
          ctx.shadowBlur = 0
        }
      }
    })

    // Debug info for resource nodes
    if (resourceNodes.length > 0) {
      ctx.fillStyle = "#00ff00"
      ctx.font = "12px Arial"
      ctx.fillText(`Nodes: ${resourceNodes.length} | Visible: ${visibleNodes}`, 10, 30)
    }

    // Draw other players
    otherPlayers.forEach((player) => {
      const screenX = player.position.x - viewportOffset.x
      const screenY = player.position.y - viewportOffset.y

      if (screenX > -50 && screenX < canvas.width + 50 && screenY > -50 && screenY < canvas.height + 50) {
        drawSubmarine(ctx, screenX, screenY, player.rotation || 0, "#22d3ee")

        ctx.fillStyle = "#ffffff"
        ctx.font = "12px Arial"
        ctx.textAlign = "center"
        ctx.fillText(player.username || `${player.id.slice(0, 6)}...`, screenX, screenY - 40)
      }
    })

    // Draw player submarine
    const screenX = playerPosition.x - viewportOffset.x
    const screenY = playerPosition.y - viewportOffset.y
    drawSubmarine(ctx, screenX, screenY, playerPosition.rotation, submarineData.color)

    // Draw bubbles if moving
    if (movementKeys.forward || movementKeys.backward) {
      for (let i = 0; i < 3; i++) {
        const bubbleX = screenX - Math.cos(playerPosition.rotation) * 30 + (Math.random() - 0.5) * 20
        const bubbleY = screenY - Math.sin(playerPosition.rotation) * 30 + (Math.random() - 0.5) * 20
        const bubbleSize = Math.random() * 5 + 2

        ctx.fillStyle = "#7dd3fc60"
        ctx.beginPath()
        ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  const drawSubmarine = (ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, color: string) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)

    // Draw submarine body
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2)
    ctx.fill()

    // Draw submarine conning tower
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(0, -10, 10, 5, 0, 0, Math.PI)
    ctx.fill()

    // Draw viewport
    ctx.fillStyle = "#7dd3fc"
    ctx.beginPath()
    ctx.arc(15, 0, 5, 0, Math.PI * 2)
    ctx.fill()

    // Draw propeller
    ctx.fillStyle = "#475569"
    ctx.beginPath()
    ctx.ellipse(-25, 0, 5, 10, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  const handleMine = async (node: ResourceNode) => {
    if (!walletConnected || gameState !== "idle" || !targetNode) return

    setGameState("mining")

    // Check if player has enough storage
    const { canMine, amountToMine } = canMineResource(playerStats, resources, node.type, node.amount)

    if (!canMine) {
      setShowStorageAlert(true)
      setTimeout(() => {
        setShowStorageAlert(false)
        setGameState("idle")
      }, 2000)
      return
    }

    try {
      // Send mining request to server if connected
      if (connectionStatus === "connected") {
        wsManager.mineResource(node.id)
      }

      // Update local state optimistically
      setResources((prev) => ({
        ...prev,
        [node.type]: prev[node.type] + amountToMine,
      }))

      setPlayerStats((prev) => ({
        ...prev,
        energy: Math.max(prev.energy - 5, 0),
        capacity: {
          ...prev.capacity,
          [node.type]: prev.capacity[node.type] + amountToMine,
        },
      }))

      // Update the node locally
      setResourceNodes((prev) =>
        prev.map((n) =>
          n.id === node.id
            ? {
                ...n,
                amount: Math.max(0, n.amount - amountToMine),
                depleted: n.amount - amountToMine <= 0,
              }
            : n,
        ),
      )

      setGameState("resourceGained")

      setTimeout(() => {
        setGameState("idle")
      }, 2000)
    } catch (error) {
      console.error("Mining failed:", error)
      setGameState("idle")
    }
  }

  // Calculate total storage used and capacity
  const totalUsed = resources.nickel + resources.cobalt + resources.copper + resources.manganese;
  const totalCapacity = playerStats.maxCapacity.nickel + playerStats.maxCapacity.cobalt + playerStats.maxCapacity.copper + playerStats.maxCapacity.manganese;

  async function tradeAllResources(resources, maxCapacities) {
    const response = await fetch("/daily-trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resources, maxCapacities }),
    });
    return await response.json();
  }

  const handleTradeAll = async () => {
    if (totalUsed < totalCapacity) return; // Only allow if full
    setGameState("trading");
    try {
      const result = await tradeAllResources(resources, playerStats.maxCapacity);
      if (result.success) {
        setResources({ nickel: 0, cobalt: 0, copper: 0, manganese: 0 });
        setPlayerStats((prev) => ({
          ...prev,
          capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
        }));
        setBalance((prev) => prev + result.data.ocxEarned);
        setGameState("resourceTraded");
        setTimeout(() => setGameState("idle"), 2000);
      } else {
        alert(result.error || "Trade failed");
        setGameState("idle");
      }
    } catch (e) {
      alert("Trade failed. Please try again.");
      setGameState("idle");
    }
  };

  const handleTrade = async (resourceType: keyof PlayerResources) => {
    if (resources[resourceType] <= 0) return

    setGameState("trading")

    setTimeout(() => {
      const value = Math.floor(Math.random() * 10) + 5

      setResources((prev) => ({
        ...prev,
        [resourceType]: prev[resourceType] - 1,
      }))

      setPlayerStats((prev) => ({
        ...prev,
        capacity: {
          ...prev.capacity,
          [resourceType]: prev.capacity[resourceType] - 1,
        },
      }))

      setBalance((prev) => prev + value)

      setGameState("resourceTraded")

      setTimeout(() => {
        setGameState("idle")
      }, 2000)
    }, 1500)
  }

  const handleUpgradeSubmarine = async () => {
    if (playerTier >= 15) return

    setGameState("upgrading")

    try {
      const connection = walletManager.getConnection()
      if (!connection) {
        throw new Error("Wallet not connected")
      }

      const { message, signature } = createSignaturePayload(connection.address, "upgrade submarine")
      const upgradeResponse = await apiClient.upgradeSubmarine(connection.address, signature, message)

      if (!upgradeResponse.success || !upgradeResponse.data) {
        throw new Error(upgradeResponse.error || "Failed to get upgrade info")
      }

      const { newTier } = upgradeResponse.data

      const tx = await ContractManager.upgradeSubmarine(newTier.id)
      await tx.wait()

      const nextSubmarineData = getSubmarineByTier(newTier.id)
      setPlayerTier(newTier.id)
      setPlayerStats({
        ...nextSubmarineData.baseStats,
        capacity: { ...playerStats.capacity },
      })

      await loadPlayerData(connection.address)

      setGameState("upgraded")

      setTimeout(() => {
        setShowUpgradeModal(false)
        setGameState("idle")
      }, 2000)
    } catch (error) {
      console.error("Upgrade failed:", error)
      setGameState("idle")
    }
  }

  const handleSubmarinePurchase = async (targetTier: number) => {
    if (targetTier <= playerTier) return

    setGameState("upgrading")

    try {
      const connection = walletManager.getConnection()
      if (!connection) {
        throw new Error("Wallet not connected")
      }

      const { message, signature } = createSignaturePayload(connection.address, "upgrade submarine")
      const upgradeResponse = await apiClient.upgradeSubmarine(connection.address, signature, message)

      if (!upgradeResponse.success || !upgradeResponse.data) {
        throw new Error(upgradeResponse.error || "Failed to get upgrade info")
      }

      const tx = await ContractManager.upgradeSubmarine(targetTier)
      await tx.wait()

      const nextSubmarineData = getSubmarineByTier(targetTier)
      setPlayerTier(targetTier)
      setPlayerStats({
        ...nextSubmarineData.baseStats,
        capacity: { ...playerStats.capacity },
      })

      await loadPlayerData(connection.address)

      setGameState("upgraded")

      setTimeout(() => {
        setShowSubmarineStore(false)
        setGameState("idle")
      }, 2000)
    } catch (error) {
      console.error("Submarine purchase failed:", error)
      setGameState("idle")
    }
  }

  const handleClaimDailyReward = async () => {
    try {
      const connection = walletManager.getConnection()
      if (!connection) {
        throw new Error("Wallet not connected")
      }

      const { message, signature } = createSignaturePayload(connection.address, "claim daily reward")
      const claimResponse = await apiClient.claimDailyReward(connection.address, signature, message)

      if (!claimResponse.success) {
        throw new Error(claimResponse.error || "Failed to claim daily reward via API")
      }

      const tx = await ContractManager.claimDailyReward()
      await tx.wait()

      await loadPlayerData(connection.address)

      alert("Daily reward claimed successfully!")
    } catch (error) {
      console.error("Failed to claim daily reward:", error)
      alert("Failed to claim daily reward. Please try again.")
    }
  }

  const createSignaturePayload = (address: string, action: string) => {
    const message = `Sign this message to ${action} with your account ${address}`
    const signature = walletManager.signMessage(message)

    return { message, signature }
  }

  const getResourceEmoji = (resourceType: string) => {
    switch (resourceType) {
      case "nickel":
        return "Ni"
      case "cobalt":
        return "Co"
      case "copper":
        return "Cu"
      case "manganese":
        return "Mn"
      default:
        return "?"
    }
  }

  const handleDisconnect = () => {
    cleanup();
    setGameState("idle");
    setSidebarOpen(false);
    onFullDisconnect(); // Call parent to fully disconnect and return to landing page
  };

  return (
    <div className="relative h-full w-full">
      {/* Game Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* HUD Overlay */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Connection Status */}
        {connectionStatus !== "connected" && walletConnected && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 transform rounded-lg bg-slate-900/80 px-4 py-2 text-cyan-400 backdrop-blur-sm">
            {connectionStatus === "connecting" ? "Connecting to game server..." : "Playing offline"}
          </div>
        )}

        {/* Player Stats HUD */}
        <PlayerHUD stats={playerStats} resources={resources} tier={playerTier} />

        {/* Sonar/Mini-map */}
        <SonarRadar
          playerPosition={playerPosition}
          resourceNodes={resourceNodes}
          otherPlayers={otherPlayers}
          viewportOffset={viewportOffset}
        />

        {/* Wallet Info (when connected) */}
        {walletConnected && <WalletInfo balance={balance} />}
        <br />
        {/* Resource Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="pointer-events-auto absolute right-4 top-16 z-50 rounded-lg bg-slate-800/80 p-2 text-cyan-400 backdrop-blur-sm transition-all hover:bg-slate-700/80"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 8h14M5 12h14M5 16h14" />
          </svg>
        </button>

        {/* Submarine Store Button */}
        <button
          onClick={() => setShowSubmarineStore(true)}
          className="pointer-events-auto absolute right-4 top-28 z-50 rounded-lg bg-slate-800/80 p-2 text-cyan-400 backdrop-blur-sm transition-all hover:bg-slate-700/80"
          disabled={gameState !== "idle"}
        >
          <ShoppingCart className="h-6 w-6" />
        </button>

        {/* Upgrade Button */}
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="pointer-events-auto absolute right-4 top-40 z-50 rounded-lg bg-slate-800/80 p-2 text-cyan-400 backdrop-blur-sm transition-all hover:bg-slate-700/80"
          disabled={gameState !== "idle"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 8-9.04 9.06a2.82 2.82 0 1 0 3.98 3.98L16 12" />
            <circle cx="17" cy="7" r="5" />
          </svg>
        </button>

        {/* Daily Reward Button */}
        <button
          onClick={handleClaimDailyReward}
          className="pointer-events-auto absolute right-4 top-52 z-50 rounded-lg bg-slate-800/80 p-2 text-cyan-400 backdrop-blur-sm transition-all hover:bg-slate-700/80"
          disabled={gameState !== "idle"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
          </svg>
        </button>

        {/* Resource Sidebar */}
        <ResourceSidebar
          isOpen={sidebarOpen}
          resources={resources}
          balance={balance}
          onTradeAll={handleTradeAll}
          gameState={gameState}
          playerStats={playerStats}
          onDisconnect={handleDisconnect}
        />

        {/* Mine Button - only show when near a resource */}
        {targetNode && (
          <MineButton
            onClick={() => handleMine(targetNode)}
            disabled={!walletConnected || gameState !== "idle"}
            gameState={gameState}
            resourceType={targetNode.type}
            resourceAmount={targetNode.amount}
          />
        )}

        {/* Storage Full Alert */}
        {showStorageAlert && <StorageFullAlert percentage={storagePercentage} />}

        {/* Energy Depleted Alert */}
        {showEnergyAlert && <EnergyDepletedAlert energy={playerStats.energy} />}

        {/* Game State Notifications */}
        {gameState !== "idle" && (
          <div className="pointer-events-none absolute left-1/2 top-1/4 -translate-x-1/2 transform rounded-lg bg-slate-900/80 px-6 py-3 text-lg font-bold text-cyan-400 backdrop-blur-sm">
            {gameState === "mining" && "Mining in progress..."}
            {gameState === "resourceGained" && "Resource acquired!"}
            {gameState === "trading" && "Trading resource..."}
            {gameState === "resourceTraded" && "Resource traded successfully!"}
            {gameState === "upgrading" && "Upgrading submarine..."}
            {gameState === "upgraded" && "Submarine upgraded successfully!"}
          </div>
        )}

        {/* Session Info */}
        {sessionId && (
          <div className="absolute bottom-4 left-4 rounded-lg bg-slate-900/70 p-3 text-xs text-slate-300 backdrop-blur-sm">
            <div className="mb-1 font-bold text-cyan-400">SESSION INFO</div>
            <div>Session: {sessionId.slice(-8)}</div>
            <div>Players: {otherPlayers.length + 1}/20</div>
            <div>Status: {connectionStatus}</div>
          </div>
        )}

        {/* No Wallet Connected Overlay */}
        {!walletConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="rounded-xl bg-slate-800/90 p-8 text-center text-white shadow-2xl shadow-cyan-900/30 transition-all hover:shadow-cyan-900/50">
              <h2 className="mb-4 text-2xl font-bold text-cyan-400">Connect Wallet to Play</h2>
              <p className="mb-6 text-slate-300">
                Connect your Web3 wallet to start mining resources from the ocean floor.
              </p>
              <button
                onClick={() => {}}
                className="pointer-events-auto rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-3 font-medium text-white shadow-lg shadow-cyan-900/30 transition-all hover:shadow-cyan-900/50"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submarine Store */}
      <SubmarineStore
        isOpen={showSubmarineStore}
        onClose={() => setShowSubmarineStore(false)}
        currentTier={playerTier}
        resources={resources}
        balance={balance}
        onPurchase={handleSubmarinePurchase}
        gameState={gameState}
      />

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal
          currentTier={playerTier}
          resources={resources}
          balance={balance}
          onUpgrade={handleUpgradeSubmarine}
          onClose={() => setShowUpgradeModal(false)}
          gameState={gameState}
        />
      )}
    </div>
  )
}
