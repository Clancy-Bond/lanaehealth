'use client'

/*
 * LabSparkline
 *
 * Tiny line chart of numeric lab values over time for one test_name.
 * Rendered inside a LabTestGroup card, so we draw a compact 80pt chart
 * without axes or grid noise : just the line, optional reference range
 * bands as dashed ReferenceLines, and a terse tooltip.
 *
 * Uses a ResizeObserver-driven width state (not ResponsiveContainer)
 * because ResponsiveContainer silently renders at 0x0 when its parent
 * has only a min-height during SSR hydration on mobile : the same
 * trap CycleLengthChart hit. See
 * src/components/cycle/CycleLengthChart.tsx for the canonical pattern.
 */
import { useEffect, useRef, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { LabResult } from '@/lib/types'

// Recharts writes these into SVG stroke/fill presentation attributes,
// where CSS custom properties are not resolved reliably. Use literal
// hex to match the v2 dark tokens and keep the chart visible. Warning
// hue here matches --v2-accent-warning for the reference-range bands.
const CHART_COLORS = {
  line: '#4DB8A8',         // --v2-accent-primary
  warning: '#D9775C',      // --v2-accent-warning
  axis: '#7E8088',         // --v2-text-muted
  tooltipBg: '#17171B',    // --v2-bg-card
  tooltipBorder: 'rgba(255, 255, 255, 0.10)',
  tooltipText: '#F2F2F4',  // --v2-text-primary
} as const

export interface LabSparklineProps {
  /** Entries for a single test_name, newest-first or oldest-first.
   * Will be re-sorted ascending by date internally. */
  entries: LabResult[]
  /** Shared unit suffix for the tooltip value. */
  unit: string | null
}

interface Point {
  date: string
  label: string
  value: number
}

export default function LabSparkline({ entries, unit }: LabSparklineProps) {
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

  // Only plot numeric rows, oldest to newest so the line reads left to
  // right as "over time". Dropping null values keeps the path from
  // flatlining through missing readings.
  const data: Point[] = entries
    .filter((e): e is LabResult & { value: number } => e.value !== null)
    .map((e) => ({
      date: e.date,
      label: format(parseISO(e.date + 'T00:00:00'), 'MMM d, yy'),
      value: e.value,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (data.length < 2) return null

  // Pull the first non-null reference range from any entry. Not every
  // row carries a range, but when one does we can overlay it on the
  // whole series as a read of "is this in range".
  const refLow = entries.find((e) => e.reference_range_low !== null)?.reference_range_low ?? null
  const refHigh = entries.find((e) => e.reference_range_high !== null)?.reference_range_high ?? null

  // Pad the y-axis a little so the line never kisses the top/bottom.
  const values = data.map((d) => d.value)
  const allNumbers: number[] = [...values]
  if (refLow !== null) allNumbers.push(refLow)
  if (refHigh !== null) allNumbers.push(refHigh)
  const min = Math.min(...allNumbers)
  const max = Math.max(...allNumbers)
  const pad = Math.max(0.5, (max - min) * 0.1)

  const chartHeight = 80

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
          <YAxis
            hide
            domain={[min - pad, max + pad]}
            width={0}
          />
          {refLow !== null && (
            <ReferenceLine
              y={refLow}
              stroke={CHART_COLORS.warning}
              strokeDasharray="4 2"
              strokeOpacity={0.6}
            />
          )}
          {refHigh !== null && (
            <ReferenceLine
              y={refHigh}
              stroke={CHART_COLORS.warning}
              strokeDasharray="4 2"
              strokeOpacity={0.6}
            />
          )}
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
