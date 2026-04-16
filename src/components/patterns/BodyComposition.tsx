'use client'

/**
 * Body Composition Trend Display
 *
 * Shows weight with smoothed trend line (7-day moving average)
 * plus body fat %, muscle mass when available.
 * Filters daily fluctuations to show the real trend.
 */

interface BodyCompDay {
  date: string
  weight: number | null          // kg
  bodyFat: number | null         // %
  muscleMass: number | null      // kg
}

interface BodyCompositionProps {
  data: BodyCompDay[]
}

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = values.slice(start, i + 1).filter((v): v is number => v !== null)
    return slice.length > 0 ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length * 10) / 10 : null
  })
}

export default function BodyComposition({ data }: BodyCompositionProps) {
  if (data.length < 3) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Body Composition
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Log weight via Withings, a smart scale, or manually. Need 3+ readings to show trends.
        </p>
      </div>
    )
  }

  const weights = data.map(d => d.weight)
  const smoothed = movingAverage(weights, 7)
  const latest = data[data.length - 1]
  const latestSmoothed = smoothed[smoothed.length - 1]
  const firstSmoothed = smoothed.find(v => v !== null)

  const change = latestSmoothed != null && firstSmoothed != null
    ? Math.round((latestSmoothed - firstSmoothed) * 10) / 10
    : null

  // SVG trend line
  const chartWidth = 280
  const chartHeight = 60
  const validWeights = weights.filter((w): w is number => w !== null)
  const min = Math.min(...validWeights) - 1
  const max = Math.max(...validWeights) + 1
  const range = max - min || 1

  const rawPoints = weights.map((w, i) => {
    if (w === null) return null
    const x = (i / (weights.length - 1)) * chartWidth
    const y = chartHeight - ((w - min) / range) * chartHeight
    return { x, y }
  }).filter(Boolean) as { x: number; y: number }[]

  const smoothPoints = smoothed.map((w, i) => {
    if (w === null) return null
    const x = (i / (smoothed.length - 1)) * chartWidth
    const y = chartHeight - ((w - min) / range) * chartHeight
    return { x, y }
  }).filter(Boolean) as { x: number; y: number }[]

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Body Composition
        </h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {data.length} readings
        </span>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 mb-3">
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {latestSmoothed ?? '--'} kg
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            trend weight
          </p>
        </div>
        {change !== null && (
          <div>
            <p className="text-sm font-semibold" style={{
              color: change > 0 ? '#E65100' : change < 0 ? 'var(--accent-sage)' : 'var(--text-muted)',
            }}>
              {change > 0 ? '+' : ''}{change} kg
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              since first reading
            </p>
          </div>
        )}
        {latest?.bodyFat !== null && latest?.bodyFat !== undefined && (
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {latest.bodyFat}%
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              body fat
            </p>
          </div>
        )}
        {latest?.muscleMass !== null && latest?.muscleMass !== undefined && (
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {latest.muscleMass} kg
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              muscle
            </p>
          </div>
        )}
      </div>

      {/* Trend chart */}
      <svg width={chartWidth} height={chartHeight + 10} viewBox={`0 0 ${chartWidth} ${chartHeight + 10}`}>
        {/* Raw data points (lighter) */}
        {rawPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill="var(--border-light)" />
        ))}

        {/* Smoothed trend line (bold) */}
        {smoothPoints.length > 1 && (
          <path
            d={smoothPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--accent-sage)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>

      <div className="flex justify-between mt-1">
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          {data[0]?.date}
        </span>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          {data[data.length - 1]?.date}
        </span>
      </div>

      <p className="text-[10px] text-center mt-2" style={{ color: 'var(--text-muted)' }}>
        Trend line smooths daily fluctuations (7-day moving average)
      </p>
    </div>
  )
}
