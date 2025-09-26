// Best Practice: Use mock data only in development or demo mode
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
"use client"

import { useState, useEffect, Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { Environment, OrbitControls, PerspectiveCamera, Sky } from "@react-three/drei"
import { PlayerHUD } from "./player-hud"
import { SonarRadar } from "./sonar-radar"
import { ResourceSidebar } from "./resource-sidebar"
import { MineButton } from "./mine-button"
import { OceanFloor } from "./ocean-floor"
import { PlayerSubmarine } from "./player-submarine"
import { MineralNodes } from "./mineral-nodes"
import { UpgradeModal } from "./upgrade-modal"
import { OtherPlayers } from "./other-players"
import { WalletInfo } from "./wallet-info"
import { StorageFullAlert } from "./storage-full-alert"
import { EnergyDepletedAlert } from "./energy-depleted-alert"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import { canMineResource, getStoragePercentage } from "@/lib/resource-utils"
import type { GameState, ResourceNode, PlayerStats, PlayerResources, OtherPlayer } from "@/lib/types"

interface OceanMiningSimulationProps {
  walletConnected: boolean
  gameState: GameState
  setGameState: (state: GameState) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  walletAddress?: string
}

// Mock data for other players - only used in development/demo mode
const mockOtherPlayers: OtherPlayer[] = MOCK_MODE ? [
  { id: "player1", position: { x: -5, y: 1 }, rotation: 0.5, submarineType: 2, username: "DeepDiver" },
  { id: "player2", position: { x: 8, y: 2 }, rotation: -0.8, submarineType: 4, username: "OceanExplorer" },
  { id: "player3", position: { x: 3, y: 1.5 }, rotation: 0.2, submarineType: 3, username: "AbyssalMiner" },
] : [];

// Generate initial resource nodes - only in mock mode
const generateInitialNodes = (): ResourceNode[] => {
  if (!MOCK_MODE) return [];
  const types = ["nickel", "cobalt", "copper", "manganese"] as const;
  return Array.from({ length: 20 }, (_, i) => ({
    id: `node-${i}`,
    position: { x: Math.random() * 40 - 20, y: Math.random() * 40 - 20 },
    type: types[Math.floor(Math.random() * types.length)],
    amount: Math.floor(Math.random() * 20) + 5,
    depleted: false,
    size: 20,
  }));
}


async function tradeAllResources(resources: PlayerResources, maxCapacities: PlayerResources) {
  const response = await fetch("/daily-trade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resources, maxCapacities }),
  });
  return await response.json();
}

