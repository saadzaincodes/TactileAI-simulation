import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 40

export default function SlipParticles({
  magnitude,
  position,
}: {
  magnitude: number
  position: [number, number, number]
}) {
  const pointsRef = useRef<THREE.Points>(null)

  const { positions, velocities, lifetimes } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const lifetimes = new Float32Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3
      positions[i3] = 0
      positions[i3 + 1] = 0
      positions[i3 + 2] = 0
      const angle = Math.random() * Math.PI * 2
      const speed = 0.02 + Math.random() * 0.04
      velocities[i3] = Math.cos(angle) * speed
      velocities[i3 + 1] = -0.01 - Math.random() * 0.02
      velocities[i3 + 2] = Math.sin(angle) * speed
      lifetimes[i] = Math.random()
    }

    return { positions, velocities, lifetimes }
  }, [])

  useFrame(() => {
    if (!pointsRef.current) return
    const geom = pointsRef.current.geometry
    const pos = geom.attributes.position.array as Float32Array

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3
      lifetimes[i] -= 0.02

      if (lifetimes[i] <= 0) {
        lifetimes[i] = 0.8 + Math.random() * 0.2
        pos[i3] = (Math.random() - 0.5) * 0.1
        pos[i3 + 1] = 0
        pos[i3 + 2] = (Math.random() - 0.5) * 0.1
        const angle = Math.random() * Math.PI * 2
        const speed = (0.02 + Math.random() * 0.04) * magnitude * 3
        velocities[i3] = Math.cos(angle) * speed
        velocities[i3 + 1] = -0.01 - Math.random() * 0.03
        velocities[i3 + 2] = Math.sin(angle) * speed
      }

      pos[i3] += velocities[i3]
      pos[i3 + 1] += velocities[i3 + 1]
      pos[i3 + 2] += velocities[i3 + 2]

      velocities[i3 + 1] -= 0.001
    }

    geom.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color="#ff3355"
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
