import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface JointProps {
  radius: number
  height: number
  color: string
  emissive?: string
  emissiveIntensity?: number
}

function Joint({ radius, height, color, emissive = '#000000', emissiveIntensity = 0 }: JointProps) {
  return (
    <mesh castShadow>
      <cylinderGeometry args={[radius, radius, height, 32]} />
      <meshStandardMaterial
        color={color}
        metalness={0.9}
        roughness={0.15}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
}

function Segment({ length, width }: { length: number; width: number }) {
  return (
    <group position={[0, length / 2, 0]}>
      {/* Main body */}
      <mesh castShadow>
        <boxGeometry args={[width, length, width]} />
        <meshStandardMaterial
          color="#505070"
          metalness={0.7}
          roughness={0.3}
          envMapIntensity={2}
        />
      </mesh>
      {/* Edge accent strip */}
      <mesh position={[width / 2 + 0.002, 0, 0]}>
        <boxGeometry args={[0.004, length * 0.8, width * 0.3]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
        />
      </mesh>
      <mesh position={[-width / 2 - 0.002, 0, 0]}>
        <boxGeometry args={[0.004, length * 0.8, width * 0.3]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  )
}

function JointRing({ radius, slipDetected }: { radius: number; slipDetected?: boolean }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 3) * 0.3
    }
  })

  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.015, 16, 32]} />
      <meshStandardMaterial
        color={slipDetected ? '#ff3355' : '#00d4ff'}
        emissive={slipDetected ? '#ff3355' : '#00d4ff'}
        emissiveIntensity={0.5}
        metalness={0.3}
        roughness={0.4}
      />
    </mesh>
  )
}

function GripperFinger({ side, openAmount }: { side: 1 | -1; openAmount: number }) {
  const fingerWidth = 0.04;
  const fingerLength = 0.35;
  const offset = 0.06 + openAmount * 0.12;

  return (
    <group position={[side * offset, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[fingerWidth, fingerLength, fingerWidth * 1.5]} />
        <meshStandardMaterial
          color="#3a3a55"
          metalness={0.9}
          roughness={0.15}
        />
      </mesh>

      <mesh position={[side * -0.01, -fingerLength / 2 + 0.03, 0]}>
        <boxGeometry args={[fingerWidth * 0.8, 0.06, fingerWidth * 1.3]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={0.4}
          metalness={0.4}
          roughness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}

export default function RoboticArm({
  jointAngles,
  gripForce,
}: {
  jointAngles: number[]
  gripForce: number
}) {
  const groupRef = useRef<THREE.Group>(null)

  const baseMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2e2e48',
        metalness: 0.9,
        roughness: 0.15,
      }),
    []
  )

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Base platform */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow material={baseMaterial}>
        <cylinderGeometry args={[0.3, 0.35, 0.1, 48]} />
      </mesh>

      {/* Base ring glow */}
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.008, 16, 48]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={1}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Joint 1 - Base rotation */}
      <group position={[0, 0.1, 0]} rotation={[0, jointAngles[0], 0]}>
        <Joint radius={0.12} height={0.15} color="#38385a" emissive="#00d4ff" emissiveIntensity={0.1} />
        <JointRing radius={0.13} />

        {/* Segment 1 */}
        <group position={[0, 0.08, 0]}>
          <Segment length={0.6} width={0.09} />

          {/* Joint 2 - Shoulder */}
          <group position={[0, 0.6, 0]} rotation={[jointAngles[1], 0, 0]}>
            <Joint radius={0.08} height={0.1} color="#38385a" emissive="#00d4ff" emissiveIntensity={0.1} />
            <JointRing radius={0.09} />

            {/* Segment 2 */}
            <group position={[0, 0.05, 0]}>
              <Segment length={0.5} width={0.07} />

              {/* Joint 3 - Elbow */}
              <group position={[0, 0.5, 0]} rotation={[jointAngles[2], 0, 0]}>
                <Joint radius={0.06} height={0.08} color="#38385a" emissive="#00d4ff" emissiveIntensity={0.15} />
                <JointRing radius={0.07} />

                {/* Segment 3 */}
                <group position={[0, 0.04, 0]}>
                  <Segment length={0.4} width={0.055} />

                  {/* Joint 4 - Wrist */}
                  <group position={[0, 0.4, 0]} rotation={[jointAngles[3], 0, jointAngles[4]]}>
                    <Joint radius={0.045} height={0.06} color="#38385a" emissive="#00d4ff" emissiveIntensity={0.2} />
                    <JointRing radius={0.05} />

                    {/* Gripper mount */}
                    <group position={[0, 0.06, 0]}>
                      <mesh castShadow>
                        <boxGeometry args={[0.1, 0.04, 0.06]} />
                        <meshStandardMaterial color="#2e2e48" metalness={0.85} roughness={0.2} />
                      </mesh>

                      {/* Gripper fingers */}
                      <group position={[0, -0.02, 0]}>
                        <GripperFinger side={1} openAmount={1 - gripForce} />
                        <GripperFinger side={-1} openAmount={1 - gripForce} />
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
