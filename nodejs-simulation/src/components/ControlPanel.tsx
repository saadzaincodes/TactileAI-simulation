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
    <div className="flex rounded-lg overflow-hidden border border-white/[0.1] bg-white/[0.03]">
      {(['ai', 'traditional'] as ControlMode[]).map(mode => {
        const isActive = active === mode
        const color = mode === 'ai' ? '#00d4ff' : '#ff6b35'
        const label = mode === 'ai' ? 'AI Controller' : 'Traditional PID'
        return (
          <button key={mode} onClick={() => onToggle(mode)}
            className="relative px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer"
            style={{
              background: isActive ? `${color}22` : 'transparent',
              color: isActive ? color : '#556',
              borderRight: mode === 'ai' ? '1px solid rgba(255,255,255,0.08)' : 'none',
            }}>
            {label}
            {isActive && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: color }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, color }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; color: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <span className="text-[10px] uppercase tracking-wider text-white/35 font-medium w-14">{label}</span>
      <div className="relative flex-1">
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} ${pct}%, rgba(40,40,70,0.8) ${pct}%)`,
          }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums font-medium w-8 text-right" style={{ color }}>{value.toFixed(2)}</span>
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
  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-auto animate-slide-up"
      style={{ animationDelay: '0.4s', opacity: 0 }}>
      <div className="glass border-t border-white/[0.06] border-l-0 border-r-0 border-b-0 rounded-none">
        <div className="max-w-5xl mx-auto px-5 py-3 space-y-3">

          {/* Row 1: Mode toggle centered */}
          <div className="flex justify-center">
            <ModeToggle active={state.activeMode} onToggle={onModeToggle} />
          </div>

          {/* Row 2: Scenarios + Sliders */}
          <div className="flex items-center justify-between gap-6">

            {/* Scenario buttons */}
            <div className="flex items-center gap-2">
              {(Object.keys(SCENARIOS) as ScenarioType[]).map(type => {
                const sc = SCENARIOS[type]
                const color = SCENARIO_COLORS[type]
                const active = state.scenario.active && state.scenario.type === type
                return (
                  <button key={type} onClick={() => onScenario(type)}
                    className="group relative px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-all duration-200 cursor-pointer whitespace-nowrap"
                    style={{
                      background: active ? `${color}18` : 'rgba(20, 20, 40, 0.5)',
                      border: `1px solid ${active ? color + '45' : 'rgba(100,120,180,0.1)'}`,
                      color: active ? color : '#556',
                      boxShadow: active ? `0 0 15px ${color}20` : 'none',
                    }}>
                    {sc.label}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded bg-black/90 border border-white/10 text-[9px] text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 font-normal normal-case tracking-normal">
                      {sc.description}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-white/[0.08] shrink-0" />

            {/* Sliders */}
            <div className="flex items-center gap-5">
              <Slider label="Weight" value={state.baseWeight} min={0.1} max={1.0} step={0.01}
                onChange={onWeightChange} color="#ff6b35" />
              <Slider label="Friction" value={state.baseFriction} min={0.1} max={1.0} step={0.01}
                onChange={onFrictionChange} color="#00d4ff" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
