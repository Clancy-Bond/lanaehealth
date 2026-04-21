'use client'

/*
 * HormoneSparkline
 *
 * Tiny line chart of numeric hormone values over time for one
 * HormoneId. Rendered inside a HormonePanelCard in a grid, so we draw
 * a compact 64pt chart without axes or grid noise : just the line and
 * a terse tooltip.
 *
 * Mirrors the LabSparkline pattern exactly (see
 * src/app/v2/labs/_components/LabSparkline.tsx) including the
 * ResizeObserver-driven width state instead of ResponsiveContainer.
 * ResponsiveContainer silently renders at 0x0 when its parent has
 * only a min-height during SSR hydration on mobile : the same trap
 * CycleLengthChart hit.
 *
 * Hormone ranges are phase-dependent and hormone-specific (follicular
 * estrogen behaves very differently from luteal), so we deliberately
 * skip reference-range bands here. The typicalRange string is shown
 * as card subtext instead.
 */
import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import { format, parseISO } from 'date-fns'
import type { HormoneEntry } from '@/lib/cycle/hormones'

// Recharts writes these into SVG stroke/fill presentation attributes,
// where CSS custom properties are not resolved reliably. Use literal
// hex to match the v2 dark tokens and keep the chart visible.
const CHART_COLORS = {
  line: '#4DB8A8',        // --v2-accent-primary
  axis: '#7E8088',        // --v2-text-muted
  tooltipBg: '#17171B',   // --v2-bg-card
  tooltipBorder: 'rgba(255, 255, 255, 0.10)',
  tooltipText: '#F2F2F4', // --v2-text-primary
} as const

export interface HormoneSparklineProps {
  /** Entries for a single hormone. Will be re-sorted ascending by date internally. */
  entries: HormoneEntry[]
  /** Shared unit suffix for the tooltip value. */
  unit: string | null
}

interface Point {
  date: string
  label: string
  value: number
}

export default function HormoneSparkline({ entries, unit }: HormoneSparklineProps) {
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

  // Plot oldest to newest so the line reads left to right as "over
  // time". All hormone entries already carry a numeric value per the
  // loader's sanitize, so no null filtering is needed.
  const data: Point[] = entries
    .map((e) => ({
      date: e.date,
      label: format(parseISO(e.date + 'T00:00:00'), 'MMM d, yy'),
      value: e.value,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (data.length < 2) return null

  // Pad the y-axis a little so the line never kisses the top/bottom.
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(0.5, (max - min) * 0.1)

  const chartHeight = 64

  return (
    <div ref={ref} style={{ width: '100%', height: chartHeight }}>
      {width > 0 && (
        <LineChart
          data={data}
          width={width}
          height={chartHeight}
          margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
        >
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[min - pad, max + pad]} width={0} />
          <Tooltip
            contentStyle={{
              background: CHART_COLORS.tooltipBg,
              border: `1px solid ${CHART_COLORS.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
              color: CHART_COLORS.tooltipText,
              padding: '6px 8px',
            }}
            labelStyle={{ color: CHART_COLORS.axis, fontSize: 11 }}
            itemStyle={{ color: CHART_COLORS.tooltipText }}
            formatter={(v) => {
              const val = typeof v === 'number' ? v : String(v ?? '')
              return [unit ? `${val} ${unit}` : `${val}`, 'Value']
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.line}
            strokeWidth={1.75}
            dot={{ r: 2, fill: CHART_COLORS.line }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </div>
  )
}
