"use client"

import { useState, useEffect, useRef } from "react"
import { PlayerHUD } from "./player-hud"
// import { Compass } from "./compass"
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
import { ScubaDiverGuide } from "./ScubaDiverGuide"

interface OceanMiningGameProps {
  walletConnected: boolean
  gameState: GameState
  setGameState: (state: GameState) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
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

  // --- CINEMATIC FEEDBACK STATE ---
  const [screenShake, setScreenShake] = useState<{ active: boolean; intensity: number; duration: number; time: number }>({ active: false, intensity: 0, duration: 0, time: 0 })
  const [colorGrade, setColorGrade] = useState<{ active: boolean; tint: string; opacity: number; duration: number; time: number }>({ active: false, tint: '#0ea5e9', opacity: 0.0, duration: 0, time: 0 })
  const [particleBursts, setParticleBursts] = useState<Array<{ x: number, y: number, color: string, particles: Array<{ x: number, y: number, vx: number, vy: number, life: number }> }>>([])

  // --- CINEMATIC FEEDBACK UTILS ---

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
  const [walletAddress, setWalletAddress] = useState<string>("")
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
  const [showGuide, setShowGuide] = useState(true);

  // --- AQUATIC FEATURE STATE ---
  const [aquaticState] = useState(() => {
    // Sunlight rays
    const sunRays = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      width: 80 + Math.random() * 60,
      opacity: 0.10 + Math.random() * 0.10,
      speed: 0.4 + Math.random() * 0.4,
    }))
    // No kelp, seaweed, bubbles, or coral/flowers
    const seaweed: Array<any> = []
    const kelp: Array<any> = []
    const coral: Array<any> = []
    const fish = Array.from({ length: 10 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: 100 + Math.random() * (window.innerHeight - 200),
      size: 12 + Math.random() * 8,
      speed: 0.7 + Math.random() * 0.7,
      direction: Math.random() > 0.5 ? 1 : -1,
      opacity: 0.5 + Math.random() * 0.5,
      swimOffset: Math.random() * Math.PI * 2,
    }))
    const bubbles: Array<any> = []
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
    generateInitialResourceNodes();
    const init = async () => {
      try {
        setConnectionStatus("connecting");
        await wsManager.connect();
        wsManager.on("game-state", handleGameState);
        wsManager.on("player-joined", handlePlayerJoined);
        wsManager.on("player-left", handlePlayerLeft);
        wsManager.on("player-moved", handlePlayerMoved);
        wsManager.on("resource-mined", handleResourceMined);
        wsManager.on("error", handleWebSocketError);
        const connection = walletManager.getConnection();
        if (connection) {
          setWalletAddress(connection.address);
          console.log("[OceanMiningGame] Calling wsManager.joinSession with:", { address: connection.address, sessionId: "global" });
          wsManager.joinSession(connection.address, "global");
          await loadPlayerData(connection.address);
        } else {
          console.warn("[OceanMiningGame] walletManager.getConnection() returned null or undefined");
        }
        setConnectionStatus("connected");
      } catch (error) {
        console.error("Failed to initialize game:", error);
        setConnectionStatus("disconnected");
      }
    };
    if (walletConnected) {
      init();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletConnected]);

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
      const balancePayload = await createSignaturePayload(
        walletAddress,
        "get balance",
      )
      // Load player balance
      const balanceResponse = await apiClient.getPlayerBalance(walletAddress, balancePayload.signature, balancePayload.message)
      if (balanceResponse.success && balanceResponse.data) {
        setBalance(Number.parseFloat(balanceResponse.data.balance))
      }

      const submarinePayload = await createSignaturePayload(
        walletAddress,
        "get submarine",
      )
      // Load player submarine info
      const submarineResponse = await apiClient.getPlayerSubmarine(walletAddress, submarinePayload.signature, submarinePayload.message)
      if (submarineResponse.success && submarineResponse.data) {
        const { current: currentSubmarine } = submarineResponse.data
        setPlayerTier(currentSubmarine.id)
        setPlayerStats({
          health: 100, // Default health
          energy: submarineData.baseStats.energy, // Ensure energy is max on load
          capacity: {
            nickel: 0,
            cobalt: 0,
            copper: 0,
            manganese: 0,
          },
          maxCapacity: {
            nickel: currentSubmarine.storage,
            cobalt: currentSubmarine.storage,
            copper: currentSubmarine.storage,
            manganese: currentSubmarine.storage,
          },
          depth: 0, // Default depth
          speed: currentSubmarine.speed,
          miningRate: currentSubmarine.miningPower,
          tier: currentSubmarine.id,
        })
      }
    } catch (error) {
      console.error("Failed to load player data:", error)
    }
  }

  // WebSocket event handlers
  const handleGameState = (state: any) => {
    console.log("Received game state:", state);
    
    // Handle resource nodes
    if (state.resources && state.resources.length > 0) {
      setResourceNodes(state.resources);
    } else if (state.resourceNodes && state.resourceNodes.length > 0) {
      setResourceNodes(state.resourceNodes);
    }
    
    // Handle players - map server player format to OtherPlayer format
    if (state.players && Array.isArray(state.players)) {
      const currentWalletAddress = walletManager.getConnection()?.address;
      console.log("Current wallet address:", currentWalletAddress);
      console.log("All players in state:", state.players);
      
      const otherPlayersData = state.players
        .filter((p: any) => {
          const playerId = p.id || p.walletAddress;
          const isCurrentPlayer = playerId && playerId.toLowerCase() === (currentWalletAddress || '').toLowerCase();
          console.log(`Player ${playerId}, isCurrentPlayer: ${isCurrentPlayer}`);
          return !isCurrentPlayer;
        })
        .map((p: any) => {
          // Convert server player format to OtherPlayer format
          const posX = p.position?.x || 0;
          const posY = p.position?.y || 0;
          const rotation = p.position?.rotation || 0;
          
          return {
            id: p.id || p.walletAddress,
            username: p.username || `Player-${(p.id || p.walletAddress)?.substring(0, 6) || ''}`,
            position: { x: posX, y: posY },
            rotation: rotation,
            submarineType: p.submarineTier || 1
          };
        });
      
      console.log("Setting other players:", otherPlayersData);
      setOtherPlayers(otherPlayersData);
    }
  }

  const handlePlayerJoined = (data: any) => {
    console.log("Player joined:", data);
    const playerId = data.id || data.walletAddress;
    
    // Skip adding self
    if (playerId === walletManager.getConnection()?.address) {
      console.log("Skipping self in player-joined");
      return;
    }
    
    setOtherPlayers((prev) => {
      // Avoid duplicates
      if (prev.some((p) => p.id === playerId)) return prev;
      
      // Convert to OtherPlayer format
      const newPlayer: OtherPlayer = {
        id: playerId,
        username: data.username || `Player-${playerId.substring(0, 6)}`,
        position: { 
          x: data.position?.x || 0, 
          y: data.position?.y || 0 
        },
        rotation: data.position?.rotation || 0,
        submarineType: data.submarineTier || 1
      };
      
      console.log("Adding new player:", newPlayer);
      return [...prev, newPlayer];
    });
  }

  const handlePlayerLeft = (data: any) => {
    console.log("Player left:", data);
    const playerId = data.id || data.walletAddress;
    setOtherPlayers((prev) => prev.filter((p) => p.id !== playerId));
  }

  const handlePlayerMoved = (data: any) => {
    console.log("Player moved:", data);
    const playerId = data.id || data.walletAddress;
    
    // Skip updating self
    if (playerId === walletManager.getConnection()?.address) {
      console.log("Skipping self in player-moved");
      return;
    }
    
    setOtherPlayers((prev) => prev.map((p) => {
      if (p.id === playerId) {
        return {
          ...p,
          position: {
            x: data.position?.x !== undefined ? data.position.x : p.position.x,
            y: data.position?.y !== undefined ? data.position.y : p.position.y
          },
          rotation: data.position?.rotation !== undefined ? data.position.rotation : p.rotation
        };
      }
      return p;
    }));
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
    const connection = walletManager.getConnection()
    if (connectionStatus === "connected" && sessionId && connection) {
      wsManager.sendPlayerMove(newPosition, connection.address, sessionId)
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

  // --- CINEMATIC FEEDBACK UTILS ---
  const triggerScreenShake = (intensity = 8, duration = 0.3) => {
    setScreenShake({ active: true, intensity, duration, time: 0 })
  }
  const triggerColorGrade = (tint = '#0ea5e9', opacity = 0.18, duration = 0.5) => {
    setColorGrade({ active: true, tint, opacity, duration, time: 0 })
  }
  const triggerParticleBurst = (x: number, y: number, color = '#fbbf24') => {
    const particles = Array.from({ length: 18 }, () => ({
      x, y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 30 + Math.random() * 10
    }))
    setParticleBursts((prev) => [...prev, { x, y, color, particles }])
  }

  const renderGame = () => {

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const time = Date.now() / 1000

    // --- SCREEN SHAKE ---
    let shakeX = 0, shakeY = 0
    if (screenShake.active) {
      const shake = screenShake.intensity * Math.sin(screenShake.time * 40 + Math.random() * 10)
      shakeX = shake * (Math.random() - 0.5)
      shakeY = shake * (Math.random() - 0.5)
      // Use functional update to avoid stale closure
      setScreenShake((prev) => {
        const newTime = prev.time + 0.016
        if (newTime > prev.duration) {
          return { ...prev, active: false, intensity: 0, duration: 0, time: 0 }
        }
        return { ...prev, time: newTime }
      })
    }
    ctx.save()
    ctx.translate(shakeX, shakeY)

  // --- OCEAN GRADIENT BACKGROUND ---
  // Modern ocean gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, "#0f172a")
  gradient.addColorStop(0.2, "#164e63")
  gradient.addColorStop(0.5, "#2563eb")
  gradient.addColorStop(0.8, "#38bdf8")
  gradient.addColorStop(1, "#a5f3fc")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
    // --- PARTICLE BURSTS ---
    setParticleBursts((prev: typeof particleBursts) => prev.map((burst) => {
      burst.particles.forEach((p: typeof burst.particles[0]) => {
        p.x += p.vx
        p.y += p.vy
        p.life -= 1
      })
      burst.particles = burst.particles.filter((p: typeof burst.particles[0]) => p.life > 0)
      return burst
    }).filter((b) => b.particles.length > 0))
    particleBursts.forEach((burst) => {
      burst.particles.forEach((p) => {
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.life / 30)
        ctx.fillStyle = burst.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
    })
    ctx.restore() // end screen shake
    // --- COLOR GRADING OVERLAY ---
    if (colorGrade.active) {
      ctx.save()
      ctx.globalAlpha = colorGrade.opacity
      ctx.fillStyle = colorGrade.tint
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      setColorGrade((prev) => {
        const newTime = prev.time + 0.016
        if (newTime > prev.duration) {
          return { ...prev, active: false, opacity: 0, duration: 0, time: 0 }
        }
        return { ...prev, time: newTime }
      })
    }
  // Example: trigger effects on mining (replace with actual event hooks)
  // useEffect(() => { triggerScreenShake(); triggerColorGrade(); triggerParticleBurst(300, 300); }, [])

    // --- SUNLIGHT RAYS ---
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

    // --- SEAWEED ---
  // No seaweed

    // --- KELP ---
  // No kelp

    // --- CORAL ---
  // No coral/flower features

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
  // No bubbles

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
      drawResourceNode(ctx, node, viewportOffset, targetNode)
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
  drawSubmarine(ctx, screenX, screenY, player.rotation || 0, "#22d3ee", 1, false)

        ctx.fillStyle = "#ffffff"
        ctx.font = "12px Arial"
        ctx.textAlign = "center"
        ctx.fillText(player.username || `${player.id.slice(0, 6)}...`, screenX, screenY - 40)
      }
    })

    // Draw player submarine
    const screenX = playerPosition.x - viewportOffset.x
    const screenY = playerPosition.y - viewportOffset.y
  drawSubmarine(ctx, screenX, screenY, playerPosition.rotation, submarineData.color, playerTier, movementKeys.forward)

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

  // Modular submarine drawing with shadow, highlight, and engine glow
  const drawSubmarine = (ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, color: string, tier: number, movingForward: boolean) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    // Drop shadow
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.ellipse(8, 18, 32, 12, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#000'
    ctx.filter = 'blur(4px)'
    ctx.fill()
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    // Sub body (color by tier)
    let subColor: string | CanvasGradient = color
    if (tier >= 3) {
      const grad = ctx.createLinearGradient(-30, 0, 30, 0)
      grad.addColorStop(0, '#38bdf8')
      grad.addColorStop(1, '#fbbf24')
      subColor = grad
    }
    if (tier >= 5) subColor = '#a21caf'
    ctx.fillStyle = subColor
    ctx.beginPath()
    ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2)
    ctx.fill()
    // Highlight
    ctx.globalAlpha = 0.18
    ctx.beginPath()
    ctx.ellipse(0, -8, 22, 6, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.globalAlpha = 1
    // Engine glow if moving forward
    if (movingForward) {
      ctx.save()
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(Date.now() / 120)
      ctx.beginPath()
      ctx.ellipse(-32, 0, 16, 8, 0, 0, Math.PI * 2)
      ctx.fillStyle = tier >= 3 ? '#fbbf24' : '#22d3ee'
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = 16
      ctx.fill()
      ctx.restore()
    }
    // Conning tower
    ctx.fillStyle = typeof subColor === 'string' ? subColor : '#38bdf8'
    ctx.beginPath()
    ctx.ellipse(0, -10, 10, 5, 0, 0, Math.PI)
    ctx.fill()
    // Viewport
    ctx.fillStyle = "#7dd3fc"
    ctx.beginPath()
    ctx.arc(15, 0, 5, 0, Math.PI * 2)
    ctx.fill()
    // Propeller
    ctx.fillStyle = "#475569"
    ctx.beginPath()
    ctx.ellipse(-25, 0, 5, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Modular resource node drawing with glow, shading, and info
  const drawResourceNode = (
    ctx: CanvasRenderingContext2D,
    node: ResourceNode,
    viewportOffset: { x: number; y: number },
    targetNode: ResourceNode | null
  ) => {
    if (node.depleted) return
    const screenX = node.position.x - viewportOffset.x
    const screenY = node.position.y - viewportOffset.y
    // Only render nodes that are visible on screen
    if (screenX > -100 && screenX < ctx.canvas.width + 100 && screenY > -100 && screenY < ctx.canvas.height + 100) {
      const resourceColor = getResourceColor(node.type)
      const nodeSize = node.size || 20
      // HSL shifting glow
      const hue = (Date.now() / 30 + node.position.x) % 360
      ctx.save()
      ctx.globalAlpha = 0.7
      const grad = ctx.createRadialGradient(screenX, screenY, nodeSize * 0.5, screenX, screenY, nodeSize * 1.2)
      grad.addColorStop(0, `hsl(${hue}, 90%, 70%)`)
      grad.addColorStop(1, `hsl(${hue}, 90%, 40%, 0)`)
      ctx.beginPath()
      ctx.arc(screenX, screenY, nodeSize * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      // 3D shading
      const lightAngle = Math.sin(Date.now() / 1200)
      const grad2 = ctx.createRadialGradient(
        screenX + nodeSize * 0.3 * lightAngle,
        screenY - nodeSize * 0.3 * lightAngle,
        nodeSize * 0.2,
        screenX,
        screenY,
        nodeSize
      )
      grad2.addColorStop(0, `hsl(${hue}, 100%, 90%)`)
      grad2.addColorStop(1, `hsl(${hue}, 80%, 40%)`)
      ctx.beginPath()
      ctx.arc(screenX, screenY, nodeSize, 0, Math.PI * 2)
      ctx.fillStyle = grad2
      ctx.fill()
      ctx.restore()
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

  async function tradeAllResources(resources: PlayerResources, maxCapacities: PlayerResources) {
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

      const upgradePayload = await createSignaturePayload(connection.address, "upgrade submarine")
      const upgradeResponse = await apiClient.upgradeSubmarine(connection.address, upgradePayload.signature, upgradePayload.message)

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

      const upgradePayload = await createSignaturePayload(connection.address, "upgrade submarine")
      const upgradeResponse = await apiClient.upgradeSubmarine(connection.address, upgradePayload.signature, upgradePayload.message)

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

      const claimPayload = await createSignaturePayload(connection.address, "claim daily reward")
      const claimResponse = await apiClient.claimDailyReward(connection.address, claimPayload.signature, claimPayload.message)

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

  const createSignaturePayload = async (address: string, action: string) => {
    const message = `Sign this message to ${action} with your account ${address}`
    const signature = await walletManager.signMessage(message)

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

  // Add debug logs for Mine button conditions


  return (
    <>
      {showGuide && (
        <ScubaDiverGuide onFinish={() => setShowGuide(false)} />
      )}
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

          {/* Sonar/Mini-map at bottom left */}
          <div className="absolute left-4 bottom-4 z-20">
            <SonarRadar
              playerPosition={playerPosition}
              resourceNodes={resourceNodes}
              otherPlayers={otherPlayers}
              viewportOffset={viewportOffset}
            />
          </div>

          {/* Wallet info now shown in ResourceSidebar only */}
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

          {/* Upgrade Button removed: Upgrades now only via Submarine Store */}

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


  {/* Compass removed */}

  {/* Sidebar and Overlay Container */}
        <div className="pointer-events-none">
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar overlay"
            />
          )}
          <div className="pointer-events-auto">
            <ResourceSidebar
              isOpen={sidebarOpen}
              resources={resources}
              balance={balance}
              onTradeAll={handleTradeAll}
              gameState={gameState}
              playerStats={playerStats}
              walletAddress={walletAddress}
              walletConnected={walletConnected}
              onDisconnect={handleDisconnect}
            />
          </div>
        </div>

        {/* Show MineButton only when submarine is hovering over a resource node */}
        {targetNode && !targetNode.depleted && (
          <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 99999 }}>
            <MineButton
              onClick={() => handleMine(targetNode)}
              disabled={!walletConnected || gameState !== "idle"}
              gameState={gameState}
              resourceType={targetNode.type}
              resourceAmount={targetNode.amount}
            />
          </div>
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
  </>
  )
}


//