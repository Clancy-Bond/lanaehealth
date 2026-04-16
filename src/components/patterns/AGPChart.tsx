'use client'

/**
 * AGP-Style Chart (Ambulatory Profile)
 *
 * Shows percentile bands (10th/25th/50th/75th/90th) for any daily metric.
 * Originally designed for CGM glucose data, adapted for any vital:
 * heart rate, blood pressure, temperature, HRV.
 *
 * Visual polish:
 * - Full y-axis with tick marks and value labels
 * - Gridlines for readability
 * - Clear percentile label callouts
 * - Uppercase title treatment consistent with other charts
 * - Accessible: role="img" and aria-label describing distribution
 */

interface AGPChartProps {
  title: string
  unit: string
  data: Array<{
    date: string
    value: number
  }>
  targetLow?: number
  targetHigh?: number
  targetLabel?: string
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const frac = idx - lower
  if (lower + 1 >= sorted.length) return sorted[lower]
  return sorted[lower] + frac * (sorted[lower + 1] - sorted[lower])
}

function niceTicks(min: number, max: number, targetCount = 5): number[] {
  const range = max - min
  if (range === 0) return [min]
  const roughStep = range / (targetCount - 1)
  const pow = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const rel = roughStep / pow
  const niceStep = rel < 1.5 ? 1 : rel < 3 ? 2 : rel < 7 ? 5 : 10
  const step = niceStep * pow
  const tickMin = Math.floor(min / step) * step
  const tickMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = tickMin; v <= tickMax + 0.001; v += step) {
    ticks.push(Math.round(v * 100) / 100)
  }
  return ticks
}

