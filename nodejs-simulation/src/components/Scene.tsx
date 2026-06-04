import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Environment,
  ContactShadows,
  OrbitControls,
  Grid,
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

export default function Scene({ simState }: { simState: SimulationState }) {
  const lightRef = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    if (lightRef.current) {
      const t = clock.getElapsedTime()
      lightRef.current.intensity = 40 + Math.sin(t * 2) * 5
    }
  })

  return (
    <>
      <color attach="background" args={['#08080f']} />
      <fog attach="fog" args={['#08080f', 8, 25]} />

      <ambientLight intensity={0.6} color="#c0d0ff" />

      <directionalLight
        position={[5, 8, 3]}
        intensity={3.5}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={20}
        shadow-camera-near={0.1}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.001}
      />

      <directionalLight
        position={[-3, 5, -2]}
        intensity={1.5}
        color="#6080ff"
      />

      <pointLight
        ref={lightRef}
        position={[-2, 3, 2]}
        intensity={60}
        color="#00d4ff"
        distance={12}
        decay={2}
      />

      <pointLight
        position={[3, 2, -3]}
        intensity={30}
        color="#ff6b35"
        distance={10}
        decay={2}
      />

      <pointLight
        position={[0, 2, 3]}
        intensity={25}
        color="#8080ff"
        distance={8}
        decay={2}
      />

      <spotLight
        position={[0, 6, 0]}
        angle={0.5}
        penumbra={0.8}
        intensity={100}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <RoboticArm jointAngles={simState.armJointAngles} gripForce={simState.gripForce} />

      <Float speed={0.5} rotationIntensity={0} floatIntensity={0.3} floatingRange={[-0.02, 0.02]}>
        <TactileSensor
          electrodes={simState.sensorReading.electrodes}
          slipDetected={simState.slipEvent.detected}
          position={[0.8, 2.1, 0]}
        />
      </Float>

      <GraspObject
        gripForce={simState.gripForce}
        slipMagnitude={simState.slipEvent.magnitude}
        slipDetected={simState.slipEvent.detected}
      />

      {simState.slipEvent.detected && (
        <SlipParticles
          magnitude={simState.slipEvent.magnitude}
          position={[0, 1.8, 0]}
        />
      )}

      {/* Ground glow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[0.6, 48]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={0.15}
          transparent
          opacity={0.2}
        />
      </mesh>

      <Grid
        position={[0, -0.01, 0]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#1a1a3a"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#252555"
        fadeDistance={12}
        fadeStrength={1}
        infiniteGrid
      />

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
        color="#000020"
      />

      <Environment preset="city" background={false} environmentIntensity={0.3} />

      <OrbitControls
        makeDefault
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2.5}
        maxDistance={12}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2 - 0.1}
        autoRotate
        autoRotateSpeed={0.4}
        target={[0, 1.2, 0]}
      />

      <EffectComposer multisampling={4}>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.0005, 0.0005)}
          radialModulation={true}
          modulationOffset={0.5}
        />
        <Vignette
          offset={0.3}
          darkness={0.7}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    </>
  )
}
