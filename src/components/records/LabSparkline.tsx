'use client'

/**
 * LabSparkline: tiny Recharts-based trend line with reference-range
 * shading. Intentionally minimal (no axis, no tooltip by default) so it
 * fits inside an inline lab row; a taller variant shows axes.
 *
 * Per CLAUDE.md rule 16 and the Wave 2 Recharts SSR fix: we measure the
 * parent width explicitly with useRef + useEffect instead of using
 * ResponsiveContainer, which produces zero width during SSR/hydration on
 * Vercel and never re-renders. Hydration-safe markup is emitted on the
 * server (a placeholder div); the chart only draws after client measure.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer as _Unused,
  XAxis,
  YAxis,
} from 'recharts'

void _Unused // keep tree-shake optimistic; not actually used

export interface SparklinePoint {
  /** ISO date. Used for ordering; not rendered in compact mode. */
  date: string
  /** Numeric value. */
  value: number
}

export interface LabSparklineProps {
  data: SparklinePoint[]
  refLow: number | null
  refHigh: number | null
  /** Pixel height; width is auto-measured. */
  height?: number
  /** Show X/Y axes and tick labels. */
  showAxes?: boolean
  /** Stroke color; defaults to --accent-sage. */
  strokeColor?: string
  /** Shading color for in-range band; defaults to a soft sage. */
  bandColor?: string
  /** Optional accessible label. */
  ariaLabel?: string
}

const DEFAULT_STROKE = 'var(--accent-sage)'
const DEFAULT_BAND = 'rgba(107, 144, 128, 0.10)'

export function LabSparkline({
  data,
  refLow,
  refHigh,
  height = 36,
  showAxes = false,
  strokeColor = DEFAULT_STROKE,
  bandColor = DEFAULT_BAND,
  ariaLabel,
}: LabSparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    // Observe width changes too so collapsing/expanding parents redraw.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Sort ascending by date so the line flows left→right.
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))

  // Compute y-domain including reference bounds so the band is visible
  // even when all values are in-range.
  const values = sorted.map((p) => p.value).filter((v) => Number.isFinite(v))
  const candidates: number[] = [...values]
  if (refLow !== null) candidates.push(refLow)
  if (refHigh !== null) candidates.push(refHigh)
  const minV = candidates.length ? Math.min(...candidates) : 0
  const maxV = candidates.length ? Math.max(...candidates) : 1
  const pad = (maxV - minV) * 0.1 || 1
  const yDomain: [number, number] = [minV - pad, maxV + pad]

  const chartData = sorted.map((p) => ({ date: p.date, value: p.value }))
  const hasBand = refLow !== null && refHigh !== null
  const margin = showAxes
    ? { top: 4, right: 8, bottom: 0, left: -20 }
    : { top: 2, right: 2, bottom: 2, left: 2 }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel ?? 'Lab value trend sparkline'}
      style={{ width: '100%', height }}
    >
      {width > 0 && chartData.length >= 1 && (
        <LineChart width={width} height={height} data={chartData} margin={margin}>
          <XAxis
            dataKey="date"
            hide={!showAxes}
            tick={showAxes ? { fontSize: 10, fill: 'var(--text-muted)' } : false}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={yDomain}
            hide={!showAxes}
            tick={showAxes ? { fontSize: 10, fill: 'var(--text-muted)' } : false}
            axisLine={false}
            tickLine={false}
          />
          {hasBand && (
            <ReferenceArea
              y1={refLow as number}
              y2={refHigh as number}
              fill={bandColor}
              fillOpacity={1}
              stroke="none"
              ifOverflow="extendDomain"
            />
          )}
          {refLow !== null && !hasBand && (
            <ReferenceLine
              y={refLow}
              stroke="var(--text-muted)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}
          {refHigh !== null && !hasBand && (
            <ReferenceLine
              y={refHigh}
              stroke="var(--text-muted)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={showAxes ? 2 : 1.5}
            dot={showAxes ? { fill: strokeColor, r: 3 } : false}
            activeDot={showAxes ? { r: 4 } : false}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </div>
  )
}
