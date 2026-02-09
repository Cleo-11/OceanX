"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { PlayerHUD } from "./player-hud"
// import { Compass } from "./compass"
import { SonarRadar } from "./sonar-radar"
import { ResourceSidebar } from "./resource-sidebar"
import { MineButton } from "./mine-button"
import { UpgradeModal } from "./upgrade-modal"
import { SubmarineStore } from "./submarine-store"
import { StorageFullAlert } from "./storage-full-alert"
import { EnergyDepletedAlert } from "./energy-depleted-alert"
import { apiClient, type SubmarineUpgradeResult } from "@/lib/api"
import { walletManager } from "@/lib/wallet"
import { wsManager } from "@/lib/websocket"
import { ContractManager } from "@/lib/contracts"
import { ethers } from "ethers"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { canMineResource, getStoragePercentage, getResourceColor } from "@/lib/resource-utils"
import type { GameState, ResourceNode, PlayerStats, PlayerResources, PlayerPosition } from "@/lib/types"
import type {
  AquaticState,
  ScreenShake,
  ColorGrade,
  ParticleBurst,
  MovementKeys,
  ConnectionStatus,
} from "@/lib/game-types"
import { ScubaDiverGuide } from "./ScubaDiverGuide"
import { loadGameState, setupAutoSave, clearGameState, getDefaultGameState } from "@/lib/gameStateStorage"
import { getCurrentUser } from "@/lib/supabase"

interface OceanMiningGameProps {
  walletConnected: boolean
  gameState: GameState
  setGameState: (state: GameState) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  onFullDisconnect: () => void // NEW PROP
  // onConnectWallet?: () => void // (Deprecated) no longer used; game runs without wallet
  // Optional: notify parent whenever the in-session resource totals change
  onResourcesChange?: (resources: PlayerResources) => void
  // Optional: initial resources from database
  initialResources?: PlayerResources
  // Tutorial completion status from database
  hasCompletedTutorial?: boolean
  // Optional: initial wallet address from server auth
  initialWalletAddress?: string
  // Optional: initial OCX balance from database (avoids Express API dependency)
  initialBalance?: number
}

