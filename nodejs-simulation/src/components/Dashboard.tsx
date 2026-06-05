import { useMemo } from 'react'
import { SimulationState } from '../simulation/biotacModel'

/* ── Overlaid comparison chart (two lines) ── */
function ComparisonChart({
  dataA,
  dataB,
  colorA,
  colorB,
  labelA,
  labelB,
  height = 50,
}: {
  dataA: number[]
  dataB: number[]
  colorA: string
  colorB: string
  labelA: string
  labelB: string
  height?: number
}) {
  const max = Math.max(...dataA, ...dataB, 0.01)
  const W = 220

  const makePath = (data: number[]) => {
    const step = W / (data.length - 1)
    return data
      .map((v, i) => {
        const x = i * step
        const y = height - (v / max) * height * 0.85 - height * 0.05
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }

  const pathA = useMemo(() => makePath(dataA), [dataA, max, height])
  const pathB = useMemo(() => makePath(dataB), [dataB, max, height])
  const fillA = useMemo(() => `${pathA} L ${W} ${height} L 0 ${height} Z`, [pathA, height])

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-[2px] rounded-full" style={{ background: colorA }} />
          <span className="text-[8px] uppercase tracking-wider" style={{ color: colorA }}>{labelA}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-[2px] rounded-full opacity-60" style={{ background: colorB, borderStyle: 'dashed' }} />
          <span className="text-[8px] uppercase tracking-wider" style={{ color: colorB, opacity: 0.6 }}>{labelB}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`cg-${colorA.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorA} stopOpacity="0.15" />
            <stop offset="100%" stopColor={colorA} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* AI fill */}
        <path d={fillA} fill={`url(#cg-${colorA.replace('#', '')})`} />
        {/* PID line (dashed) */}
        <path d={pathB} fill="none" stroke={colorB} strokeWidth="1.2" strokeDasharray="4 3"
          strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.5} />
        {/* AI line (solid) */}
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
            boxShadow: val > 0.5 ? `0 0 ${val * 4}px hsla(${hue}, 90%, 50%, 0.4)` : 'none',
          }} />
        )
      })}
    </div>
  )
}

/* ── Score ring ── */
function ScoreRing({ score, color, size = 40 }: { score: number; color: string; size?: number }) {
  const r = size / 2 - 4
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize="10" fontWeight="600" fontFamily="JetBrains Mono, monospace" fill={color}>
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

      {/* ── Right panel: comparison charts + metrics ── */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 glass rounded-xl p-3.5 pointer-events-auto animate-slide-up"
        style={{ width: '260px', animationDelay: '0.3s', opacity: 0 }}>

        {/* Header with mode indicator */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Controller Comparison</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{
              backgroundColor: active.objectDropped ? '#ff3355' : active.slipEvent.detected ? '#ffaa00' : '#00ff88',
              boxShadow: `0 0 6px ${active.objectDropped ? '#ff3355' : active.slipEvent.detected ? '#ffaa00' : '#00ff88'}`,
            }} />
            <span className="text-[9px] text-white/30 uppercase">{state.activeMode === 'ai' ? 'AI' : 'PID'}</span>
          </div>
        </div>

        {/* Score comparison */}
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex flex-col items-center gap-0.5">
            <ScoreRing score={state.ai.gripScore} color={aiColor} />
            <span className="text-[7px] uppercase tracking-wider" style={{ color: aiColor }}>AI</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-xs font-bold font-mono tabular-nums" style={{ color: state.ai.dropCount > state.pid.dropCount ? '#ff3355' : aiColor }}>
                  {state.ai.dropCount}
                </div>
                <div className="text-[7px] text-white/20">drops</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold font-mono tabular-nums" style={{ color: state.pid.dropCount > state.ai.dropCount ? '#ff3355' : pidColor }}>
                  {state.pid.dropCount}
                </div>
                <div className="text-[7px] text-white/20">drops</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <ScoreRing score={state.pid.gripScore} color={pidColor} />
            <span className="text-[7px] uppercase tracking-wider" style={{ color: pidColor }}>PID</span>
          </div>
        </div>

        {/* Grip Force comparison chart */}
        <div className="mb-3">
          <span className="text-[8px] uppercase tracking-wider text-white/25 block mb-1">Grip Force</span>
          <ComparisonChart
            dataA={state.ai.forceHistory} dataB={state.pid.forceHistory}
            colorA={aiColor} colorB={pidColor} labelA="AI" labelB="PID"
          />
        </div>

        {/* Slip comparison chart */}
        <div>
          <span className="text-[8px] uppercase tracking-wider text-white/25 block mb-1">Slip Magnitude</span>
          <ComparisonChart
            dataA={state.ai.slipHistory} dataB={state.pid.slipHistory}
            colorA={aiColor} colorB={pidColor} labelA="AI" labelB="PID"
            height={45}
          />
        </div>
      </div>

      {/* ── Left panel: sensor + active metrics ── */}
      <div className="absolute left-3 bottom-3 glass rounded-xl p-3 pointer-events-auto animate-slide-up"
        style={{ width: '165px', animationDelay: '0.5s', opacity: 0 }}>

        <span className="text-[9px] font-medium text-white/40 uppercase tracking-wider block mb-2">
          BioTac Sensor
        </span>

        <PressureGrid electrodes={active.sensorReading.electrodes} slipDetected={active.slipEvent.detected} />

        <div className="grid grid-cols-3 gap-1 mt-2">
          <div>
            <span className="text-[7px] text-white/20 uppercase">Grip</span>
            <div className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: state.activeMode === 'ai' ? aiColor : pidColor }}>
              {(active.gripForce * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <span className="text-[7px] text-white/20 uppercase">Temp</span>
            <div className="text-[11px] font-mono text-white/50 tabular-nums">
              {active.sensorReading.temperature.toFixed(1)}°
            </div>
          </div>
          <div>
            <span className="text-[7px] text-white/20 uppercase">Imp.</span>
            <div className="text-[11px] font-mono text-white/50 tabular-nums">
              {active.sensorReading.impedance.toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top right: time ── */}
      <div className="absolute top-3 right-3 glass rounded-lg px-2.5 py-1.5 animate-fade-in"
        style={{ animationDelay: '0.3s', opacity: 0 }}>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/25 uppercase tracking-wider">Time</span>
          <span className="text-xs font-mono text-white/60 tabular-nums">{state.time.toFixed(1)}s</span>
          <div className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: '#00ff88', boxShadow: '0 0 6px #00ff88', animation: 'pulse-glow 2s infinite' }} />
        </div>
      </div>
    </div>
  )
}
