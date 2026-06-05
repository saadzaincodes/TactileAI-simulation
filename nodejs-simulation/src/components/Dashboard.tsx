import { useMemo } from 'react'
import { SimulationState } from '../simulation/biotacModel'

/* ── Overlaid comparison chart ── */
function ComparisonChart({
  dataA, dataB, colorA, colorB, labelA, labelB, height = 50,
}: {
  dataA: number[]; dataB: number[]; colorA: string; colorB: string
  labelA: string; labelB: string; height?: number
}) {
  const max = Math.max(...dataA, ...dataB, 0.01)
  const W = 220
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
      <div className="flex items-center gap-3 mb-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-[2px] rounded-full" style={{ background: colorA }} />
          <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: colorA }}>{labelA}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-[2px] rounded-full opacity-50" style={{ background: colorB }} />
          <span className="text-[9px] uppercase tracking-wider opacity-50" style={{ color: colorB }}>{labelB}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`cg-${colorA.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorA} stopOpacity="0.15" />
            <stop offset="100%" stopColor={colorA} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillA} fill={`url(#cg-${colorA.replace('#', '')})`} />
        <path d={pathB} fill="none" stroke={colorB} strokeWidth="1.2" strokeDasharray="4 3"
          strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.45} />
        <path d={pathA} fill="none" stroke={colorA} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

/* ── Pressure grid ── */
function PressureGrid({ electrodes, slipDetected }: { electrodes: number[][]; slipDetected: boolean }) {
  return (
    <div className="grid gap-[1.5px]" style={{ gridTemplateColumns: `repeat(${electrodes[0]?.length || 8}, 1fr)` }}>
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
function ScoreRing({ score, color, size = 42 }: { score: number; color: string; size?: number }) {
  const r = size / 2 - 3
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize="11" fontWeight="600" fontFamily="JetBrains Mono, monospace" fill={color}>
        {Math.round(score)}
      </text>
    </svg>
  )
}

/* ── Main dashboard ── */
export default function Dashboard({ state }: { state: SimulationState }) {
  const active = state.activeMode === 'ai' ? state.ai : state.pid
  const aiColor = '#00d4ff'
  const pidColor = '#ff6b35'

  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 pointer-events-auto">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-white/90">TactileAI</h1>
          <p className="text-[9px] text-white/25 font-mono">Robotic Slip Detection</p>
        </div>
        <div className="glass rounded-lg px-3 py-1.5 flex items-center gap-2">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">Time</span>
          <span className="text-sm font-mono text-white/60 tabular-nums">{state.time.toFixed(1)}s</span>
          <div className="w-2 h-2 rounded-full"
            style={{ backgroundColor: '#00ff88', boxShadow: '0 0 6px #00ff88', animation: 'pulse-glow 2s infinite' }} />
        </div>
      </div>

      {/* ── Right panel: comparison ── */}
      <div className="absolute right-4 top-16 bottom-[140px] flex flex-col justify-center pointer-events-auto">
        <div className="glass rounded-xl p-4 animate-slide-up" style={{ width: '260px', animationDelay: '0.3s', opacity: 0 }}>

          <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider block mb-3">
            Controller Comparison
          </span>

          {/* Score row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col items-center">
              <ScoreRing score={state.ai.gripScore} color={aiColor} />
              <span className="text-[8px] uppercase tracking-wider mt-1 font-medium" style={{ color: aiColor }}>AI</span>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-base font-bold font-mono tabular-nums"
                  style={{ color: state.ai.dropCount > state.pid.dropCount ? '#ff3355' : '#e0e4f0' }}>
                  {state.ai.dropCount}
                </div>
                <div className="text-[8px] text-white/25 uppercase">AI drops</div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold font-mono tabular-nums"
                  style={{ color: state.pid.dropCount > state.ai.dropCount ? '#ff3355' : '#e0e4f0' }}>
                  {state.pid.dropCount}
                </div>
                <div className="text-[8px] text-white/25 uppercase">PID drops</div>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing score={state.pid.gripScore} color={pidColor} />
              <span className="text-[8px] uppercase tracking-wider mt-1 font-medium" style={{ color: pidColor }}>PID</span>
            </div>
          </div>

          {/* Charts */}
          <div className="space-y-3">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/25 block mb-1">Grip Force</span>
              <ComparisonChart dataA={state.ai.forceHistory} dataB={state.pid.forceHistory}
                colorA={aiColor} colorB={pidColor} labelA="AI" labelB="PID" />
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-white/25 block mb-1">Slip Magnitude</span>
              <ComparisonChart dataA={state.ai.slipHistory} dataB={state.pid.slipHistory}
                colorA={aiColor} colorB={pidColor} labelA="AI" labelB="PID" height={45} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom-left: BioTac sensor ── */}
      <div className="absolute left-4 bottom-[140px] glass rounded-xl p-3 pointer-events-auto animate-slide-up"
        style={{ width: '155px', animationDelay: '0.5s', opacity: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-medium text-white/40 uppercase tracking-wider">BioTac</span>
          <div className="w-2 h-2 rounded-full" style={{
            backgroundColor: active.objectDropped ? '#ff3355' : active.slipEvent.detected ? '#ffaa00' : '#00ff88',
            boxShadow: `0 0 5px ${active.objectDropped ? '#ff3355' : active.slipEvent.detected ? '#ffaa00' : '#00ff88'}`,
          }} />
        </div>
        <PressureGrid electrodes={active.sensorReading.electrodes} slipDetected={active.slipEvent.detected} />
        <div className="grid grid-cols-3 gap-1 mt-2">
          <div>
            <span className="text-[7px] text-white/20 uppercase">Grip</span>
            <div className="text-xs font-mono font-semibold tabular-nums"
              style={{ color: state.activeMode === 'ai' ? aiColor : pidColor }}>
              {(active.gripForce * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <span className="text-[7px] text-white/20 uppercase">Temp</span>
            <div className="text-xs font-mono text-white/50 tabular-nums">{active.sensorReading.temperature.toFixed(1)}°</div>
          </div>
          <div>
            <span className="text-[7px] text-white/20 uppercase">Imp</span>
            <div className="text-xs font-mono text-white/50 tabular-nums">{active.sensorReading.impedance.toFixed(0)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
