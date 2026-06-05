import { useState, useCallback, useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './components/Scene'
import Dashboard from './components/Dashboard'
import ControlPanel from './components/ControlPanel'
import {
  createInitialState,
  stepSimulation,
  activateScenario,
  SimulationState,
  ScenarioType,
} from './simulation/biotacModel'

function SimulationLoop({
  onStateUpdate,
  stateRef,
}: {
  onStateUpdate: (state: SimulationState) => void
  stateRef: React.MutableRefObject<SimulationState>
}) {
  const [simState, setSimState] = useState<SimulationState>(stateRef.current)

  useEffect(() => {
    let frame: number
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      stateRef.current = stepSimulation(stateRef.current, dt)
      setSimState({ ...stateRef.current })
      onStateUpdate(stateRef.current)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onStateUpdate, stateRef])

  return <Scene simState={simState} />
}

export default function App() {
  const stateRef = useRef<SimulationState>(createInitialState())
  const [dashState, setDashState] = useState<SimulationState>(stateRef.current)

  const handleUpdate = useCallback((state: SimulationState) => {
    setDashState(state)
  }, [])

  const handleScenario = useCallback((type: ScenarioType) => {
    stateRef.current = activateScenario(stateRef.current, type)
  }, [])

  const handleWeightChange = useCallback((value: number) => {
    stateRef.current = { ...stateRef.current, baseWeight: value }
  }, [])

  const handleFrictionChange = useCallback((value: number) => {
    stateRef.current = { ...stateRef.current, baseFriction: value }
  }, [])

  return (
    <div className="w-full h-full relative bg-[#08080f]">
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
        camera={{ position: [0, 3.5, 7], fov: 50, near: 0.1, far: 100 }}
      >
        <SimulationLoop onStateUpdate={handleUpdate} stateRef={stateRef} />
      </Canvas>

      <Dashboard state={dashState} />

      <ControlPanel
        state={dashState}
        onScenario={handleScenario}
        onWeightChange={handleWeightChange}
        onFrictionChange={handleFrictionChange}
      />

      {/* Title */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center animate-fade-in" style={{ animationDelay: '0.2s', opacity: 0 }}>
        <h1 className="text-lg font-semibold tracking-tight text-white/90">
          TactileAI
        </h1>
        <p className="text-[10px] text-white/35 font-mono mt-0.5">
          AI vs Traditional Slip Detection
        </p>
      </div>
    </div>
  )
}
