import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function GraspObject({
  gripForce,
  slipMagnitude,
  slipDetected,
  objectDropped,
  objectY,
}: {
  gripForce: number
  slipMagnitude: number
  slipDetected: boolean
  objectDropped: boolean
  objectY: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const trailRef = useRef<THREE.Mesh>(null)
  const baseY = 1.65

  useFrame(({ clock }) => {
    if (!meshRef.current) return

    if (objectDropped) {
      // Falling — use objectY from simulation
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        baseY + objectY,
        0.3
      )
      // Spin while falling
      meshRef.current.rotation.z += 0.15
      meshRef.current.rotation.x += 0.1
    } else {
      // Held — slide down slightly during slip
      const slip = slipDetected ? slipMagnitude * 0.08 : 0
      const targetY = baseY - slip
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.12)

      // Wobble during slip
      const wobble = slipDetected
        ? Math.sin(clock.getElapsedTime() * 14) * slipMagnitude * 0.03
        : 0
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, wobble, 0.15)
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, wobble * 0.5, 0.15)

      // Squeeze from grip
      const scaleX = 1 - gripForce * 0.06
      meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, scaleX, 0.1)
      meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, scaleX, 0.1)
    }

    // Glow effect
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial
      glowRef.current.position.copy(meshRef.current.position)

      if (objectDropped) {
        // Red danger pulse
        const pulse = Math.sin(clock.getElapsedTime() * 10) * 0.5 + 0.5
        mat.emissiveIntensity = 1 + pulse * 2
        mat.emissive.setHex(0xff3355)
        mat.opacity = 0.25 + pulse * 0.1
      } else if (slipDetected) {
        const pulse = Math.sin(clock.getElapsedTime() * 8) * 0.5 + 0.5
        mat.emissiveIntensity = 0.5 + pulse * 1.5
        mat.emissive.setHex(0xff6600)
        mat.opacity = 0.15 + pulse * 0.1
      } else {
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0.3, 0.05)
        mat.emissive.setHex(0x00ff88)
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.08, 0.05)
      }
    }

    // Motion trail when falling
    if (trailRef.current) {
      trailRef.current.visible = objectDropped
      if (objectDropped && meshRef.current) {
        trailRef.current.position.x = meshRef.current.position.x
        trailRef.current.position.z = meshRef.current.position.z
        trailRef.current.position.y = meshRef.current.position.y + 0.3
        const trailMat = trailRef.current.material as THREE.MeshStandardMaterial
        trailMat.opacity = Math.min(0.4, Math.abs(objectY) * 0.3)
      }
    }
  })

  return (
    <group>
      {/* Main object */}
      <mesh ref={meshRef} position={[0, baseY, 0]} castShadow>
        <sphereGeometry args={[0.08, 32, 32]} />
        <meshStandardMaterial color="#e8e0d0" metalness={0.1} roughness={0.7} />
      </mesh>

      {/* Status glow */}
      <mesh ref={glowRef} position={[0, baseY, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial
          color="#00ff88"
          emissive="#00ff88"
          emissiveIntensity={0.3}
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>

      {/* Fall trail */}
      <mesh ref={trailRef} visible={false}>
        <cylinderGeometry args={[0.01, 0.04, 0.5, 8]} />
        <meshStandardMaterial
          color="#ff3355"
          emissive="#ff3355"
          emissiveIntensity={2}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>

      {/* Ground impact flash */}
      {objectDropped && objectY <= -1.6 && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 32]} />
          <meshStandardMaterial
            color="#ff3355"
            emissive="#ff3355"
            emissiveIntensity={3}
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}