export function OceanMiningGame({
  walletConnected,
  gameState,
  setGameState,
  sidebarOpen,
  setSidebarOpen,
  onFullDisconnect, // NEW PROP
  // onConnectWallet removed
  onResourcesChange,
  initialResources,
  hasCompletedTutorial = false,
  initialWalletAddress = "",
  initialBalance = 0,
}: OceanMiningGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  // --- CINEMATIC FEEDBACK STATE ---
  const [screenShake, setScreenShake] = useState<ScreenShake>({ 
    active: false, 
    intensity: 0, 
    duration: 0, 
    time: 0 
  })
  const [colorGrade, setColorGrade] = useState<ColorGrade>({ 
    active: false, 
    tint: '#0ea5e9', 
    opacity: 0.0, 
    duration: 0, 
    time: 0 
  })
  const [particleBursts, setParticleBursts] = useState<ParticleBurst[]>([])

  // --- CINEMATIC FEEDBACK UTILS ---

  // Player position and movement
  const [playerPosition, setPlayerPosition] = useState<PlayerPosition>({ x: 500, y: 500, rotation: 0 })
  const [movementKeys, setMovementKeys] = useState<MovementKeys>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  })

  // Player stats and resources
  const [playerTier, setPlayerTier] = useState<number>(1)
  const [sessionId, setSessionId] = useState<string | null>(null)
  // Multiplayer disabled: Only single player state is used
  // const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([])
  const [walletAddress, setWalletAddress] = useState<string>(initialWalletAddress)
  // CRITICAL FIX: Recalculate submarine data whenever playerTier changes
  const submarineData = useMemo(() => getSubmarineByTier(playerTier), [playerTier])

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
    nickel: initialResources?.nickel ?? 0,
    cobalt: initialResources?.cobalt ?? 0,
    copper: initialResources?.copper ?? 0,
    manganese: initialResources?.manganese ?? 0,
  })

  // Notify parent when resources change (lightweight autosave hook)
  useEffect(() => {
    if (onResourcesChange) {
      onResourcesChange(resources)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources])

  const [balance, setBalance] = useState<number>(initialBalance)
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false)
  const [showSubmarineStore, setShowSubmarineStore] = useState<boolean>(false)
  const [targetNode, setTargetNode] = useState<ResourceNode | null>(null)
  const [resourceNodes, setResourceNodes] = useState<ResourceNode[]>([])
  const [showStorageAlert, setShowStorageAlert] = useState<boolean>(false)
  const [storagePercentage, setStoragePercentage] = useState<number>(0)
  const [showEnergyAlert, setShowEnergyAlert] = useState<boolean>(false)
  const [viewportOffset, setViewportOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")
  const [showGuide, setShowGuide] = useState<boolean>(!hasCompletedTutorial);
  const [userId, setUserId] = useState<string | null>(null);

  // --- AQUATIC FEATURE STATE ---
  const [aquaticState] = useState<AquaticState>(() => {
    // Sunlight rays
    const sunRays = Array.from({ length: 6 }, () => ({
      x: Math.random() * window.innerWidth,
      width: 80 + Math.random() * 60,
      opacity: 0.10 + Math.random() * 0.10,
      speed: 0.4 + Math.random() * 0.4,
    }))
    // No kelp, seaweed, bubbles, or coral/flowers
    const seaweed: never[] = []
    const kelp: never[] = []
    const coral: never[] = []
    const fish = Array.from({ length: 10 }, () => ({
      x: Math.random() * window.innerWidth,
      y: 100 + Math.random() * (window.innerHeight - 200),
      size: 12 + Math.random() * 8,
      speed: 0.7 + Math.random() * 0.7,
      direction: Math.random() > 0.5 ? 1 : -1,
      opacity: 0.5 + Math.random() * 0.5,
      swimOffset: Math.random() * Math.PI * 2,
    }))
    const bubbles: never[] = []
    const particles = Array.from({ length: 30 }, () => ({
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
  // Restore backend and database connectivity, but keep multiplayer visuals disabled
  useEffect(() => {
    generateInitialResourceNodes();
    
    // Load userId and restore game state from localStorage
    const initGameState = async () => {
      try {
        const { user } = await getCurrentUser();
        if (user) {
          setUserId(user.id);
          
          // Try to load saved game state from localStorage
          const savedState = loadGameState(user.id);
          if (savedState) {
            console.log("✅ Restored game state from localStorage:", savedState);
            setPlayerPosition({
              x: savedState.position.x,
              y: savedState.position.y,
              rotation: 0,
            });
            setPlayerStats((prev) => ({
              ...prev,
              energy: savedState.energy,
              health: savedState.hull,
            }));
            setSessionId(savedState.sessionId);
          } else {
            console.log("ℹ️ No saved game state found, using defaults");
            const defaults = getDefaultGameState();
            setPlayerPosition({ x: defaults.position.x, y: defaults.position.y, rotation: 0 });
          }
        }
      } catch (error) {
        console.error("Failed to load game state:", error);
      }
    };
    
    initGameState();
    
    const init = async () => {
      try {
        setConnectionStatus("connecting");
        await wsManager.connect();
        // Only listen for resource/game state and player data, not multiplayer events
        wsManager.on("game-state", handleGameState);
        wsManager.on("resource-mined", handleResourceMined);
        wsManager.on("error", handleWebSocketError);
        const connection = walletManager.getConnection();
        if (connection) {
          setWalletAddress(connection.address);
          // Join session with signed payload
          const joinMessage = `Sign this message to join session global with your account ${connection.address}`;
          const joinSignature = await walletManager.signMessage(joinMessage);
          wsManager.joinSession({
            walletAddress: connection.address,
            sessionId: "global",
            message: joinMessage,
            signature: joinSignature,
          });
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

  // SubmarineStore auto-open removed (store is now a dedicated route)

  // Setup auto-save for game state to localStorage
  useEffect(() => {
    if (!userId) return;

    const getGameState = () => ({
      position: { x: playerPosition.x, y: playerPosition.y, z: 0 },
      energy: playerStats.energy,
      hull: playerStats.health,
      sessionId: sessionId || "global",
    });

    const cleanup = setupAutoSave(userId, getGameState);
    console.log("✅ Auto-save enabled for user:", userId);

    return () => {
      cleanup();
      console.log("ℹ️ Auto-save disabled");
    };
  }, [userId, playerPosition.x, playerPosition.y, playerStats.energy, playerStats.health, sessionId]);

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
  amount: Math.floor(Math.random() * 11) + 5, // 5-15 resources per node
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
    // Clear saved game state from localStorage on disconnect
    if (userId) {
      clearGameState(userId);
      console.log("🗑️ Cleared game state from localStorage");
    }
    // Note: Multiplayer disabled - no other players to clear
    // Don't clear resource nodes on cleanup - keep them for offline play
  }

  const loadPlayerData = async (walletAddress: string) => {
    try {
      let balanceLoaded = false
      
      // Try Express server API first
      try {
        const balancePayload = await createSignaturePayload(
          walletAddress,
          "get balance",
        )
        // Load player balance
        const balanceResponse = await apiClient.getPlayerBalance(walletAddress, balancePayload.signature, balancePayload.message)
        if (balanceResponse.success && balanceResponse.data) {
          // Prefer 'balance' (total_ocx_earned) over legacy 'coins' field
          const ocxValue = Number.parseFloat(balanceResponse.data.balance) || 0
          if (Number.isFinite(ocxValue) && ocxValue > 0) {
            setBalance(ocxValue)
            balanceLoaded = true
          }
        }
      } catch (apiErr) {
        console.warn("Express API balance fetch failed, falling back to Supabase:", apiErr)
      }

      // Fallback: fetch total_ocx_earned directly from Supabase
      if (!balanceLoaded) {
        try {
          const { supabase } = await import("@/lib/supabase")
          const { data: player } = await supabase
            .from("players")
            .select("total_ocx_earned")
            .ilike("wallet_address", walletAddress)
            .single()
          if (player?.total_ocx_earned) {
            const dbOcx = Number(player.total_ocx_earned) || 0
            if (dbOcx > 0) {
              setBalance(dbOcx)
              console.log("✅ Balance loaded from Supabase fallback:", dbOcx)
            }
          }
        } catch (dbErr) {
          console.warn("Supabase balance fallback also failed:", dbErr)
        }
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
      
      // Note: Multiplayer disabled - otherPlayersData computed but not used
      
    }
  }

  // Multiplayer disabled: no other players to add

  // Multiplayer disabled: no other players to remove

  // Multiplayer disabled: no other players to update

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
        case "p":
          setShowSubmarineStore(true)
          break
        case "i":
          setSidebarOpen((prev) => !prev)
          break
        // case "p": // open store (removed: store is a dedicated route now)
        //   break
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
        x: newX - canvas.width / 2,
        y: newY - canvas.height / 2,
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

  // ...existing code...

  const renderGame = () => {
    try {
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

  // Multiplayer disabled: no other players to draw

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
    } catch (error) {
      console.error("Render error:", error);
      // Graceful degradation - continue rendering on next frame
    }
  }

  // Modular submarine drawing with shadow, highlight, and engine glow
  const drawSubmarine = (ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, color: string, tier: number, movingForward: boolean) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    
    // Scale factor to make submarines larger on canvas (SVG uses size 40, we want ~80-100 on canvas)
    const size = 80
    
    // Drop shadow
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.ellipse(8, 18, 32, 12, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#000'
    ctx.filter = 'blur(4px)'
    ctx.fill()
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    
    // Draw submarine EXACTLY as in SubmarineIcon.tsx, matching each tier's SVG
    switch (tier) {
      case 1:
        // Basic capsule with viewport
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.4, size*0.18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 2:
        // Add a fin
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.4, size*0.18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Fin
        ctx.fillRect(-size*0.05, -size*0.32, size*0.1, size*0.18)
        ctx.strokeRect(-size*0.05, -size*0.32, size*0.1, size*0.18)
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 3:
        // Reinforced hull (double outline)
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.4, size*0.18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Inner outline
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.3
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.36, size*0.15, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 4:
        // Heavy-duty: add cargo box
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.4, size*0.18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Cargo box
        ctx.fillRect(-size*0.35, size*0.1, size*0.2, size*0.1)
        ctx.strokeRect(-size*0.35, size*0.1, size*0.2, size*0.1)
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 5:
        // Heat-resistant: add red/orange glow
        // Glow first (behind)
        ctx.fillStyle = 'orange'
        ctx.globalAlpha = 0.2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.45, size*0.22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        // Body
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.4, size*0.18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 6:
        // Pressure hull: add extra ring
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.4, size*0.18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Pressure ring
        ctx.strokeStyle = '#0ff'
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.4
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.32, size*0.13, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 7:
        // Quantum: add sparkles
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.4, size*0.18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Sparkles
        ctx.fillStyle = '#0ff'
        ctx.globalAlpha = 0.7
        ctx.beginPath()
        ctx.arc(-size*0.2, -size*0.2, 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(size*0.2, size*0.2, 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 8:
        // Titanium: metallic shine
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.4, size*0.18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Metallic shine
        ctx.fillStyle = '#fff'
        ctx.globalAlpha = 0.2
        ctx.fillRect(-size*0.3, -size*0.075, size*0.6, size*0.05)
        ctx.globalAlpha = 1
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 9:
        // Behemoth: extra large, double viewport
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.45, size*0.22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // First viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.15, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Second viewport
        ctx.beginPath()
        ctx.arc(size*0.3, 0, size*0.07, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 10:
        // Fortress: add turrets/armor
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.45, size*0.22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Left turret
        ctx.fillStyle = '#888'
        ctx.fillRect(-size*0.35, -size*0.35, size*0.1, size*0.1)
        ctx.strokeRect(-size*0.35, -size*0.35, size*0.1, size*0.1)
        // Right turret
        ctx.fillRect(size*0.25, -size*0.35, size*0.1, size*0.1)
        ctx.strokeRect(size*0.25, -size*0.35, size*0.1, size*0.1)
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 11:
        // Kraken's Bane: tentacle motif
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.45, size*0.22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Tentacle decoration
        ctx.strokeStyle = '#7c2d12'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(-size*0.3, size*0.2)
        ctx.quadraticCurveTo(-size*0.2, size*0.4, -size*0.1, size*0.2)
        ctx.stroke()
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 12:
        // Void: black, with purple glow
        // Purple glow first (behind)
        ctx.fillStyle = '#a855f7'
        ctx.globalAlpha = 0.15
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.5, size*0.25, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        // Body
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.45, size*0.22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 13:
        // Stellar: star motif
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.45, size*0.22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Star emblem
        ctx.fillStyle = '#fff59d'
        ctx.globalAlpha = 0.7
        ctx.beginPath()
        // 10-point star (5 outer, 5 inner)
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2
          const radius = i % 2 === 0 ? size*0.1 : size*0.05
          const px = radius * Math.cos(angle)
          const py = -size*0.32 + radius * Math.sin(angle)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 14:
        // Cosmic: alien glow, rings
        // Cosmic glow first (behind)
        ctx.fillStyle = '#a855f7'
        ctx.globalAlpha = 0.2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.55, size*0.28, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        // Body
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.45, size*0.22, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
        
      case 15:
        // Leviathan: huge, triple viewport, crown
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.5, size*0.25, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // First viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.1, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Second viewport
        ctx.beginPath()
        ctx.arc(size*0.25, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Third viewport
        ctx.beginPath()
        ctx.arc(size*0.4, 0, size*0.07, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Crown
        ctx.fillStyle = '#fff'
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.moveTo(0, -size*0.4)
        ctx.lineTo(size*0.03, -size*0.32)
        ctx.lineTo(-size*0.03, -size*0.32)
        ctx.closePath()
        ctx.fill()
        ctx.globalAlpha = 1
        break
        
      default:
        // Fallback: basic
        ctx.fillStyle = color
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(0, 0, size*0.4, size*0.18, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Viewport
        ctx.fillStyle = '#7dd3fc'
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.arc(size*0.2, 0, size*0.09, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        break
    }
    
    // Engine glow when moving (positioned behind submarine based on tier size)
    if (movingForward) {
      ctx.save()
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(Date.now() / 120)
      const engineX = tier >= 9 ? -size*0.55 : -size*0.45 // Adjust for larger submarines
      ctx.beginPath()
      ctx.ellipse(engineX, 0, 16, 8, 0, 0, Math.PI * 2)
      ctx.fillStyle = tier >= 5 ? '#fbbf24' : tier >= 3 ? '#f97316' : '#22d3ee'
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = 16
      ctx.fill()
      ctx.restore()
    }
    
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
      if (connectionStatus === "connected" && walletAddress && sessionId) {
        wsManager.mineResource({
          nodeId: node.id,
          sessionId: sessionId,
          walletAddress: walletAddress,
          amount: amountToMine,
          resourceType: node.type,
        })
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

  // Calculate total storage used
  const totalUsed = resources.nickel + resources.cobalt + resources.copper + resources.manganese;

  const handleTradeAll = async () => {
    if (totalUsed === 0) return; // Only allow if player has resources
    setGameState("trading");
    
    try {
      // Calculate OCX earned based on resource values
      // These rates MUST match the backend in server/index.js computeMaxClaimableAmount
      // Backend uses Math.floor() on each resource value individually
      const resourceValues = {
        nickel: 0.1,   // Backend: 0.1 OCX per nickel
        cobalt: 0.5,   // Backend: 0.5 OCX per cobalt
        copper: 1.0,   // Backend: 1.0 OCX per copper
        manganese: 2.0 // Backend: 2.0 OCX per manganese
      };
      
      const ocxEarned = 
        Math.floor(resources.nickel * resourceValues.nickel) +
        Math.floor(resources.cobalt * resourceValues.cobalt) +
        Math.floor(resources.copper * resourceValues.copper) +
        Math.floor(resources.manganese * resourceValues.manganese);

      if (ocxEarned <= 0) {
        alert("No resources to trade!");
        setGameState("idle");
        return;
      }

      // Require wallet connection for trading
      if (!walletConnected || !initialWalletAddress) {
        alert("Please connect your wallet to trade resources for OCX tokens!");
        setGameState("idle");
        return;
      }

      const { executeMarketplaceTrade } = await import("@/lib/services/blockchain-trade.service");
      const { ethers } = await import("ethers");
      
      // Get wallet signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Execute blockchain trade for all resources
      const result = await executeMarketplaceTrade(
        {
          walletAddress: initialWalletAddress,
          ocxAmount: ocxEarned,
          resourceType: "mixed", // Trading all resources
          resourceAmount: totalUsed,
        },
        signer,
        (step, message) => {
          console.log(`Trade step ${step}: ${message}`);
        }
      );

      if (!result.success) {
        throw new Error(result.error || "Blockchain trade failed");
      }

      // ✅ Blockchain transaction succeeded - now update Supabase
      // Use wallet address directly (getCurrentUser() returns null with custom JWT auth)
      const tradeWallet = initialWalletAddress.toLowerCase();
      if (tradeWallet) {
        const { supabase } = await import("@/lib/supabase");
        
        // First fetch current balance
        const { data: currentPlayer, error: fetchErr } = await supabase
          .from("players")
          .select("total_ocx_earned")
          .ilike("wallet_address", tradeWallet)
          .single();
        
        if (fetchErr) {
          console.error("❌ Failed to fetch current OCX balance:", fetchErr);
        } else {
          const currentOcx = Number(currentPlayer?.total_ocx_earned) || 0;
          const { error: updateErr } = await supabase
            .from("players")
            .update({
              total_ocx_earned: currentOcx + ocxEarned,
            })
            .ilike("wallet_address", tradeWallet);
          
          if (updateErr) {
            console.error("❌ Failed to update total_ocx_earned in database:", updateErr);
          } else {
            console.log(`✅ Database updated: total_ocx_earned = ${currentOcx + ocxEarned}`);
          }
        }
      }

      // Update frontend state
      setResources({ nickel: 0, cobalt: 0, copper: 0, manganese: 0 });
      setPlayerStats((prev) => ({
        ...prev,
        capacity: { nickel: 0, cobalt: 0, copper: 0, manganese: 0 },
      }));
      setBalance((prev) => prev + ocxEarned);
      setGameState("resourceTraded");
      setTimeout(() => setGameState("idle"), 2000);
    } catch (e: any) {
      console.error("Trade error:", e);
      alert(e.message || "Trade failed. Please try again.");
      setGameState("idle");
    }
  };

  const applyUpgradeStateFromResponse = (upgradeData: SubmarineUpgradeResult) => {
    const tierNumber = upgradeData.tierDetails?.tier ?? upgradeData.newTier

    if (tierNumber) {
      setPlayerTier(tierNumber)
    }

    const statsSource = upgradeData.tierDetails?.baseStats ?? getSubmarineByTier(tierNumber)?.baseStats

    if (statsSource) {
      setPlayerStats((prev) => ({
        ...prev,
        health: statsSource.health ?? prev.health,
        energy: statsSource.energy ?? prev.energy,
        capacity: { ...prev.capacity },
        maxCapacity: statsSource.maxCapacity ? { ...statsSource.maxCapacity } : { ...prev.maxCapacity },
        depth: statsSource.depth ?? prev.depth,
        speed: statsSource.speed ?? prev.speed,
        miningRate: statsSource.miningRate ?? prev.miningRate,
        tier: tierNumber ?? prev.tier,
      }))
    }

    if (typeof upgradeData.coins === "number" && Number.isFinite(upgradeData.coins)) {
      setBalance(upgradeData.coins)
    }
  }

  const executeSubmarineUpgrade = async (targetTierOverride?: number): Promise<SubmarineUpgradeResult> => {
    const targetTier = targetTierOverride ?? playerTier + 1
    
    // Wallet MUST be connected — auto-reconnect or prompt MetaMask
    let connection = walletManager.getConnection()
    if (!connection) {
      try {
        connection = await walletManager.ensureConnected()
      } catch (err) {
        throw new Error("Wallet not connected. Please connect MetaMask or WalletConnect to authorize the transaction.")
      }
    }

    const walletAddress = connection.address
    if (!walletAddress) {
      throw new Error("No wallet address available. Please reconnect your wallet.")
    }

    const tierDefinition = getSubmarineByTier(targetTier)
    const upgradeCost = tierDefinition.upgradeCost.tokens

    // Check balance client-side before calling server
    if (balance < upgradeCost) {
      throw new Error(`Insufficient OCX tokens (have: ${balance}, need: ${upgradeCost})`)
    }

    try {
      // Try on-chain blockchain transaction first (full token transfer)
      let onChainSuccess = false
      try {
        console.log(`🔐 Attempting on-chain upgrade to tier ${targetTier}...`)
        const approvalTx = await ContractManager.approveTokens(
          ethers.parseEther(upgradeCost.toString()).toString()
        )
        await approvalTx.wait()
        console.log("✅ Token approval successful")

        const contractTx = await ContractManager.upgradeSubmarine(targetTier)
        await contractTx.wait()
        console.log("✅ Smart contract upgrade successful")
        onChainSuccess = true
      } catch (onChainErr: any) {
        // CALL_EXCEPTION = user has no on-chain OCX tokens to spend
        // This is expected when tokens are tracked off-chain in the DB
        const isCallException = onChainErr?.code === 'CALL_EXCEPTION' ||
          onChainErr?.message?.includes('CALL_EXCEPTION') ||
          onChainErr?.message?.includes('missing revert data') ||
          onChainErr?.message?.includes('estimateGas')
        
        if (onChainErr?.code === 'ACTION_REJECTED') {
          throw new Error("Transaction rejected by user")
        }
        
        if (isCallException) {
          console.warn("⚠️ On-chain upgrade failed (no on-chain tokens). Falling back to signed authorization...")
        } else {
          console.warn("⚠️ On-chain upgrade failed, falling back to signed authorization:", onChainErr?.message)
        }
      }

      // Step 2: MetaMask-signed authorization + server-side DB upgrade
      // This ensures MetaMask popup always appears (for the signature) even if on-chain tx was skipped
      const upgradePayload = await createSignaturePayload(connection.address, "upgrade submarine")

      let upgradeResponse: any = { success: false }
      
      try {
        upgradeResponse = await apiClient.upgradeSubmarine(
          walletAddress,
          upgradePayload.signature,
          upgradePayload.message,
          targetTier,
        )
      } catch (expressErr) {
        console.warn("Express upgrade API failed, trying Next.js API:", expressErr)
      }

      // Fallback: Next.js API route (uses JWT cookie auth)
      if (!upgradeResponse.success) {
        try {
          const resp = await fetch("/api/submarine/upgrade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetTier }),
          })
          const data = await resp.json()
          if (resp.ok && data.success) {
            upgradeResponse = data
          } else {
            throw new Error(data.error || "Upgrade failed")
          }
        } catch (nextErr: any) {
          throw new Error(nextErr.message || "Failed to upgrade submarine")
        }
      }

      if (!upgradeResponse.success || !upgradeResponse.data) {
        const errorMessage =
          upgradeResponse.error || upgradeResponse.data?.message || "Failed to process upgrade via API"
        throw new Error(errorMessage)
      }

      const upgradeData = upgradeResponse.data
      applyUpgradeStateFromResponse(upgradeData)

      // Update balance from server response (may be in 'balance' or 'coins')
      const newBal = upgradeData.balance ?? upgradeData.coins
      if (typeof newBal === "number" && Number.isFinite(newBal)) {
        setBalance(newBal)
      }

      console.info("✅ Submarine upgrade confirmed", {
        wallet: upgradeData.wallet,
        tier: upgradeData.newTier,
        balanceRemaining: newBal,
        onChainSuccess,
      })

      await loadPlayerData(walletAddress)

      return upgradeData
    } catch (error: any) {
      // Handle specific errors
      if (error.code === 'ACTION_REJECTED' || error.message?.includes("rejected by user")) {
        throw new Error("Transaction rejected by user")
      }
      if (error.message?.includes("insufficient funds")) {
        throw new Error("Insufficient ETH for gas fees")
      }
      if (error.message?.includes("Insufficient OCX")) {
        throw error
      }
      if (error.message?.includes("sequential only")) {
        throw new Error("Submarines must be upgraded sequentially")
      }
      throw error
    }
  }

  const handleUpgradeSubmarine = async () => {
    if (playerTier >= 15) return

    setGameState("upgrading")

    try {
      await executeSubmarineUpgrade(playerTier + 1)

      setGameState("upgraded")

      setTimeout(() => {
        setShowUpgradeModal(false)
        setGameState("idle")
      }, 2000)
    } catch (error) {
      console.error("Upgrade failed:", error)
      const message = error instanceof Error ? error.message : "Upgrade failed. Please try again."
      if (typeof window !== "undefined") {
        window.alert(message)
      }
      setGameState("idle")
    }
  }

  // Submarine purchase handled via dedicated /submarine-store page now

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

  // Handle tutorial completion
  const handleTutorialFinish = async () => {
    setShowGuide(false)
    
    // Mark tutorial as complete in database
    try {
      const response = await fetch("/api/player/complete-tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        console.error("[OceanMiningGame] Failed to mark tutorial as complete")
      } else {
        console.info("[OceanMiningGame] Tutorial marked as complete")
      }
    } catch (error) {
      console.error("[OceanMiningGame] Error marking tutorial as complete:", error)
    }
  }


  return (
    <>
      {showGuide && (
        <ScubaDiverGuide onFinish={handleTutorialFinish} />
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
          <PlayerHUD stats={playerStats} tier={playerTier} resources={resources} />

          {/* Sonar/Mini-map at bottom left */}
          <div className="absolute left-4 bottom-4 z-20">
            <SonarRadar
              playerPosition={playerPosition}
              resourceNodes={resourceNodes}
              otherPlayers={[]}
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
            className="pointer-events-auto absolute right-4 top-28 z-50 rounded-lg bg-gradient-to-r from-cyan-600/80 to-blue-600/80 p-2 text-white backdrop-blur-sm transition-all hover:from-cyan-500/80 hover:to-blue-500/80"
            title="Open Submarine Store (Press P)"
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
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
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
            <div>Players: 1/1 (Single Player Mode)</div>
            <div>Status: {connectionStatus}</div>
          </div>
        )}

        {/* Wallet connection is optional in gameplay; overlay removed */}
        </div> {/* Close HUD Overlay div */}
      </div> {/* Close main container div */}

      {/* Submarine Store Modal */}
      {showSubmarineStore && (
        <SubmarineStore
          isOpen={showSubmarineStore}
          onClose={() => setShowSubmarineStore(false)}
          currentTier={playerTier}
          resources={resources}
          balance={balance}
          onPurchase={handleUpgradeSubmarine}
          gameState={gameState}
        />
      )}

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
    </>
  );
}