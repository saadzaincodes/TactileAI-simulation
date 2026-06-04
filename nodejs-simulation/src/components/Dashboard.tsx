import { useMemo } from 'react'
import { SimulationState } from '../simulation/biotacModel'

function MiniChart({
  data,
  color,
  height = 40,
  warning = false,
}: {
  data: number[]
  color: string
  height?: number
  warning?: boolean
}) {
  const max = Math.max(...data, 0.01)

  const pathD = useMemo(() => {
    const w = 200
    const h = height
    const step = w / (data.length - 1)
    return data
      .map((v, i) => {
        const x = i * step
        const y = h - (v / max) * h * 0.9 - h * 0.05
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [data, max, height])

  const fillD = useMemo(() => {
    return `${pathD} L 200 ${height} L 0 ${height} Z`
  }, [pathD, height])

  return (
    <svg
      viewBox={`0 0 200 ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={fillD}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
      <path
        d={pathD}
        fill="none"
        stroke={warning ? '#ff3355' : color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function PressureGrid({ electrodes, slipDetected }: { electrodes: number[][]; slipDetected: boolean }) {
  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${electrodes[0]?.length || 8}, 1fr)` }}>
      {electrodes.flat().map((val, i) => {
        const hue = slipDetected && val > 0.3 ? 0 : 190 - val * 190
        const sat = 60 + val * 40
        const light = 10 + val * 50
        return (
          <div
            key={i}
            className="sensor-cell rounded-[2px]"
            style={{
              aspectRatio: '1',
              backgroundColor: `hsl(${hue}, ${sat}%, ${light}%)`,
              boxShadow: val > 0.5
                ? `0 0 ${val * 6}px hsla(${hue}, 90%, 50%, 0.5)`
                : 'none',
            }}
          />
        )
      })}
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
  accent = false,
  danger = false,
}: {
  label: string
  value: string
  unit?: string
  accent?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className="text-lg font-semibold font-mono tabular-nums"
          style={{
            color: danger ? '#ff3355' : accent ? '#00d4ff' : '#e0e4f0',
          }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[10px] text-white/30">{unit}</span>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ active, label, color }: { active: boolean; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: active ? color : '#333',
          boxShadow: active ? `0 0 6px ${color}` : 'none',
          animation: active ? 'pulse-glow 1.5s infinite' : 'none',
        }}
      />
      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: active ? color : '#555' }}
      >
        {label}
      </span>
    </div>
  )
}

export default function Dashboard({ state }: { state: SimulationState }) {
  const slipPercent = (state.slipEvent.magnitude * 100).toFixed(1)
  const gripPercent = (state.gripForce * 100).toFixed(0)
  const confidence = (state.aiConfidence * 100).toFixed(0)

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Bottom-right: Main metrics */}
      <div
        className="absolute bottom-4 right-4 glass rounded-xl p-4 pointer-events-auto animate-slide-up"
        style={{ width: '280px', animationDelay: '0.3s', opacity: 0 }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Sensor Telemetry
          </span>
          <div className="flex gap-2">
            <StatusBadge
              active={state.controlMode === 'ai'}
              label="AI"
              color="#00d4ff"
            />
            <StatusBadge
              active={state.slipEvent.detected}
              label="Slip"
              color="#ff3355"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <MetricCard
            label="Grip Force"
            value={gripPercent}
            unit="%"
            accent
          />
          <MetricCard
            label="Slip Risk"
            value={slipPercent}
            unit="%"
            danger={state.slipEvent.detected}
          />
          <MetricCard
            label={state.controlMode === 'ai' ? 'AI Conf.' : 'PID Out'}
            value={state.controlMode === 'ai' ? confidence : gripPercent}
            unit="%"
            accent
          />
        </div>

        {/* Force chart */}
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              Grip Force
            </span>
          </div>
          <MiniChart data={state.forceHistory} color="#00d4ff" />
        </div>

        {/* Slip chart */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              Slip Magnitude
            </span>
          </div>
          <MiniChart
            data={state.slipHistory}
            color="#ff6b35"
            warning={state.slipEvent.detected}
          />
        </div>
      </div>

      {/* Bottom-left: Pressure grid */}
      <div
        className="absolute bottom-4 left-4 glass rounded-xl p-4 pointer-events-auto animate-slide-up"
        style={{ width: '200px', animationDelay: '0.5s', opacity: 0 }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
            BioTac Pressure
          </span>
          <span
            className="text-[10px] font-mono"
            style={{ color: state.slipEvent.detected ? '#ff3355' : '#00d4ff' }}
          >
            {state.sensorReading.pressure.toFixed(2)} kPa
          </span>
        </div>

        <PressureGrid
          electrodes={state.sensorReading.electrodes}
          slipDetected={state.slipEvent.detected}
        />

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="flex flex-col">
            <span className="text-[9px] text-white/25 uppercase">Temp</span>
            <span className="text-xs font-mono text-white/60">
              {state.sensorReading.temperature.toFixed(1)}°C
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-white/25 uppercase">Impedance</span>
            <span className="text-xs font-mono text-white/60">
              {state.sensorReading.impedance.toFixed(0)} Ω
            </span>
          </div>
        </div>
      </div>

      {/* Top-right: Time and status */}
      <div
        className="absolute top-4 right-4 glass rounded-lg px-3 py-2 animate-fade-in"
        style={{ animationDelay: '0.4s', opacity: 0 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-white/30 uppercase tracking-wider">
              Simulation Time
            </span>
            <span className="text-sm font-mono text-white/70 tabular-nums">
              {state.time.toFixed(2)}s
            </span>
          </div>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: '#00ff88',
              boxShadow: '0 0 8px #00ff88',
              animation: 'pulse-glow 2s infinite',
            }}
          />
        </div>
      </div>
    </div>
  )
}