export function OceanMiningSimulation({
  walletConnected,
  gameState,
  setGameState,
  sidebarOpen,
  setSidebarOpen,
  walletAddress = "",
}: OceanMiningSimulationProps) {
  // Player position and movement
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 2, 0])
  const [playerRotation, setPlayerRotation] = useState<[number, number, number]>([0, 0, 0])
  const [movementKeys, setMovementKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  })

  // Player stats and resources
  const [playerTier, setPlayerTier] = useState(1)
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

  const [balance, setBalance] = useState(500)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [targetNode, setTargetNode] = useState<ResourceNode | null>(null)
  const [resourceNodes, setResourceNodes] = useState<ResourceNode[]>(generateInitialNodes())
  const [showStorageAlert, setShowStorageAlert] = useState(false)
  const [storagePercentage, setStoragePercentage] = useState(0)
  const [showEnergyAlert, setShowEnergyAlert] = useState(false)

  // Update storage percentage when resources change
  useEffect(() => {
    const percentage = getStoragePercentage(resources, playerStats)
    setStoragePercentage(percentage)

    // Show storage alert when almost full
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
      if (!walletConnected) return

      switch (e.key.toLowerCase()) {
        case "w":
          setMovementKeys((prev) => ({ ...prev, forward: true }))
          break
        case "s":
          setMovementKeys((prev) => ({ ...prev, backward: true }))
          break
        case "a":
          setMovementKeys((prev) => ({ ...prev, left: true }))
          break
        case "d":
          setMovementKeys((prev) => ({ ...prev, right: true }))
          break
        case "e":
          setMovementKeys((prev) => ({ ...prev, up: true }))
          break
        case "q":
          setMovementKeys((prev) => ({ ...prev, down: true }))
          break
        case "f":
          if (targetNode) handleMine(targetNode)
          break
        case "u":
          setShowUpgradeModal(true)
          break
        case "i":
          setSidebarOpen(!sidebarOpen)
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case "w":
          setMovementKeys((prev) => ({ ...prev, forward: false }))
          break
        case "s":
          setMovementKeys((prev) => ({ ...prev, backward: false }))
          break
        case "a":
          setMovementKeys((prev) => ({ ...prev, left: false }))
          break
        case "d":
          setMovementKeys((prev) => ({ ...prev, right: false }))
          break
        case "e":
          setMovementKeys((prev) => ({ ...prev, up: false }))
          break
        case "q":
          setMovementKeys((prev) => ({ ...prev, down: false }))
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

  // Update player position based on movement keys
  useEffect(() => {
    if (!walletConnected || gameState === "mining") return

    const movePlayer = () => {
      if (playerStats.energy === 0) return; // Block movement when energy is 0
      const speed = playerStats.speed * 0.05
      let newX = playerPosition[0]
      let newY = playerPosition[1]
      let newZ = playerPosition[2]
      let rotationY = playerRotation[1]
      if (movementKeys.forward) {
        newX -= Math.sin(rotationY) * speed
        newZ -= Math.cos(rotationY) * speed
      }
      if (movementKeys.backward) {
        newX += Math.sin(rotationY) * speed
        newZ += Math.cos(rotationY) * speed
      }
      if (movementKeys.left) {
        rotationY += 0.02
      }
      if (movementKeys.right) {
        rotationY -= 0.02
      }
      if (movementKeys.up) {
        newY += speed
      }
      if (movementKeys.down) {
        newY = Math.max(1, newY - speed)
      }
      // Limit movement area
      newX = Math.max(-25, Math.min(25, newX))
      newY = Math.max(1, Math.min(10, newY))
      newZ = Math.max(-25, Math.min(25, newZ))
      setPlayerPosition([newX, newY, newZ])
      setPlayerRotation([0, rotationY, 0])
      // Check for nearby resource nodes
      const nearbyNode = resourceNodes.find((node) => {
        if (node.depleted) return false
  const dx = node.position.x - newX
  const dz = node.position.y - newZ
  const distance = Math.sqrt(dx * dx + dz * dz)
        return distance < 3
      })
      setTargetNode(nearbyNode || null)
    }
    const intervalId = setInterval(movePlayer, 16)
    return () => clearInterval(intervalId)
  }, [walletConnected, playerPosition, playerRotation, movementKeys, gameState, resourceNodes, playerStats.speed, playerStats.energy])

  const handleMine = (node: ResourceNode) => {
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

    // Simulate mining process
    setTimeout(() => {
      // Update player resources
      setResources((prev) => ({
        ...prev,
        [node.type]: prev[node.type] + amountToMine,
      }))

      // Update player stats
      setPlayerStats((prev) => ({
        ...prev,
        energy: Math.max(prev.energy - 5, 0),
        capacity: {
          ...prev.capacity,
          [node.type]: prev.capacity[node.type] + amountToMine,
        },
      }))

      // Update resource node
      setResourceNodes((prev) =>
        prev.map((n) => {
          if (n.id === node.id) {
            const remainingAmount = n.amount - amountToMine
            return {
              ...n,
              amount: remainingAmount,
              depleted: remainingAmount <= 0,
            }
          }
          return n
        }),
      )

      setGameState("resourceGained")

      setTimeout(() => {
        setGameState("idle")
      }, 2000)
    }, 2000)
  }

  // const handleTrade = (resourceType: keyof PlayerResources) => {
  //   if (resources[resourceType] <= 0) return
  //
  //   setGameState("trading")
  //
  //   setTimeout(() => {
  //     const value = Math.floor(Math.random() * 10) + 5
  //
  //     setResources((prev) => ({
  //       ...prev,
  //       [resourceType]: prev[resourceType] - 1,
  //     }))
  //
  //     setPlayerStats((prev) => ({
  //       ...prev,
  //       capacity: {
  //         ...prev.capacity,
  //         [resourceType]: prev.capacity[resourceType] - 1,
  //       },
  //     }))
  //
  //     setBalance((prev) => prev + value)
  //
  //     setGameState("resourceTraded")
  //
  //     setTimeout(() => {
  //       setGameState("idle")
  //     }, 2000)
  //   }, 1500)
  // }

  // Calculate total storage used and capacity
  const totalUsed = resources.nickel + resources.cobalt + resources.copper + resources.manganese;
  const totalCapacity = playerStats.maxCapacity.nickel + playerStats.maxCapacity.cobalt + playerStats.maxCapacity.copper + playerStats.maxCapacity.manganese;

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

  const handleUpgradeSubmarine = () => {
    if (playerTier >= 15) return

    setGameState("upgrading")

    setTimeout(() => {
      const nextTier = playerTier + 1
      const nextSubmarineData = getSubmarineByTier(nextTier)

      // Update player tier and stats
      setPlayerTier(nextTier)
      setPlayerStats({
        ...nextSubmarineData.baseStats,
        capacity: { ...playerStats.capacity },
      })

      setGameState("upgraded")

      setTimeout(() => {
        setShowUpgradeModal(false)
        setGameState("idle")
      }, 2000)
    }, 2000)
  }

  return (
    <>
      {/* 3D Canvas */}
      <Canvas className="h-full w-full">
        <PerspectiveCamera makeDefault position={[0, 5, 10]} fov={60} />
        <fog attach="fog" args={["#001428", 5, 30]} />
        <ambientLight intensity={0.2} />
        <directionalLight position={[0, 10, 5]} intensity={0.3} color="#5eead4" />
        <pointLight position={[0, 5, 0]} intensity={0.5} color="#0ea5e9" />

        <Suspense fallback={null}>
          <OceanFloor />
          <PlayerSubmarine
            position={playerPosition}
            rotation={playerRotation}
            tier={playerTier}
            isMoving={Object.values(movementKeys).some((key) => key)}
          />
          <OtherPlayers players={mockOtherPlayers} />
          <MineralNodes
            nodes={resourceNodes}
            setHoveredNode={setHoveredNode}
            targetNode={targetNode}
            gameState={gameState}
          />
          <Environment preset="night" />
          <Sky distance={450000} sunPosition={[0, -1, 0]} inclination={0} azimuth={0.25} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          maxPolarAngle={Math.PI / 2 - 0.1}
          minDistance={5}
          maxDistance={15}
          target={[playerPosition[0], playerPosition[1], playerPosition[2]]}
        />
      </Canvas>

      {/* HUD Overlay */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Player Stats HUD */}
  <PlayerHUD stats={playerStats} tier={playerTier} />

        {/* Sonar/Mini-map */}
  <SonarRadar playerPosition={{ x: playerPosition[0], y: playerPosition[2], rotation: playerRotation[1] }} resourceNodes={resourceNodes} otherPlayers={mockOtherPlayers} />

        {/* Wallet Info (when connected) */}
        {walletConnected && <WalletInfo balance={balance} />}

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

        {/* Upgrade Button */}
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="pointer-events-auto absolute right-4 top-28 z-50 rounded-lg bg-slate-800/80 p-2 text-cyan-400 backdrop-blur-sm transition-all hover:bg-slate-700/80"
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

        {/* Resource Sidebar */}
        <ResourceSidebar
          isOpen={sidebarOpen}
          resources={resources}
          balance={balance}
          onTradeAll={handleTradeAll}
          gameState={gameState}
          playerStats={playerStats}
          walletAddress={walletAddress}
          walletConnected={walletConnected}
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

        {/* Resource Node Tooltip */}
        {hoveredNode && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-slate-900/80 px-4 py-2 text-cyan-400 backdrop-blur-sm">
            {hoveredNode}
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

        {/* Controls Help */}
        <div className="absolute bottom-4 right-4 rounded-lg bg-slate-900/70 p-3 text-xs text-slate-300 backdrop-blur-sm">
          <h3 className="mb-1 font-bold text-cyan-400">CONTROLS</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div>W/S - Forward/Back</div>
            <div>A/D - Turn Left/Right</div>
            <div>Q/E - Descend/Ascend</div>
            <div>F - Mine (when near resource)</div>
            <div>U - Upgrade Menu</div>
            <div>I - Inventory</div>
          </div>
        </div>

        {/* No Wallet Connected Overlay */}
        {!walletConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="rounded-xl bg-slate-800/90 p-8 text-center text-white shadow-2xl">
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
  )
}
