import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SENSOR_ROWS, SENSOR_COLS } from '../simulation/biotacModel'

function pressureToColor(value: number, slipDetected: boolean): THREE.Color {
  if (slipDetected && value > 0.3) {
    const t = (value - 0.3) / 0.7;
    return new THREE.Color().setHSL(0.0 + t * 0.05, 0.9, 0.4 + t * 0.2);
  }
  const hue = 0.55 - value * 0.55;
  const saturation = 0.6 + value * 0.4;
  const lightness = 0.15 + value * 0.45;
  return new THREE.Color().setHSL(hue, saturation, lightness);
}

function SensorCell({
  row,
  col,
  value,
  slipDetected,
}: {
  row: number
  col: number
  value: number
  slipDetected: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const cellSize = 0.045
  const gap = 0.005
  const startX = -((SENSOR_COLS - 1) * (cellSize + gap)) / 2
  const startY = -((SENSOR_ROWS - 1) * (cellSize + gap)) / 2

  useFrame(() => {
    if (ref.current && matRef.current) {
      const targetY = value * 0.03
      ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, targetY, 0.15)

      const color = pressureToColor(value, slipDetected)
      matRef.current.color.lerp(color, 0.2)
      matRef.current.emissive.lerp(color, 0.2)
      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        matRef.current.emissiveIntensity,
        0.3 + value * 1.5,
        0.15
      )
    }
  })

  return (
    <mesh
      ref={ref}
      position={[
        startX + col * (cellSize + gap),
        startY + row * (cellSize + gap),
        0,
      ]}
    >
      <boxGeometry args={[cellSize, cellSize, 0.015 + value * 0.02]} />
      <meshStandardMaterial
        ref={matRef}
        color="#00d4ff"
        emissive="#00d4ff"
        emissiveIntensity={0.5}
        metalness={0.3}
        roughness={0.5}
        transparent
        opacity={0.7 + value * 0.3}
      />
    </mesh>
  )
}

export default function TactileSensor({
  electrodes,
  slipDetected,
  position,
}: {
  electrodes: number[][]
  slipDetected: boolean
  position: [number, number, number]
}) {
  const groupRef = useRef<THREE.Group>(null)
  const borderRef = useRef<THREE.Mesh>(null)

  const gridWidth = (SENSOR_COLS - 1) * 0.05 + 0.045
  const gridHeight = (SENSOR_ROWS - 1) * 0.05 + 0.045

  const borderColor = useMemo(() => new THREE.Color(), [])

  useFrame(({ clock }) => {
    if (borderRef.current) {
      const mat = borderRef.current.material as THREE.MeshStandardMaterial
      const targetColor = slipDetected
        ? borderColor.setHSL(0.0, 0.9, 0.5 + Math.sin(clock.getElapsedTime() * 6) * 0.2)
        : borderColor.setHSL(0.53, 0.8, 0.4)
      mat.emissive.lerp(targetColor, 0.1)
      mat.emissiveIntensity = slipDetected ? 1.5 : 0.4
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={[0.3, -0.5, 0]}>
      {/* Sensor housing */}
      <mesh castShadow>
        <boxGeometry args={[gridWidth + 0.06, gridHeight + 0.06, 0.03]} />
        <meshStandardMaterial
          color="#15152a"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Glowing border */}
      <mesh ref={borderRef} position={[0, 0, 0.005]}>
        <boxGeometry args={[gridWidth + 0.04, gridHeight + 0.04, 0.005]} />
        <meshStandardMaterial
          color="#00334d"
          emissive="#00d4ff"
          emissiveIntensity={0.4}
          metalness={0.5}
          roughness={0.4}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Sensor cells */}
      <group position={[0, 0, 0.02]}>
        {electrodes.map((row, r) =>
          row.map((value, c) => (
            <SensorCell
              key={`${r}-${c}`}
              row={r}
              col={c}
              value={value}
              slipDetected={slipDetected}
            />
          ))
        )}
      </group>

      {/* Label */}
      <mesh position={[0, gridHeight / 2 + 0.05, 0.01]}>
        <planeGeometry args={[0.15, 0.02]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  )
}
