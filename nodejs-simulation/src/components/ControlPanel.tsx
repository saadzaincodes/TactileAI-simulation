import { useState } from 'react'
import { SimulationState, ScenarioType, SCENARIOS } from '../simulation/biotacModel'

const SCENARIO_ICONS: Record<ScenarioType, string> = {
  steady: '●',     // circle
  weight_surge: '▲', // triangle up
  friction_drop: '▼', // triangle down (drop)
  vibration: '≈',   // wave
  stress_test: '⚠', // warning
}

const SCENARIO_COLORS: Record<ScenarioType, string> = {
  steady: '#00ff88',
  weight_surge: '#ff6b35',
  friction_drop: '#00d4ff',
  vibration: '#ffaa00',
  stress_test: '#ff3355',
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
  const scenario = SCENARIOS[type]
  const color = SCENARIO_COLORS[type]

  return (
    <button
      onClick={onClick}
      className="relative group flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer"
      style={{
        background: active
          ? `linear-gradient(135deg, ${color}20, ${color}08)`
          : 'rgba(20, 20, 40, 0.6)',
        border: `1px solid ${active ? color + '60' : 'rgba(100, 120, 180, 0.12)'}`,
        boxShadow: active ? `0 0 20px ${color}30, inset 0 0 20px ${color}10` : 'none',
      }}
    >
      <span
        className="text-base leading-none"
        style={{ color: active ? color : '#667' }}
      >
        {SCENARIO_ICONS[type]}
      </span>
      <span
        className="text-[9px] font-semibold uppercase tracking-wider leading-none"
        style={{ color: active ? color : '#556' }}
      >
        {scenario.label}
      </span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black/90 border border-white/10 text-[10px] text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {scenario.description}
      </div>
    </button>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  color,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  color: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[9px] uppercase tracking-wider text-white/30 font-medium">{label}</span>
        <span className="text-[11px] font-mono tabular-nums" style={{ color }}>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${((value - min) / (max - min)) * 100}%, rgba(40, 40, 70, 0.8) ${((value - min) / (max - min)) * 100}%)`,
          accentColor: color,
        }}
      />
    </div>
  )
}

export default function ControlPanel({
  state,
  onScenario,
  onWeightChange,
  onFrictionChange,
}: {
  state: SimulationState
  onScenario: (type: ScenarioType) => void
  onWeightChange: (v: number) => void
  onFrictionChange: (v: number) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 glass rounded-xl pointer-events-auto animate-slide-up"
      style={{ animationDelay: '0.4s', opacity: 0, maxWidth: '600px', width: '95%' }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Scenario Controls
          </span>
          {state.scenario.active && (
            <span
              className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: SCENARIO_COLORS[state.scenario.type],
                background: SCENARIO_COLORS[state.scenario.type] + '15',
                border: `1px solid ${SCENARIO_COLORS[state.scenario.type]}30`,
              }}
            >
              {state.scenario.label} Active
            </span>
          )}
        </div>
        <span className="text-white/30 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {/* Scenario buttons */}
          <div className="flex gap-2 justify-center flex-wrap">
            {(Object.keys(SCENARIOS) as ScenarioType[]).map(type => (
              <ScenarioButton
                key={type}
                type={type}
                active={state.scenario.active && state.scenario.type === type}
                onClick={() => onScenario(type)}
              />
            ))}
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <Slider
              label="Object Weight"
              value={state.baseWeight}
              min={0.1}
              max={1.0}
              step={0.01}
              onChange={onWeightChange}
              color="#ff6b35"
            />
            <Slider
              label="Surface Friction"
              value={state.baseFriction}
              min={0.1}
              max={1.0}
              step={0.01}
              onChange={onFrictionChange}
              color="#00d4ff"
            />
          </div>
        </div>
      )}
    </div>
  )
}
