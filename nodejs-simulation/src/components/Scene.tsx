import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Environment,
  ContactShadows,
  OrbitControls,
  Grid,
  Text,
  Float,
} from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { SimulationState } from '../simulation/biotacModel'
import RoboticArm from './RoboticArm'
import TactileSensor from './TactileSensor'
import GraspObject from './GraspObject'
import SlipParticles from './SlipParticles'

const ARM_SPACING = 2.2

function ArmLabel({
  text,
  position,
  color,
  status,
}: {
  text: string
  position: [number, number, number]
  color: string
  status: 'ok' | 'warning' | 'dropped'
}) {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 1.5) * 0.02
    }
  })

  const statusColor = status === 'ok' ? '#00ff88' : status === 'warning' ? '#ffaa00' : '#ff3355'

  return (
    <group ref={ref} position={position}>
      <Text
        fontSize={0.12}
        color={color}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        letterSpacing={0.15}
      >
        {text}
      </Text>
      {/* Status dot */}
      <mesh position={[0, -0.12, 0]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  )
}

function DividerLine() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.005, 3.5, 0.005]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.3}
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  )
}

export default function Scene({ simState }: { simState: SimulationState }) {
  const lightRef = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    if (lightRef.current) {
      const t = clock.getElapsedTime()
      lightRef.current.intensity = 50 + Math.sin(t * 2) * 8
    }
  })

  const aiStatus = simState.ai.objectDropped ? 'dropped' : simState.ai.slipEvent.detected ? 'warning' : 'ok'
  const pidStatus = simState.pid.objectDropped ? 'dropped' : simState.pid.slipEvent.detected ? 'warning' : 'ok'

  return (
    <>
      <color attach="background" args={['#08080f']} />
      <fog attach="fog" args={['#08080f', 10, 30]} />

      {/* Lighting */}
      <ambientLight intensity={0.5} color="#c0d0ff" />
      <directionalLight position={[5, 8, 3]} intensity={3} color="#ffffff" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={20} shadow-camera-near={0.1}
        shadow-camera-left={-6} shadow-camera-right={6}
        shadow-camera-top={5} shadow-camera-bottom={-5}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-3, 5, -2]} intensity={1.5} color="#6080ff" />
      <pointLight ref={lightRef} position={[-ARM_SPACING, 3, 2]} intensity={50} color="#00d4ff" distance={12} decay={2} />
      <pointLight position={[ARM_SPACING, 3, 2]} intensity={50} color="#00d4ff" distance={12} decay={2} />
      <pointLight position={[0, 2, -3]} intensity={20} color="#ff6b35" distance={10} decay={2} />
      <spotLight position={[-ARM_SPACING, 6, 0]} angle={0.4} penumbra={0.8} intensity={80} color="#ffffff" castShadow />
      <spotLight position={[ARM_SPACING, 6, 0]} angle={0.4} penumbra={0.8} intensity={80} color="#ffffff" castShadow />

      {/* ── AI ARM (Left) ── */}
      <group position={[-ARM_SPACING, 0, 0]}>
        <RoboticArm jointAngles={simState.ai.jointAngles} gripForce={simState.ai.gripForce} />
        <GraspObject
          gripForce={simState.ai.gripForce}
          slipMagnitude={simState.ai.slipEvent.magnitude}
          slipDetected={simState.ai.slipEvent.detected}
          objectDropped={simState.ai.objectDropped}
          objectY={simState.ai.objectY}
        />
        {simState.ai.slipEvent.detected && !simState.ai.objectDropped && (
          <SlipParticles magnitude={simState.ai.slipEvent.magnitude} position={[0, 1.8, 0]} />
        )}
        {/* Success aura when stable */}
        {!simState.ai.slipEvent.detected && !simState.ai.objectDropped && (
          <pointLight position={[0, 1.5, 0.5]} intensity={8} color="#00ff88" distance={2} decay={2} />
        )}
        <Float speed={0.5} rotationIntensity={0} floatIntensity={0.2} floatingRange={[-0.015, 0.015]}>
          <TactileSensor
            electrodes={simState.ai.sensorReading.electrodes}
            slipDetected={simState.ai.slipEvent.detected}
            position={[0.7, 2.1, 0]}
          />
        </Float>
      </group>

      {/* ── PID ARM (Right) ── */}
      <group position={[ARM_SPACING, 0, 0]}>
        <RoboticArm jointAngles={simState.pid.jointAngles} gripForce={simState.pid.gripForce} />
        <GraspObject
          gripForce={simState.pid.gripForce}
          slipMagnitude={simState.pid.slipEvent.magnitude}
          slipDetected={simState.pid.slipEvent.detected}
          objectDropped={simState.pid.objectDropped}
          objectY={simState.pid.objectY}
        />
        {simState.pid.slipEvent.detected && !simState.pid.objectDropped && (
          <SlipParticles magnitude={simState.pid.slipEvent.magnitude} position={[0, 1.8, 0]} />
        )}
        <Float speed={0.5} rotationIntensity={0} floatIntensity={0.2} floatingRange={[-0.015, 0.015]}>
          <TactileSensor
            electrodes={simState.pid.sensorReading.electrodes}
            slipDetected={simState.pid.slipEvent.detected}
            position={[0.7, 2.1, 0]}
          />
        </Float>
      </group>

      {/* Labels */}
      <ArmLabel text="AI  CONTROLLER" position={[-ARM_SPACING, 3.0, 0]} color="#00d4ff" status={aiStatus} />
      <ArmLabel text="TRADITIONAL  PID" position={[ARM_SPACING, 3.0, 0]} color="#ff6b35" status={pidStatus} />

      {/* Centre divider */}
      <DividerLine />

      {/* Scenario active indicator */}
      {simState.scenario.active && (
        <Text
          position={[0, 2.8, 0]}
          fontSize={0.08}
          color="#ffaa00"
          anchorX="center"
          font="https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
          letterSpacing={0.12}
        >
          {simState.scenario.label.toUpperCase()} ACTIVE
        </Text>
      )}

      {/* Ground glow discs */}
      {[-ARM_SPACING, ARM_SPACING].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 0]}>
          <circleGeometry args={[0.6, 48]} />
          <meshStandardMaterial
            color={i === 0 ? '#00d4ff' : '#ff6b35'}
            emissive={i === 0 ? '#00d4ff' : '#ff6b35'}
            emissiveIntensity={0.12}
            transparent
            opacity={0.2}
          />
        </mesh>
      ))}

      <Grid
        position={[0, -0.01, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#1a1a3a"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#252555"
        fadeDistance={14}
        fadeStrength={1}
        infiniteGrid
      />
      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={12} blur={2} far={4} color="#000020" />
      <Environment preset="city" background={false} environmentIntensity={0.3} />

      <OrbitControls
        makeDefault
        enablePan enableZoom enableRotate
        minDistance={4}
        maxDistance={15}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2 - 0.1}
        autoRotate
        autoRotateSpeed={0.15}
        target={[0, 1.2, 0]}
      />

      <EffectComposer multisampling={4}>
        <Bloom intensity={0.9} luminanceThreshold={0.5} luminanceSmoothing={0.9} mipmapBlur />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.0004, 0.0004)}
          radialModulation modulationOffset={0.5}
        />
        <Vignette offset={0.3} darkness={0.65} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    </>
  )
}
