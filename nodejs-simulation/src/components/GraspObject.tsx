import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function GraspObject({
  gripForce,
  slipMagnitude,
  slipDetected,
}: {
  gripForce: number
  slipMagnitude: number
  slipDetected: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const baseY = 1.65

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const slip = slipDetected ? slipMagnitude * 0.05 : 0
      const targetY = baseY - slip
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        targetY,
        0.1
      )

      const wobble = slipDetected
        ? Math.sin(clock.getElapsedTime() * 12) * slipMagnitude * 0.02
        : 0
      meshRef.current.rotation.z = wobble
      meshRef.current.rotation.x = wobble * 0.5

      const scale = 1 - gripForce * 0.05
      meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, scale, 0.1)
    }

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial
      if (slipDetected) {
        const pulse = Math.sin(clock.getElapsedTime() * 8) * 0.5 + 0.5
        mat.emissiveIntensity = 0.5 + pulse * 1.5
        mat.emissive.setHSL(0.0, 0.9, 0.5)
      } else {
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, 0.2, 0.05)
        mat.emissive.setHSL(0.53, 0.8, 0.4)
      }
    }
  })

  return (
    <group>
      <mesh ref={meshRef} position={[0, baseY, 0]} castShadow>
        <sphereGeometry args={[0.08, 32, 32]} />
        <meshStandardMaterial
          color="#e8e0d0"
          metalness={0.1}
          roughness={0.7}
        />
      </mesh>

      <mesh ref={glowRef} position={[0, baseY, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={0.2}
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  )
}
