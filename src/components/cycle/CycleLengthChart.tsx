'use client'

/**
 * Line chart of completed cycle lengths.
 *
 * Recharts. Each point is a completed cycle's length in days, plotted by
 * start date. Reference lines at 21d and 35d mark the ACOG normal range.
 * This is diagnostic, not gamified - no "goals" or "targets" shown.
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { Cycle } from '@/lib/cycle/cycle-stats'

export interface CycleLengthChartProps {
  cycles: Cycle[]
  meanCycleLength: number | null
}

export function CycleLengthChart({ cycles, meanCycleLength }: CycleLengthChartProps) {
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

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            fontSize={10}
            tickMargin={6}
            interval={Math.max(0, Math.floor(data.length / 8))}
            stroke="var(--text-muted)"
          />
          <YAxis
            fontSize={10}
            tickMargin={4}
            stroke="var(--text-muted)"
            domain={['auto', 'auto']}
            width={28}
            label={{ value: 'days', position: 'insideLeft', angle: -90, offset: 12, style: { fontSize: 10, fill: 'var(--text-muted)' } }}
          />
          <ReferenceLine y={21} stroke="var(--phase-luteal)" strokeDasharray="4 2" />
          <ReferenceLine y={35} stroke="var(--phase-luteal)" strokeDasharray="4 2" />
          {meanCycleLength != null && (
            <ReferenceLine y={meanCycleLength} stroke="var(--accent-sage)" strokeDasharray="1 3" />
          )}
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
            formatter={(v) => [`${v}d`, 'Cycle length']}
            labelFormatter={(l) => `Starting ${l}`}
          />
          <Line
            type="monotone"
            dataKey="length"
            stroke="var(--phase-menstrual)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--phase-menstrual)' }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
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
        <LegendDot color="var(--phase-menstrual)" label="Cycle length" />
        <LegendDot color="var(--accent-sage)" label="Your mean" dash />
        <LegendDot color="var(--phase-luteal)" label="ACOG 21-35d" dash />
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
