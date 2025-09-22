"use client"

import { useFrame } from "@react-three/fiber"
import { useRef, useState } from "react"
import type { GameState, ResourceNode } from "@/lib/types"
import { getResourceColor } from "@/lib/resource-utils"
import type * as THREE from "three"

interface MineralNodesProps {
  nodes: ResourceNode[]
  setHoveredNode: (name: string | null) => void
  targetNode: ResourceNode | null
  gameState: GameState
}

export function MineralNodes({ nodes, setHoveredNode, targetNode, gameState }: MineralNodesProps) {
  return (
    <group>
      {nodes.map(
        (node) =>
          !node.depleted && (
            <MineralNode
              key={node.id}
              node={node}
              isTarget={targetNode?.id === node.id}
              setHoveredNode={setHoveredNode}
              gameState={gameState}
            />
          ),
      )}
    </group>
  )
}

interface MineralNodeProps {
  node: ResourceNode
  isTarget: boolean
  setHoveredNode: (name: string | null) => void
  gameState: GameState
}

function MineralNode({ node, isTarget, setHoveredNode, gameState }: MineralNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const color = getResourceColor(node.type)
  const nodeName = `${node.type.charAt(0).toUpperCase() + node.type.slice(1)} (${node.amount})`

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Gentle floating motion
      meshRef.current.position.y = node.position.y + Math.sin(state.clock.elapsedTime + node.position.x) * 0.1

      // Rotation
      meshRef.current.rotation.y += delta * 0.2
    }

    if (glowRef.current && glowRef.current.material) {
      // Pulsing glow
      const scale = 1.2 + Math.sin(state.clock.elapsedTime * 2) * 0.1
      glowRef.current.scale.set(scale, scale, scale)

      // Highlight when mining or targeted
      const material = Array.isArray(glowRef.current.material) 
        ? glowRef.current.material[0] 
        : glowRef.current.material;
        
      if (material && 'opacity' in material) {
        if (gameState === "mining" && isTarget) {
          material.opacity = 0.6 + Math.sin(state.clock.elapsedTime * 10) * 0.4;
        } else if (isTarget) {
          material.opacity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
        } else {
          material.opacity = 0.3;
        }
      }
    }
  })

  // Determine the geometry based on the resource type
  const getNodeGeometry = () => {
    switch(node.type) {
      case 'nickel':
        return <icosahedronGeometry args={[0.5, 1]} />
      case 'cobalt':
        return <dodecahedronGeometry args={[0.5, 0]} />
      case 'copper':
        return <octahedronGeometry args={[0.5, 0]} />
      case 'manganese':
        return <tetrahedronGeometry args={[0.6, 0]} />
      default:
        return <octahedronGeometry args={[0.5, 0]} />
    }
  }
  
  // More dynamic appearance based on resource amount
  const scale = 0.8 + (node.amount / 20) * 0.5 // Scale between 0.8-1.3 based on amount
  
  return (
    <group position={[node.position.x, node.position.y, 0]}>
      {/* Resource value indicator (blockchain-inspired hexagon ring) */}
      {isTarget && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
          <ringGeometry args={[0.7, 0.8, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
      )}
      
      {/* Mineral crystal with blockchain-inspired geometry */}
      <mesh
        ref={meshRef}
        scale={[scale, scale, scale]}
        onPointerOver={() => {
          setHovered(true)
          setHoveredNode(nodeName)
        }}
        onPointerOut={() => {
          setHovered(false)
          setHoveredNode(null)
        }}
        castShadow
      >
        {getNodeGeometry()}
        <meshStandardMaterial
          color={color}
          roughness={0.2}
          metalness={0.8}
          emissive={color}
          emissiveIntensity={hovered || isTarget ? 0.7 : 0.3}
          wireframe={isTarget && gameState === "mining"} // Wireframe effect during mining
        />
      </mesh>
      
      {/* Data lines effect (blockchain-inspired) */}
      {(isTarget || hovered) && (
        <mesh rotation={[0, Math.PI / 3, 0]}>
          <torusGeometry args={[0.8, 0.02, 16, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} />
        </mesh>
      )}

      {/* Glow effect */}
      <mesh ref={glowRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial color={color} transparent={true} opacity={0.3} depthWrite={false} />
      </mesh>

      {/* Light source */}
      <pointLight color={color} intensity={isTarget ? 0.8 : 0.5} distance={3} />

      {/* Amount indicator */}
      {(hovered || isTarget) && (
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  )
}
