'use client'

/*
 * HealthSparkline
 *
 * Shared trend line for the light health sub-trackers (BP, HR). Single
 * or multi-series; literal hex colors per recharts' SVG attribute
 * handling; ResizeObserver-driven width state instead of
 * ResponsiveContainer (ResponsiveContainer silently renders at 0x0
 * during SSR hydration on mobile when its parent has only a min-height,
 * same trap OrthostaticTrendSparkline and CycleLengthChart documented).
 *
 * Y-axis:
 *   - Fixed numeric tuple: use as the hard domain.
 *   - Omitted: auto-domain with a caller-supplied pad (default 5 units)
 *     so the line never kisses the edge.
 *
 * X-axis is deliberately label-only, no ticks, because both BP and HR
 * render 30-point windows where each point's exact date doesn't carry
 * meaning at this zoom. The date lives in the tooltip.
 *
 * Session 05 weekly-tail scope only. See ./README.md.
 */
import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

export interface HealthSparklineSeries {
  /** Data key on each point object (e.g. 'systolic', 'bpm'). */
  key: string
  /** Line color. Literal hex : recharts writes this to SVG attributes. */
  color: string
  /** Tooltip label for this series (e.g. 'Systolic', 'bpm'). */
  label: string
}

export interface HealthSparklinePoint {
  /** Used only for keying + tooltip label. */
  date: string
  /** Human-readable label shown in the tooltip header. */
  label: string
  /** Series data keyed by series.key. */
  [key: string]: string | number
}

export interface HealthSparklineProps {
  /** Points, oldest-first. */
  data: HealthSparklinePoint[]
  /** One entry per line. 1-2 lines supported in Session 05 scope. */
  series: HealthSparklineSeries[]
  /** Hard y-domain (e.g. [50, 200] for BP). Omit to auto-pad. */
  yDomain?: [number, number]
  /** Auto-domain pad if yDomain omitted. Default 5. */
  autoPad?: number
  /** Tooltip value suffix (e.g. 'mmHg', 'bpm'). */
  unit?: string
  /** Chart height in px. Default 120. */
  height?: number
}

// Tooltip chrome shared across both trackers.
const TOOLTIP_BG = '#17171B'        // --v2-bg-card
const TOOLTIP_BORDER = 'rgba(255, 255, 255, 0.10)'
const TOOLTIP_TEXT = '#F2F2F4'      // --v2-text-primary
const AXIS = '#7E8088'              // --v2-text-muted

export default function HealthSparkline({
  data,
  series,
  yDomain,
  autoPad = 5,
  unit,
  height = 120,
}: HealthSparklineProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    const node = ref.current
    const measure = () => setWidth(node.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  if (data.length === 0) return null

  // Compute auto-domain only when no hard domain is provided.
  let domain: [number, number] = yDomain ?? [0, 0]
  if (!yDomain) {
    const values: number[] = []
    for (const p of data) {
      for (const s of series) {
        const v = p[s.key]
        if (typeof v === 'number' && Number.isFinite(v)) values.push(v)
      }
    }
    if (values.length > 0) {
      const min = Math.min(...values)
      const max = Math.max(...values)
      domain = [min - autoPad, max + autoPad]
    }
  }

  return (
    <div ref={ref} style={{ width: '100%', height }}>
      {width > 0 && (
        <LineChart
          data={data}
          width={width}
          height={height}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
        >
          <XAxis dataKey="label" hide />
          <YAxis
            stroke={AXIS}
            fontSize={10}
            tickMargin={4}
            domain={domain}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: TOOLTIP_BG,
              border: `1px solid ${TOOLTIP_BORDER}`,
              borderRadius: 8,
              fontSize: 12,
              color: TOOLTIP_TEXT,
              padding: '6px 8px',
            }}
            labelStyle={{ color: AXIS, fontSize: 11 }}
            itemStyle={{ color: TOOLTIP_TEXT }}
            formatter={(v, name) => {
              const val = typeof v === 'number' ? v : String(v ?? '')
              const s = series.find((x) => x.key === name)
              const label = s ? s.label : String(name)
              return [unit ? `${val} ${unit}` : `${val}`, label]
            }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={1.75}
              dot={{ r: 2.5, fill: s.color }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      )}
    </div>
  )
}
