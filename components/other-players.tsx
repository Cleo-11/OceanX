"use client"

import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import { Html } from "@react-three/drei"
import { getSubmarineByTier } from "@/lib/submarine-tiers"
import type { OtherPlayer } from "@/lib/types"

interface OtherPlayersProps {
  players: OtherPlayer[]
}

export function OtherPlayers({ players }: OtherPlayersProps) {
  return (
    <group>
      {players.map((player) => (
        <OtherPlayerSubmarine key={player.id} player={player} />
      ))}
    </group>
  )
}

interface OtherPlayerSubmarineProps {
  player: OtherPlayer
}

function OtherPlayerSubmarine({ player }: OtherPlayerSubmarineProps) {
  const groupRef = useRef<any>(null)
  const propellerRef = useRef<any>(null)

  const submarineData = getSubmarineByTier(player.submarineType)
  const submarineColor = submarineData.color

  console.log(`Rendering submarine for player ${player.id} at position:`, player.position, 
              "rotation:", player.rotation, "submarineType:", player.submarineType);

  useFrame((state, delta) => {
    if (propellerRef.current) {
      // Rotate propeller
      propellerRef.current.rotation.z += delta * 3
    }

    if (groupRef.current) {
      // Gentle bobbing motion
      groupRef.current.position.y =
        player.position.y + Math.sin(state.clock.elapsedTime * 0.5 + player.position.x) * 0.1
    }
  })

  return (
    <group 
      ref={groupRef} 
      position={[player.position.x, player.position.y, 0] as [number, number, number]} 
      rotation={[0, 0, player.rotation] as [number, number, number]}>
      {/* Main body */}
      <mesh castShadow>
        <capsuleGeometry args={[0.5, 1.5, 16, 16]} />
        <meshStandardMaterial color={submarineColor} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Top fin */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.6]} />
        <meshStandardMaterial color={submarineColor} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Viewport */}
      <mesh position={[0.6, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.1} metalness={0.3} />
      </mesh>

      {/* Propeller housing */}
      <mesh position={[-0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
        <meshStandardMaterial color={submarineColor} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Propeller */}
      <mesh ref={propellerRef} position={[-1, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.3, 0.03, 16, 4]} />
        <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* Lights */}
      <pointLight position={[0.8, 0, 0]} intensity={0.5} color="#ffffff" distance={3} />

      {/* Player name label */}
      <Html position={[0, 1.2, 0]} center>
        <div className="rounded-md bg-slate-900/80 px-2 py-1 text-xs text-cyan-400 backdrop-blur-sm whitespace-nowrap">
          {player.username}
        </div>
      </Html>
    </group>
  )
}
