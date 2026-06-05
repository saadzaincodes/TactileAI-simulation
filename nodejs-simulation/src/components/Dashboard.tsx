import { useMemo } from 'react'
import { SimulationState, ArmState } from '../simulation/biotacModel'

function MiniChart({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data, 0.01)
  const pathD = useMemo(() => {
    const w = 160
    const step = w / (data.length - 1)
    return data
      .map((v, i) => {
        const x = i * step
        const y = height - (v / max) * height * 0.85 - height * 0.05
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [data, max, height])

  return (
    <svg viewBox={`0 0 160 ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L 160 ${height} L 0 ${height} Z`} fill={`url(#g-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function ScoreRing({ score, color, label }: { score: number; color: string; label: string }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={radius} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text x="22" y="24" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="JetBrains Mono, monospace" fill={color}>
          {Math.round(score)}
        </text>
      </svg>
      <span className="text-[8px] uppercase tracking-wider text-white/30">{label}</span>
    </div>
  )
}

function ArmPanel({
  arm,
  label,
  color,
  side,
}: {
  arm: ArmState
  label: string
  color: string
  side: 'left' | 'right'
}) {
  const gripPercent = (arm.gripForce * 100).toFixed(0)
  const slipPercent = (arm.slipEvent.magnitude * 100).toFixed(1)

  return (
    <div
      className={`absolute ${side === 'left' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 glass rounded-xl p-3 pointer-events-auto animate-slide-up`}
      style={{ width: '195px', animationDelay: side === 'left' ? '0.3s' : '0.5s', opacity: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: arm.objectDropped ? '#ff3355' : arm.slipEvent.detected ? '#ffaa00' : '#00ff88',
              boxShadow: `0 0 6px ${arm.objectDropped ? '#ff3355' : arm.slipEvent.detected ? '#ffaa00' : '#00ff88'}`,
            }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
            {label}
          </span>
        </div>
        {arm.objectDropped && (
          <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
            Dropped
          </span>
        )}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <span className="text-[8px] uppercase tracking-wider text-white/25">Grip</span>
          <div className="text-sm font-semibold font-mono tabular-nums" style={{ color }}>
            {gripPercent}<span className="text-[9px] text-white/30">%</span>
          </div>
        </div>
        <div>
          <span className="text-[8px] uppercase tracking-wider text-white/25">Slip</span>
          <div className="text-sm font-semibold font-mono tabular-nums" style={{ color: arm.slipEvent.detected ? '#ff3355' : '#e0e4f0' }}>
            {slipPercent}<span className="text-[9px] text-white/30">%</span>
          </div>
        </div>
      </div>

      {/* Score + Drops */}
      <div className="flex items-center justify-between mb-2">
        <ScoreRing score={arm.gripScore} color={color} label="Score" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold font-mono tabular-nums" style={{ color: arm.dropCount > 0 ? '#ff3355' : '#e0e4f0' }}>
            {arm.dropCount}
          </span>
          <span className="text-[8px] uppercase tracking-wider text-white/25">Drops</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold font-mono tabular-nums text-white/60">
            {arm.holdTime.toFixed(0)}<span className="text-[9px] text-white/25">s</span>
          </span>
          <span className="text-[8px] uppercase tracking-wider text-white/25">Held</span>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-1.5">
        <div>
          <span className="text-[8px] uppercase tracking-wider text-white/20">Grip Force</span>
          <MiniChart data={arm.forceHistory} color={color} />
        </div>
        <div>
          <span className="text-[8px] uppercase tracking-wider text-white/20">Slip</span>
          <MiniChart data={arm.slipHistory} color={arm.slipEvent.detected ? '#ff3355' : '#ff6b35'} />
        </div>
      </div>
    </div>
  )
}

function PressureGrid({ electrodes, slipDetected }: { electrodes: number[][]; slipDetected: boolean }) {
  return (
    <div className="grid gap-[1.5px]" style={{ gridTemplateColumns: `repeat(${electrodes[0]?.length || 8}, 1fr)` }}>
      {electrodes.flat().map((val, i) => {
        const hue = slipDetected && val > 0.3 ? 0 : 190 - val * 190
        const sat = 60 + val * 40
        const light = 10 + val * 50
        return (
          <div
            key={i}
            className="sensor-cell rounded-[1px]"
            style={{
              aspectRatio: '1',
              backgroundColor: `hsl(${hue}, ${sat}%, ${light}%)`,
              boxShadow: val > 0.5 ? `0 0 ${val * 4}px hsla(${hue}, 90%, 50%, 0.4)` : 'none',
            }}
          />
        )
      })}
    </div>
  )
}

export default function Dashboard({ state }: { state: SimulationState }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Left panel — AI */}
      <ArmPanel arm={state.ai} label="AI Controller" color="#00d4ff" side="left" />

      {/* Right panel — PID */}
      <ArmPanel arm={state.pid} label="Traditional PID" color="#ff6b35" side="right" />

      {/* Top-right: time + pressure grids */}
      <div
        className="absolute top-3 right-3 glass rounded-lg px-3 py-2 animate-fade-in"
        style={{ animationDelay: '0.3s', opacity: 0 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">Time</span>
          <span className="text-xs font-mono text-white/60 tabular-nums">{state.time.toFixed(1)}s</span>
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: '#00ff88', boxShadow: '0 0 6px #00ff88', animation: 'pulse-glow 2s infinite' }}
          />
        </div>
      </div>

      {/* Pressure comparison (small, top corners) */}
      <div className="absolute top-12 left-3 glass-light rounded-lg p-2 animate-fade-in" style={{ width: '90px', animationDelay: '0.6s', opacity: 0 }}>
        <span className="text-[7px] uppercase tracking-wider text-white/25 block mb-1">AI Pressure</span>
        <PressureGrid electrodes={state.ai.sensorReading.electrodes} slipDetected={state.ai.slipEvent.detected} />
      </div>
      <div className="absolute top-12 right-3 glass-light rounded-lg p-2 animate-fade-in" style={{ width: '90px', animationDelay: '0.7s', opacity: 0 }}>
        <span className="text-[7px] uppercase tracking-wider text-white/25 block mb-1">PID Pressure</span>
        <PressureGrid electrodes={state.pid.sensorReading.electrodes} slipDetected={state.pid.slipEvent.detected} />
      </div>
    </div>
  )
}
