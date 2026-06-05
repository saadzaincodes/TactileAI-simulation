import { useMemo } from 'react'
import { SimulationState, ControlMode } from '../simulation/biotacModel'

/* ── Overlaid comparison chart ── */
function ComparisonChart({
  dataA, dataB, colorA, colorB, labelA, labelB, height = 44,
}: {
  dataA: number[]; dataB: number[]; colorA: string; colorB: string
  labelA: string; labelB: string; height?: number
}) {
  const max = Math.max(...dataA, ...dataB, 0.01)
  const W = 200
  const makePath = (data: number[]) => {
    const step = W / (data.length - 1)
    return data.map((v, i) => {
      const x = i * step
      const y = height - (v / max) * height * 0.85 - height * 0.05
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  }
  const pathA = useMemo(() => makePath(dataA), [dataA, max, height])
  const pathB = useMemo(() => makePath(dataB), [dataB, max, height])
  const fillA = useMemo(() => `${pathA} L ${W} ${height} L 0 ${height} Z`, [pathA, height])

  return (
    <div>
      <div className="flex items-center gap-3 mb-0.5">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-[2px] rounded-full" style={{ background: colorA }} />
          <span className="text-[7px] uppercase tracking-wider" style={{ color: colorA }}>{labelA}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-[2px] rounded-full opacity-50" style={{ background: colorB }} />
          <span className="text-[7px] uppercase tracking-wider opacity-50" style={{ color: colorB }}>{labelB}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`cg-${colorA.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorA} stopOpacity="0.12" />
            <stop offset="100%" stopColor={colorA} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillA} fill={`url(#cg-${colorA.replace('#', '')})`} />
        <path d={pathB} fill="none" stroke={colorB} strokeWidth="1" strokeDasharray="4 3"
          strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.45} />
        <path d={pathA} fill="none" stroke={colorA} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

/* ── Pressure grid ── */
function PressureGrid({ electrodes, slipDetected }: { electrodes: number[][]; slipDetected: boolean }) {
  return (
    <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${electrodes[0]?.length || 8}, 1fr)` }}>
      {electrodes.flat().map((val, i) => {
        const hue = slipDetected && val > 0.3 ? 0 : 190 - val * 190
        const sat = 60 + val * 40
        const light = 10 + val * 50
        return (
          <div key={i} className="sensor-cell rounded-[1px]" style={{
            aspectRatio: '1',
            backgroundColor: `hsl(${hue}, ${sat}%, ${light}%)`,
            boxShadow: val > 0.5 ? `0 0 ${val * 3}px hsla(${hue}, 90%, 50%, 0.3)` : 'none',
          }} />
        )
      })}
    </div>
  )
}

/* ── Score ring ── */
function ScoreRing({ score, color, size = 36 }: { score: number; color: string; size?: number }) {
  const r = size / 2 - 3
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize="9" fontWeight="600" fontFamily="JetBrains Mono, monospace" fill={color}>
        {Math.round(score)}
      </text>
    </svg>
  )
}

/* ── Mode toggle (integrated into top bar) ── */
function ModeToggle({ active, onToggle }: { active: ControlMode; onToggle: (m: ControlMode) => void }) {
  return (
    <div className="flex rounded-md overflow-hidden border border-white/[0.08]">
      {(['ai', 'traditional'] as ControlMode[]).map(mode => {
        const isActive = active === mode
        const color = mode === 'ai' ? '#00d4ff' : '#ff6b35'
        const label = mode === 'ai' ? 'AI' : 'PID'
        return (
          <button key={mode} onClick={() => onToggle(mode)}
            className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer"
            style={{
              background: isActive ? `${color}20` : 'transparent',
              color: isActive ? color : '#445',
              borderRight: mode === 'ai' ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Main dashboard ── */
export default function Dashboard({ state, onModeToggle }: { state: SimulationState; onModeToggle: (m: ControlMode) => void }) {
  const active = state.activeMode === 'ai' ? state.ai : state.pid
  const aiColor = '#00d4ff'
  const pidColor = '#ff6b35'

  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* ── Top bar: title + mode toggle + time ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 pointer-events-auto">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white/90">TactileAI</h1>
            <p className="text-[8px] text-white/25 font-mono">Robotic Slip Detection</p>
          </div>
          <ModeToggle active={state.activeMode} onToggle={onModeToggle} />
        </div>

        <div className="glass rounded-md px-2.5 py-1.5 flex items-center gap-2">
          <span className="text-[8px] text-white/25 uppercase tracking-wider">Time</span>
          <span className="text-xs font-mono text-white/60 tabular-nums">{state.time.toFixed(1)}s</span>
          <div className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: '#00ff88', boxShadow: '0 0 6px #00ff88', animation: 'pulse-glow 2s infinite' }} />
        </div>
      </div>

      {/* ── Right panel: comparison charts ── */}
      <div className="absolute right-3 top-14 bottom-14 flex flex-col justify-center pointer-events-auto">
        <div className="glass rounded-xl p-3 animate-slide-up" style={{ width: '230px', animationDelay: '0.3s', opacity: 0 }}>

          <span className="text-[9px] font-medium text-white/35 uppercase tracking-wider block mb-2">
            Controller Comparison
          </span>

          {/* Score row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col items-center">
              <ScoreRing score={state.ai.gripScore} color={aiColor} />
              <span className="text-[7px] uppercase tracking-wider mt-0.5" style={{ color: aiColor }}>AI</span>
            </div>
            <div className="flex gap-5">
              <div className="text-center">
                <div className="text-sm font-bold font-mono tabular-nums"
                  style={{ color: state.ai.dropCount > state.pid.dropCount ? '#ff3355' : '#e0e4f0' }}>
                  {state.ai.dropCount}
                </div>
                <div className="text-[6px] text-white/20 uppercase">AI drops</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold font-mono tabular-nums"
                  style={{ color: state.pid.dropCount > state.ai.dropCount ? '#ff3355' : '#e0e4f0' }}>
                  {state.pid.dropCount}
                </div>
                <div className="text-[6px] text-white/20 uppercase">PID drops</div>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing score={state.pid.gripScore} color={pidColor} />
              <span className="text-[7px] uppercase tracking-wider mt-0.5" style={{ color: pidColor }}>PID</span>
            </div>
          </div>

          {/* Charts */}
          <div className="space-y-2">
            <div>
              <span className="text-[7px] uppercase tracking-wider text-white/20 block mb-0.5">Grip Force</span>
              <ComparisonChart dataA={state.ai.forceHistory} dataB={state.pid.forceHistory}
                colorA={aiColor} colorB={pidColor} labelA="AI" labelB="PID" />
            </div>
            <div>
              <span className="text-[7px] uppercase tracking-wider text-white/20 block mb-0.5">Slip Magnitude</span>
              <ComparisonChart dataA={state.ai.slipHistory} dataB={state.pid.slipHistory}
                colorA={aiColor} colorB={pidColor} labelA="AI" labelB="PID" height={40} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom-left: BioTac sensor ── */}
      <div className="absolute left-3 bottom-14 glass rounded-xl p-2.5 pointer-events-auto animate-slide-up"
        style={{ width: '140px', animationDelay: '0.5s', opacity: 0 }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] font-medium text-white/35 uppercase tracking-wider">BioTac</span>
          <div className="w-1.5 h-1.5 rounded-full" style={{
            backgroundColor: active.slipEvent.detected ? '#ffaa00' : '#00ff88',
            boxShadow: `0 0 4px ${active.slipEvent.detected ? '#ffaa00' : '#00ff88'}`,
          }} />
        </div>
        <PressureGrid electrodes={active.sensorReading.electrodes} slipDetected={active.slipEvent.detected} />
        <div className="grid grid-cols-3 gap-1 mt-1.5">
          <div>
            <span className="text-[6px] text-white/18 uppercase">Grip</span>
            <div className="text-[10px] font-mono font-semibold tabular-nums"
              style={{ color: state.activeMode === 'ai' ? aiColor : pidColor }}>
              {(active.gripForce * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <span className="text-[6px] text-white/18 uppercase">Temp</span>
            <div className="text-[10px] font-mono text-white/45 tabular-nums">{active.sensorReading.temperature.toFixed(1)}°</div>
          </div>
          <div>
            <span className="text-[6px] text-white/18 uppercase">Imp</span>
            <div className="text-[10px] font-mono text-white/45 tabular-nums">{active.sensorReading.impedance.toFixed(0)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
