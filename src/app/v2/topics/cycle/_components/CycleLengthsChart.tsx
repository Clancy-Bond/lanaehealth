'use client'

/*
 * CycleLengthsChart
 *
 * Bar chart of the last <=6 completed cycle lengths. Each bar colors
 * by whether the cycle fell inside the ACOG typical range (21 to 35
 * days); dashed reference lines mark the 21/35 boundaries plus the
 * patient's own mean so the distribution reads at a glance.
 *
 * Uses a ResizeObserver-driven width state (not ResponsiveContainer)
 * because ResponsiveContainer silently renders at 0x0 when its parent
 * has only a min-height during SSR hydration on mobile : the same trap
 * CycleLengthChart documents. See src/components/cycle/CycleLengthChart.tsx
 * for the canonical pattern.
 */
import { useEffect, useRef, useState } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { Card } from '@/v2/components/primitives'
import type { CompletedCycle } from './deriveCycleLengths'

// Recharts writes these into SVG stroke/fill presentation attributes,
// where CSS custom properties are not resolved reliably. Literal hex
// mirrors the v2 dark tokens (tokens.css) so the chart stays visible.
const CHART_COLORS = {
  inRange: '#4DB8A8',      // --v2-accent-primary
  outOfRange: '#D9775C',   // --v2-accent-warning
  acog: '#E5C952',         // --v2-accent-highlight
  mean: '#7FBFB5',         // softened teal (tonal match to accent-primary)
  axis: '#7E8088',         // --v2-text-muted
  tooltipBg: '#17171B',    // --v2-bg-card
  tooltipBorder: 'rgba(255, 255, 255, 0.10)',
  tooltipText: '#F2F2F4',  // --v2-text-primary
} as const

const ACOG_MIN = 21
const ACOG_MAX = 35
const CHART_HEIGHT = 160

export interface CycleLengthsChartProps {
  cycles: CompletedCycle[]
}

function inAcogRange(length: number): boolean {
  return length >= ACOG_MIN && length <= ACOG_MAX
}

export default function CycleLengthsChart({ cycles }: CycleLengthsChartProps) {
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

  // Show up to 6 most recent. Incoming array is newest-first; reverse
  // so the chart reads oldest to newest left to right.
  const recent = cycles.slice(0, 6)
  const data = [...recent].reverse().map((c) => ({
    start: c.start,
    end: c.end,
    length: c.length,
    // key doubles as X-axis category; index-based so duplicate start
    // dates (impossible in practice, but defensive) never collide.
    key: `${c.start}-${c.length}`,
  }))

  if (recent.length < 2) {
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
            Last 6 cycles
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Log a full cycle to start seeing your length pattern.
          </p>
        </div>
      </Card>
    )
  }

  const lengths = data.map((d) => d.length)
  const meanLength = lengths.reduce((a, b) => a + b, 0) / lengths.length
  const meanDays = Math.round(meanLength * 10) / 10
  const pad = 3
  const yMin = Math.min(...lengths, ACOG_MIN) - pad
  const yMax = Math.max(...lengths, ACOG_MAX) + pad

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
          Last {data.length} cycles
        </span>
        <div ref={ref} style={{ width: '100%', height: CHART_HEIGHT }}>
          {width > 0 && (
            <BarChart
              data={data}
              width={width}
              height={CHART_HEIGHT}
              margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
            >
              <XAxis dataKey="key" hide />
              <YAxis
                stroke={CHART_COLORS.axis}
                fontSize={10}
                tickMargin={4}
                domain={[yMin, yMax]}
                width={32}
                label={{
                  value: 'days',
                  position: 'insideLeft',
                  angle: -90,
                  offset: 14,
                  style: { fontSize: 10, fill: CHART_COLORS.axis },
                }}
              />
              <ReferenceLine
                y={ACOG_MIN}
                stroke={CHART_COLORS.acog}
                strokeDasharray="4 4"
              />
              <ReferenceLine
                y={ACOG_MAX}
                stroke={CHART_COLORS.acog}
                strokeDasharray="4 4"
              />
              <ReferenceLine
                y={meanLength}
                stroke={CHART_COLORS.mean}
                strokeDasharray="2 3"
                label={{
                  value: `avg ${meanDays}`,
                  position: 'right',
                  fontSize: 10,
                  fill: CHART_COLORS.mean,
                }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                contentStyle={{
                  background: CHART_COLORS.tooltipBg,
                  border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: CHART_COLORS.tooltipText,
                  padding: '6px 8px',
                }}
                labelStyle={{ display: 'none' }}
                itemStyle={{ color: CHART_COLORS.tooltipText }}
                formatter={(_v, _n, entry) => {
                  const p = entry?.payload as
                    | { start: string; length: number }
                    | undefined
                  if (!p) return ['', '']
                  return [`Cycle starting ${p.start}: ${p.length} days`, '']
                }}
                separator=""
              />
              <Bar dataKey="length" isAnimationActive={false} radius={[4, 4, 0, 0]}>
                {data.map((d) => (
                  <Cell
                    key={d.key}
                    fill={
                      inAcogRange(d.length)
                        ? CHART_COLORS.inRange
                        : CHART_COLORS.outOfRange
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          Average: {meanDays} days across {data.length} cycles.
        </p>
      </div>
    </Card>
  )
}
