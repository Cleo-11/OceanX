export function OceanFloor() {
  return (
    <group>
      {/* Ocean floor base */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[100, 100, 64, 64]} />
        <meshStandardMaterial color="#0c4a6e" roughness={1} metalness={0.2} displacementScale={2} wireframe={false} />
      </mesh>

      {/* Decorative rocks and formations - scattered across the map */}
      {Array.from({ length: 30 }).map((_, i) => {
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

      {/* Underwater plants - scattered across the map */}
      {Array.from({ length: 40 }).map((_, i) => {
        const x = Math.random() * 50 - 25
        const z = Math.random() * 50 - 25
        const scale = Math.random() * 0.5 + 0.3

        return <SeaPlant key={`plant-${i}`} position={[x, -0.9, z]} scale={[scale, scale * 1.5, scale]} />
      })}

      {/* Underwater vents */}
      <UnderwaterVent position={[-15, -0.8, -10]} />
      <UnderwaterVent position={[12, -0.8, 8]} />
      <UnderwaterVent position={[5, -0.8, -18]} />

      {/* Underwater cave entrances */}
      <CaveEntrance position={[-8, -0.5, 15]} rotation={[0, Math.PI / 3, 0]} />
      <CaveEntrance position={[20, -0.5, -5]} rotation={[0, -Math.PI / 4, 0]} />
    </group>
  )
}

function Rock({ position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0] }) {
  return (
    <mesh position={position} scale={scale} rotation={rotation} castShadow receiveShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#0f172a" roughness={0.9} />
    </mesh>
  )
}

function SeaPlant({ position = [0, 0, 0], scale = [1, 1, 1] }) {
  // Randomly choose between different plant types
  const plantType = Math.floor(Math.random() * 3)
  const plantColor = Math.random() > 0.7 ? "#059669" : "#0d9488"

  return (
    <group position={position} scale={scale}>
      {plantType === 0 && (
        // Tall seaweed
        <>
          <mesh position={[0, 1, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.1, 2, 8]} />
            <meshStandardMaterial color={plantColor} roughness={0.8} />
          </mesh>
          <mesh position={[0.2, 1.5, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
            <cylinderGeometry args={[0.03, 0.07, 1, 8]} />
            <meshStandardMaterial color={plantColor} roughness={0.8} />
          </mesh>
          <mesh position={[-0.2, 1.3, 0]} rotation={[0, 0, -Math.PI / 7]} castShadow>
            <cylinderGeometry args={[0.03, 0.07, 1.2, 8]} />
            <meshStandardMaterial color={plantColor} roughness={0.8} />
          </mesh>
        </>
      )}

      {plantType === 1 && (
        // Coral-like structure
        <>
          <mesh position={[0, 0.5, 0]} castShadow>
            <sphereGeometry args={[0.3, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#ec4899" roughness={0.8} />
          </mesh>
          <mesh position={[0.2, 0.3, 0.2]} castShadow>
            <sphereGeometry args={[0.2, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#ec4899" roughness={0.8} />
          </mesh>
          <mesh position={[-0.2, 0.3, -0.1]} castShadow>
            <sphereGeometry args={[0.25, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#ec4899" roughness={0.8} />
          </mesh>
        </>
      )}

      {plantType === 2 && (
        // Tube-like anemone
        <>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.3, 0.8, 16]} />
            <meshStandardMaterial color="#7c3aed" roughness={0.8} />
          </mesh>
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2
            const x = Math.cos(angle) * 0.15
            const z = Math.sin(angle) * 0.15
            return (
              <mesh key={i} position={[x, 0.8, z]} castShadow>
                <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
                <meshStandardMaterial color="#7c3aed" roughness={0.8} />
              </mesh>
            )
          })}
        </>
      )}
    </group>
  )
}

function UnderwaterVent({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Vent base */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.8, 0.5, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      {/* Vent chimney */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.5, 1, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* Bubbles and particles would be added with a particle system in a real implementation */}
      <pointLight position={[0, 1, 0]} intensity={0.5} color="#94a3b8" distance={3} />
    </group>
  )
}

function CaveEntrance({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Cave entrance */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2, 2, 2, 32, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} side={2} />
      </mesh>

      {/* Surrounding rocks */}
      <mesh position={[1.8, 1, -0.5]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      <mesh position={[-1.8, 1, -0.5]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      <mesh position={[0, 2.5, -0.5]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
    </group>
  )
}
