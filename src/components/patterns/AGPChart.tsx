'use client'

/**
 * AGP-Style Chart (Ambulatory Profile)
 *
 * Shows percentile bands (10th/25th/50th/75th/90th) for any daily metric.
 * Originally designed for CGM glucose data, adapted for any vital:
 * heart rate, blood pressure, temperature, HRV.
 *
 * Displays a "typical day" pattern based on historical data.
 */

interface AGPChartProps {
  title: string
  unit: string
  data: Array<{
    date: string
    value: number
  }>
  targetLow?: number    // Target range lower bound
  targetHigh?: number   // Target range upper bound
  targetLabel?: string  // e.g., "Target Range"
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const frac = idx - lower
  if (lower + 1 >= sorted.length) return sorted[lower]
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower])
}

export default function AGPChart({ title, unit, data, targetLow, targetHigh, targetLabel }: AGPChartProps) {
  if (data.length < 7) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Need at least 7 days of data to generate the profile.
        </p>
      </div>
    )
  }

  // Sort values for percentile calculation
  const values = data.map(d => d.value).sort((a, b) => a - b)

  const p10 = percentile(values, 10)
  const p25 = percentile(values, 25)
  const p50 = percentile(values, 50)
  const p75 = percentile(values, 75)
  const p90 = percentile(values, 90)
  const min = values[0]
  const max = values[values.length - 1]
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10

  // Chart dimensions
  const chartHeight = 120
  const chartWidth = 280
  const range = max - min || 1
  const toY = (v: number) => chartHeight - ((v - min) / range) * chartHeight

  // Bars for percentile bands
  const bandWidth = 60

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {data.length} days
        </span>
      </div>

      {/* Stats row */}
      <div className="flex justify-between mb-3 px-2">
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: 'var(--accent-sage)' }}>{avg}</p>
          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Median: {Math.round(p50)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {Math.round(p25)}-{Math.round(p75)}
          </p>
          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>25th-75th {unit}</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {Math.round(p10)}-{Math.round(p90)}
          </p>
          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>10th-90th {unit}</p>
        </div>
      </div>

      {/* Percentile band visualization */}
      <div className="flex justify-center">
        <svg width={chartWidth} height={chartHeight + 20} viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}>
          {/* Target range background */}
          {targetLow !== undefined && targetHigh !== undefined && (
            <rect
              x={0}
              y={toY(targetHigh)}
              width={chartWidth}
              height={toY(targetLow) - toY(targetHigh)}
              fill="var(--accent-sage)"
              opacity="0.08"
            />
          )}

          {/* 10th-90th band (lightest) */}
          <rect
            x={(chartWidth - bandWidth) / 2}
            y={toY(p90)}
            width={bandWidth}
            height={toY(p10) - toY(p90)}
            rx="4"
            fill="var(--accent-sage)"
            opacity="0.15"
          />

          {/* 25th-75th band (medium) */}
          <rect
            x={(chartWidth - bandWidth) / 2}
            y={toY(p75)}
            width={bandWidth}
            height={toY(p25) - toY(p75)}
            rx="4"
            fill="var(--accent-sage)"
            opacity="0.3"
          />

          {/* Median line */}
          <line
            x1={(chartWidth - bandWidth) / 2}
            x2={(chartWidth + bandWidth) / 2}
            y1={toY(p50)}
            y2={toY(p50)}
            stroke="var(--accent-sage)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Target range lines */}
          {targetLow !== undefined && (
            <line x1="20" x2={chartWidth - 20} y1={toY(targetLow)} y2={toY(targetLow)}
              stroke="var(--accent-sage)" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.4" />
          )}
          {targetHigh !== undefined && (
            <line x1="20" x2={chartWidth - 20} y1={toY(targetHigh)} y2={toY(targetHigh)}
              stroke="var(--accent-sage)" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.4" />
          )}

          {/* Labels */}
          <text x="5" y={toY(p90) + 4} fontSize="9" fill="var(--text-muted)">{Math.round(p90)}</text>
          <text x="5" y={toY(p50) + 4} fontSize="9" fill="var(--accent-sage)" fontWeight="600">{Math.round(p50)}</text>
          <text x="5" y={toY(p10) + 4} fontSize="9" fill="var(--text-muted)">{Math.round(p10)}</text>

          <text x={chartWidth - 5} y={toY(p75) + 4} fontSize="9" fill="var(--text-muted)" textAnchor="end">75th</text>
          <text x={chartWidth - 5} y={toY(p25) + 4} fontSize="9" fill="var(--text-muted)" textAnchor="end">25th</text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-4 h-1 rounded" style={{ background: 'var(--accent-sage)' }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Median</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: 'var(--accent-sage)', opacity: 0.3 }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>25th-75th</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: 'var(--accent-sage)', opacity: 0.15 }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>10th-90th</span>
        </div>
        {targetLabel && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: 'var(--accent-sage)', opacity: 0.08 }} />
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{targetLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
