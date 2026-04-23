'use client'

/*
 * OrthostaticTrendSparkline
 *
 * Line chart of peak_rise_bpm over test_date. Reference lines mark the
 * 30-bpm positive threshold and the 20-bpm borderline boundary so the
 * trend reads at a glance without a separate legend.
 *
 * Uses a ResizeObserver-driven width state (not ResponsiveContainer)
 * because ResponsiveContainer silently renders at 0x0 when its parent
 * has only a min-height during SSR hydration on mobile : the same trap
 * CycleLengthChart documented. See src/components/cycle/CycleLengthChart.tsx
 * for the canonical pattern.
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
import { Card } from '@/v2/components/primitives'
import type { ClassifiedTest } from '@/lib/intelligence/orthostatic'

// Recharts writes these into SVG stroke/fill presentation attributes,
// where CSS custom properties are not resolved reliably. Literal hex
// mirrors the v2 dark tokens (tokens.css) so the chart stays visible.
const CHART_COLORS = {
  line: '#4DB8A8',         // --v2-accent-primary
  warning: '#D9775C',      // --v2-accent-warning (positive threshold)
  highlight: '#E5C952',    // --v2-accent-highlight (borderline)
  axis: '#7E8088',         // --v2-text-muted
  tooltipBg: '#17171B',    // --v2-bg-card
  tooltipBorder: 'rgba(255, 255, 255, 0.10)',
  tooltipText: '#F2F2F4',  // --v2-text-primary
} as const

interface Point {
  date: string
  label: string
  value: number
}

export interface OrthostaticTrendSparklineProps {
  tests: ClassifiedTest[]
}

function formatTick(iso: string): string {
  return format(parseISO(iso + 'T00:00:00'), 'MMM d')
}

export default function OrthostaticTrendSparkline({
  tests,
}: OrthostaticTrendSparklineProps) {
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

  // Oldest-first so the line reads left to right as "over time". The
  // incoming array is newest-first per summarize().
  const data: Point[] = tests
    .filter(
      (t): t is ClassifiedTest & { peak_rise_bpm: number } =>
        t.peak_rise_bpm !== null,
    )
    .map((t) => ({
      date: t.test_date,
      label: formatTick(t.test_date),
      value: t.peak_rise_bpm,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (data.length < 2) {
    return (
      <Card padding="md">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Peak rise trend
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Logging a second test will reveal your trend.
          </p>
        </div>
      </Card>
    )
  }

  const values = data.map((d) => d.value)
  const min = Math.min(...values, 20)
  const max = Math.max(...values, 30)
  const pad = 5
  const chartHeight = 140

  const firstLabel = data[0].label
  const lastLabel = data[data.length - 1].label

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          Peak rise trend
        </span>
        <div ref={ref} style={{ width: '100%', height: chartHeight }}>
          {width > 0 && (
            <LineChart
              data={data}
              width={width}
              height={chartHeight}
              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            >
              <XAxis
                dataKey="label"
                stroke={CHART_COLORS.axis}
                fontSize={10}
                tickMargin={6}
                ticks={[firstLabel, lastLabel]}
                interval={0}
              />
              <YAxis
                stroke={CHART_COLORS.axis}
                fontSize={10}
                tickMargin={4}
                domain={[min - pad, max + pad]}
                width={32}
                label={{
                  value: 'bpm',
                  position: 'insideLeft',
                  angle: -90,
                  offset: 14,
                  style: { fontSize: 10, fill: CHART_COLORS.axis },
                }}
              />
              <ReferenceLine
                y={30}
                stroke={CHART_COLORS.warning}
                strokeDasharray="4 4"
              />
              <ReferenceLine
                y={20}
                stroke={CHART_COLORS.highlight}
                strokeDasharray="4 4"
              />
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
                  return [`${val} bpm`, 'Peak rise']
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={CHART_COLORS.line}
                strokeWidth={1.75}
                dot={{ r: 3, fill: CHART_COLORS.line }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </div>
      </div>
    </Card>
  )
}
