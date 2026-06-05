import { useState } from 'react'
import { SimulationState, ScenarioType, ControlMode, SCENARIOS } from '../simulation/biotacModel'

const SCENARIO_COLORS: Record<ScenarioType, string> = {
  steady: '#00ff88',
  weight_surge: '#ff6b35',
  friction_drop: '#00d4ff',
  vibration: '#ffaa00',
  stress_test: '#ff3355',
}

function ModeToggle({ active, onToggle }: { active: ControlMode; onToggle: (m: ControlMode) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
      {(['ai', 'traditional'] as ControlMode[]).map(mode => {
        const isActive = active === mode
        const color = mode === 'ai' ? '#00d4ff' : '#ff6b35'
        const label = mode === 'ai' ? 'AI Controller' : 'Traditional PID'
        return (
          <button
            key={mode}
            onClick={() => onToggle(mode)}
            className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer"
            style={{
              background: isActive ? `${color}18` : 'transparent',
              color: isActive ? color : '#445',
              borderRight: mode === 'ai' ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function ScenarioButton({
  type,
  active,
  onClick,
}: {
  type: ScenarioType
  active: boolean
  onClick: () => void
}) {
  const sc = SCENARIOS[type]
  const color = SCENARIO_COLORS[type]

  return (
    <button
      onClick={onClick}
      className="relative group flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer"
      style={{
        background: active ? `${color}15` : 'rgba(20, 20, 40, 0.5)',
        border: `1px solid ${active ? color + '50' : 'rgba(100, 120, 180, 0.1)'}`,
        boxShadow: active ? `0 0 16px ${color}25` : 'none',
      }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wider leading-none"
        style={{ color: active ? color : '#445' }}>
        {sc.label}
      </span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black/90 border border-white/10 text-[9px] text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {sc.description}
      </div>
    </button>
  )
}

function Slider({ label, value, min, max, step, onChange, color }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; color: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-center">
        <span className="text-[8px] uppercase tracking-wider text-white/25">{label}</span>
        <span className="text-[10px] font-mono tabular-nums" style={{ color }}>{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${((value - min) / (max - min)) * 100}%, rgba(40,40,70,0.8) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  )
}

export default function ControlPanel({
  state, onScenario, onModeToggle, onWeightChange, onFrictionChange,
}: {
  state: SimulationState
  onScenario: (type: ScenarioType) => void
  onModeToggle: (mode: ControlMode) => void
  onWeightChange: (v: number) => void
  onFrictionChange: (v: number) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 glass rounded-xl pointer-events-auto animate-slide-up"
      style={{ animationDelay: '0.4s', opacity: 0, maxWidth: '520px', width: '92%' }}>

      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 cursor-pointer">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Controls</span>
          {state.scenario.active && (
            <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: SCENARIO_COLORS[state.scenario.type],
                background: SCENARIO_COLORS[state.scenario.type] + '12',
                border: `1px solid ${SCENARIO_COLORS[state.scenario.type]}25`,
              }}>
              {state.scenario.label}
            </span>
          )}
        </div>
        <span className="text-white/20 text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Mode toggle */}
          <div className="flex justify-center">
            <ModeToggle active={state.activeMode} onToggle={onModeToggle} />
          </div>

          {/* Scenarios */}
          <div className="flex gap-1.5 justify-center flex-wrap">
            {(Object.keys(SCENARIOS) as ScenarioType[]).map(type => (
              <ScenarioButton key={type} type={type}
                active={state.scenario.active && state.scenario.type === type}
                onClick={() => onScenario(type)} />
            ))}
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-2 gap-4">
            <Slider label="Object Weight" value={state.baseWeight} min={0.1} max={1.0} step={0.01}
              onChange={onWeightChange} color="#ff6b35" />
            <Slider label="Surface Friction" value={state.baseFriction} min={0.1} max={1.0} step={0.01}
              onChange={onFrictionChange} color="#00d4ff" />
          </div>
        </div>
      )}
    </div>
  )
}
