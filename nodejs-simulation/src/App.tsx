import { useState, useCallback, useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Leva, useControls } from 'leva'
import Scene from './components/Scene'
import Dashboard from './components/Dashboard'
import { createInitialState, stepSimulation, SimulationState } from './simulation/biotacModel'

function SimulationControls({ onStateUpdate }: { onStateUpdate: (state: SimulationState) => void }) {
  const stateRef = useRef<SimulationState>(createInitialState())
  const [simState, setSimState] = useState<SimulationState>(stateRef.current)

  const controls = useControls('Simulation', {
    objectWeight: { value: 0.4, min: 0.1, max: 1.0, step: 0.01, label: 'Object Weight' },
    objectFriction: { value: 0.6, min: 0.1, max: 1.0, step: 0.01, label: 'Surface Friction' },
    controlMode: { options: { 'AI Controller': 'ai', 'Traditional PID': 'traditional' }, label: 'Control Mode' },
    speed: { value: 1, min: 0.1, max: 3, step: 0.1, label: 'Sim Speed' },
  })

  useEffect(() => {
    let frame: number
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05) * controls.speed
      last = now

      stateRef.current = stepSimulation(stateRef.current, dt, {
        objectWeight: controls.objectWeight,
        objectFriction: controls.objectFriction,
        controlMode: controls.controlMode as 'ai' | 'traditional',
      })

      setSimState({ ...stateRef.current })
      onStateUpdate(stateRef.current)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [controls.objectWeight, controls.objectFriction, controls.controlMode, controls.speed, onStateUpdate])

  return <Scene simState={simState} />
}

export default function App() {
  const [dashState, setDashState] = useState<SimulationState>(createInitialState())
  const handleUpdate = useCallback((state: SimulationState) => {
    setDashState(state)
  }, [])

  return (
    <div className="w-full h-full relative">
      <Leva
        collapsed={true}
        titleBar={{ title: 'Controls' }}
        theme={{
          colors: {
            highlight1: '#00d4ff',
            highlight2: '#00d4ff',
            accent1: '#00d4ff',
            accent2: '#0099cc',
            accent3: '#006688',
          },
          sizes: {
            rootWidth: '280px',
          },
        }}
      />

      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: 3,
          toneMappingExposure: 1.1,
        }}
        camera={{ position: [2.5, 2, 3], fov: 45, near: 0.1, far: 100 }}
      >
        <SimulationControls onStateUpdate={handleUpdate} />
      </Canvas>

      <Dashboard state={dashState} />

      <div className="absolute top-4 left-4 animate-fade-in" style={{ animationDelay: '0.2s', opacity: 0 }}>
        <h1 className="text-xl font-semibold tracking-tight text-white/90">
          TactileAI
        </h1>
        <p className="text-xs text-white/40 font-mono mt-0.5">
          Robotic Slip Detection Simulation
        </p>
      </div>
    </div>
  )
}
