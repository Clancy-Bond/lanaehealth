'use client'

/**
 * Line chart of completed cycle lengths.
 *
 * Recharts. Each point is a completed cycle's length in days, plotted by
 * start date. Reference lines at 21d and 35d mark the ACOG normal range.
 * This is diagnostic, not gamified - no "goals" or "targets" shown.
 *
 * Uses a ResizeObserver-driven width state instead of ResponsiveContainer
 * because ResponsiveContainer silently renders at 0x0 when its parent has
 * only a min-height (not a fixed one) during SSR hydration on mobile.
 */
import { useEffect, useRef, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { Cycle } from '@/lib/cycle/cycle-stats'

// Recharts writes these into SVG stroke/fill presentation attributes, where
// CSS custom properties are not resolved reliably. Use literal hex to match
// warm-modern tokens (globals.css) and keep the chart visible.
const CHART_COLORS = {
  cycleLine: '#E8506A',
  mean: '#6B9080',
  acog: '#E8A849',
  grid: '#F0F0EA',
  axis: '#8B8F96',
  tooltipBg: '#FFFFFF',
  tooltipBorder: '#E5E5DC',
  tooltipText: '#1A1A2E',
} as const

export interface CycleLengthChartProps {
  cycles: Cycle[]
  meanCycleLength: number | null
}

export function CycleLengthChart({ cycles, meanCycleLength }: CycleLengthChartProps) {
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

  const data = cycles
    .filter((c) => c.lengthDays != null)
    .map((c) => ({
      date: c.startDate,
      label: format(parseISO(c.startDate), 'MMM yy'),
      length: c.lengthDays as number,
    }))

  if (data.length < 2) {
    return (
      <div
        style={{
          padding: '24px 18px',
          color: 'var(--text-muted)',
          fontSize: 13,
          lineHeight: 1.5,
          background: 'var(--bg-elevated)',
          borderRadius: 12,
          textAlign: 'center',
        }}
      >
        Chart appears once you have at least two completed cycles.
      </div>
    )
  }

  const chartHeight = 240

  return (
    <div>
      <div ref={ref} style={{ width: '100%', height: chartHeight }}>
        {width > 0 && (
        <LineChart
          data={data}
          width={width}
          height={chartHeight}
          margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
        >
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            fontSize={10}
            tickMargin={6}
            interval={Math.max(0, Math.floor(data.length / 8))}
            stroke={CHART_COLORS.axis}
          />
          <YAxis
            fontSize={10}
            tickMargin={4}
            stroke={CHART_COLORS.axis}
            domain={['auto', 'auto']}
            width={28}
            label={{ value: 'days', position: 'insideLeft', angle: -90, offset: 12, style: { fontSize: 10, fill: CHART_COLORS.axis } }}
          />
          <ReferenceLine y={21} stroke={CHART_COLORS.acog} strokeDasharray="4 2" />
          <ReferenceLine y={35} stroke={CHART_COLORS.acog} strokeDasharray="4 2" />
          {meanCycleLength != null && (
            <ReferenceLine y={meanCycleLength} stroke={CHART_COLORS.mean} strokeDasharray="1 3" />
          )}
          <Tooltip
            contentStyle={{
              background: CHART_COLORS.tooltipBg,
              border: `1px solid ${CHART_COLORS.tooltipBorder}`,
              borderRadius: 10,
              fontSize: 12,
              color: CHART_COLORS.tooltipText,
            }}
            formatter={(v) => [`${v}d`, 'Cycle length']}
            labelFormatter={(l) => `Starting ${l}`}
          />
          <Line
            type="monotone"
            dataKey="length"
            stroke={CHART_COLORS.cycleLine}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS.cycleLine }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
        )}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          color: 'var(--text-muted)',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <LegendDot color={CHART_COLORS.cycleLine} label="Cycle length" />
        <LegendDot color={CHART_COLORS.mean} label="Your mean" dash />
        <LegendDot color={CHART_COLORS.acog} label="ACOG 21-35d" dash />
      </div>
    </div>
  )
}

function LegendDot({ color, label, dash }: { color: string; label: string; dash?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        aria-hidden
        style={{
          width: 14,
          height: 2,
          background: dash ? 'transparent' : color,
          borderTop: dash ? `2px dashed ${color}` : undefined,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  )
}