export default function AGPChart({ title, unit, data, targetLow, targetHigh, targetLabel }: AGPChartProps) {
  if (data.length < 7) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-[13px] font-semibold uppercase tracking-wide mb-1"
            style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          {title}
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Need at least 7 days of data to generate the profile.
        </p>
      </div>
    )
  }

  const values = data.map(d => d.value).sort((a, b) => a - b)

  const p10 = percentile(values, 10)
  const p25 = percentile(values, 25)
  const p50 = percentile(values, 50)
  const p75 = percentile(values, 75)
  const p90 = percentile(values, 90)
  const dataMin = values[0]
  const dataMax = values[values.length - 1]
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10

  // Establish a padded y-range including target range if defined
  const rawLo = Math.min(dataMin, targetLow ?? dataMin)
  const rawHi = Math.max(dataMax, targetHigh ?? dataMax)
  const padding = (rawHi - rawLo) * 0.1 || 1
  const yMin = Math.floor(rawLo - padding)
  const yMax = Math.ceil(rawHi + padding)
  const range = yMax - yMin || 1
  const ticks = niceTicks(yMin, yMax, 5)

  // Chart dimensions
  const chartHeight = 160
  const leftAxis = 40
  const rightPad = 10
  const chartInnerWidth = 280
  const totalWidth = leftAxis + chartInnerWidth + rightPad
  const bottomAxis = 20
  const totalHeight = chartHeight + bottomAxis

  const toY = (v: number) => chartHeight - ((v - yMin) / range) * chartHeight

  const bandWidth = 90
  const bandX = leftAxis + (chartInnerWidth - bandWidth) / 2

  return (
    <div className="rounded-xl p-4"
         style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            {title}
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {data.length} day distribution ({unit})
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider"
              style={{
                background: 'var(--bg-muted)',
                color: 'var(--text-primary)',
                letterSpacing: '0.05em',
              }}>
          Ambulatory Profile
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3 pb-3"
           style={{ borderBottom: '1px solid var(--border-light)' }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
             style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Median</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--accent-sage)', letterSpacing: '-0.02em' }}>
            {Math.round(p50)}
            <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{unit}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
             style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>IQR (25-75)</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {Math.round(p25)} to {Math.round(p75)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
             style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Range</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {Math.round(p10)} to {Math.round(p90)}
          </p>
        </div>
      </div>

      {/* Percentile band visualization */}
      <div className="overflow-x-auto">
        <svg
          width={totalWidth}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          role="img"
          aria-label={`${title} distribution over ${data.length} days. Median ${Math.round(p50)} ${unit}, range ${Math.round(p10)} to ${Math.round(p90)}.`}
        >
          {/* Y-axis gridlines + tick labels */}
          {ticks.map(tick => (
            <g key={tick}>
              <line
                x1={leftAxis}
                y1={toY(tick)}
                x2={totalWidth - rightPad}
                y2={toY(tick)}
                stroke="var(--border-light)"
                strokeWidth="0.5"
                strokeDasharray="2 3"
                opacity="0.5"
              />
              <text
                x={leftAxis - 6}
                y={toY(tick) + 3}
                fontSize="10"
                fill="var(--text-muted)"
                textAnchor="end"
                fontWeight="500"
                className="tabular-nums"
              >
                {tick}
              </text>
              <line
                x1={leftAxis - 3}
                y1={toY(tick)}
                x2={leftAxis}
                y2={toY(tick)}
                stroke="var(--text-muted)"
                strokeWidth="0.75"
              />
            </g>
          ))}

          {/* Y-axis line */}
          <line
            x1={leftAxis}
            y1={0}
            x2={leftAxis}
            y2={chartHeight}
            stroke="var(--border-light)"
            strokeWidth="1"
          />

          {/* Unit label on y-axis */}
          <text
            x={-chartHeight / 2}
            y={12}
            fontSize="9"
            fill="var(--text-muted)"
            transform="rotate(-90)"
            textAnchor="middle"
            fontWeight="600"
            style={{ letterSpacing: '0.08em' }}
          >
            {unit.toUpperCase()}
          </text>

          {/* Target range background */}
          {targetLow !== undefined && targetHigh !== undefined && (
            <rect
              x={leftAxis}
              y={toY(targetHigh)}
              width={chartInnerWidth}
              height={toY(targetLow) - toY(targetHigh)}
              fill="var(--accent-sage)"
              opacity="0.08"
            />
          )}

          {/* 10th-90th band (lightest) */}
          <rect
            x={bandX}
            y={toY(p90)}
            width={bandWidth}
            height={toY(p10) - toY(p90)}
            rx="6"
            fill="#6B9080"
            opacity="0.18"
          />

          {/* 25th-75th band (medium) */}
          <rect
            x={bandX + 5}
            y={toY(p75)}
            width={bandWidth - 10}
            height={toY(p25) - toY(p75)}
            rx="5"
            fill="#6B9080"
            opacity="0.35"
          />

          {/* Median line */}
          <line
            x1={bandX}
            x2={bandX + bandWidth}
            y1={toY(p50)}
            y2={toY(p50)}
            stroke="#3B6959"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Target range lines */}
          {targetLow !== undefined && (
            <line x1={leftAxis} x2={totalWidth - rightPad} y1={toY(targetLow)} y2={toY(targetLow)}
              stroke="#6B9080" strokeWidth="0.75" strokeDasharray="4,3" opacity="0.6" />
          )}
          {targetHigh !== undefined && (
            <line x1={leftAxis} x2={totalWidth - rightPad} y1={toY(targetHigh)} y2={toY(targetHigh)}
              stroke="#6B9080" strokeWidth="0.75" strokeDasharray="4,3" opacity="0.6" />
          )}

          {/* Percentile callout labels on right */}
          <g>
            <text x={bandX + bandWidth + 6} y={toY(p90) + 3} fontSize="9" fill="var(--text-muted)"
                  fontWeight="500">90th</text>
            <text x={bandX + bandWidth + 6} y={toY(p75) + 3} fontSize="9" fill="var(--text-muted)"
                  fontWeight="500">75th</text>
            <text x={bandX + bandWidth + 6} y={toY(p50) + 3} fontSize="10" fill="#3B6959"
                  fontWeight="700">50th</text>
            <text x={bandX + bandWidth + 6} y={toY(p25) + 3} fontSize="9" fill="var(--text-muted)"
                  fontWeight="500">25th</text>
            <text x={bandX + bandWidth + 6} y={toY(p10) + 3} fontSize="9" fill="var(--text-muted)"
                  fontWeight="500">10th</text>
          </g>

          {/* Percentile value labels on left of band */}
          <g>
            <text x={bandX - 6} y={toY(p90) + 3} fontSize="9" fill="var(--text-primary)"
                  textAnchor="end" fontWeight="500" className="tabular-nums">{Math.round(p90)}</text>
            <text x={bandX - 6} y={toY(p50) + 3} fontSize="10" fill="#3B6959"
                  textAnchor="end" fontWeight="700" className="tabular-nums">{Math.round(p50)}</text>
            <text x={bandX - 6} y={toY(p10) + 3} fontSize="9" fill="var(--text-primary)"
                  textAnchor="end" fontWeight="500" className="tabular-nums">{Math.round(p10)}</text>
          </g>

          {/* X-axis baseline */}
          <line x1={leftAxis} y1={chartHeight} x2={totalWidth - rightPad} y2={chartHeight}
                stroke="var(--border-light)" strokeWidth="1" />

          {/* X-axis label */}
          <text x={leftAxis + chartInnerWidth / 2} y={totalHeight - 4} fontSize="9"
                fill="var(--text-muted)" textAnchor="middle" fontWeight="500"
                style={{ letterSpacing: '0.04em' }}>
            PERCENTILE DISTRIBUTION
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-3 pt-3"
           style={{ borderTop: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: '#3B6959' }} />
          <span className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Median</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: '#6B9080', opacity: 0.35 }} />
          <span className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>50% IQR</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: '#6B9080', opacity: 0.18 }} />
          <span className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>80% range</span>
        </div>
        {targetLabel && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: '#6B9080', opacity: 0.08, border: '1px dashed #6B9080' }} />
            <span className="text-[10px] uppercase font-semibold tracking-wider"
                  style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{targetLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
