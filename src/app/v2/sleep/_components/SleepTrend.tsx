'use client'

/**
 * SleepTrend
 *
 * Client-side chart + range picker. Takes the full 90-day window and
 * filters locally so the range toggle is instant (no server round
 * trip). The bar color shifts across the four sleep-score bands.
 *
 * Intentionally a local bar renderer, not a new primitive: Sleep is
 * the first place we render a time-series bar chart. If Calories
 * also wants one, we'll extract then (rule of three).
 */
import { useMemo, useState } from 'react'
import type { OuraDaily } from '@/lib/types'
import { SegmentedControl, Card } from '@/v2/components/primitives'
import { bandConfig, bandForScore } from '@/lib/v2/home-signals'

export interface SleepTrendProps {
  ninetyDays: OuraDaily[]
}

type Range = '7d' | '30d' | '90d'

const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 }

export default function SleepTrend({ ninetyDays }: SleepTrendProps) {
  const [range, setRange] = useState<Range>('30d')

  const data = useMemo(() => {
    const days = RANGE_DAYS[range]
    return ninetyDays.slice(-days)
  }, [ninetyDays, range])

  const sample = data.filter((d) => d.sleep_score != null)
  const average =
    sample.length > 0 ? Math.round(sample.reduce((s, d) => s + (d.sleep_score ?? 0), 0) / sample.length) : null
  const nights = sample.length
  const missingNights = data.length - nights

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--v2-space-2)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            Trend
          </span>
          <SegmentedControl<Range>
            segments={[
              { value: '7d', label: '7d' },
              { value: '30d', label: '30d' },
              { value: '90d', label: '90d' },
            ]}
            value={range}
            onChange={setRange}
          />
        </div>

        <div>
          <span
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: 'var(--v2-text-primary)',
              letterSpacing: 'var(--v2-tracking-tight)',
              lineHeight: 1.1,
            }}
          >
            {average ?? '--'}
          </span>
          <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', marginLeft: 'var(--v2-space-2)' }}>
            average score
          </span>
        </div>

        <BarRow data={data} />

        <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', lineHeight: 'var(--v2-leading-normal)' }}>
          {nights === 0
            ? 'No nights logged in this window.'
            : `Based on ${nights} night${nights === 1 ? '' : 's'} of Oura data${missingNights > 0 ? `; ${missingNights} night${missingNights === 1 ? '' : 's'} missing` : ''}.`}
        </p>
      </div>
    </Card>
  )
}

function BarRow({ data }: { data: OuraDaily[] }) {
  if (data.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', lineHeight: 'var(--v2-leading-normal)' }}>
        Nothing to show yet. Sync your ring to populate the chart.
      </p>
    )
  }
  const maxHeight = 96
  return (
    <div
      role="img"
      aria-label={`Sleep score over ${data.length} nights`}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        minHeight: maxHeight,
        paddingTop: 'var(--v2-space-1)',
        paddingBottom: 'var(--v2-space-1)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {data.map((d) => {
        const score = d.sleep_score
        const height = score != null ? (score / 100) * maxHeight : 2
        const color =
          score == null ? 'var(--v2-border)' : bandConfig(bandForScore(score)).color
        return (
          <div
            key={d.date}
            title={score != null ? `${d.date}: ${score}` : `${d.date}: no data`}
            style={{
              flex: 1,
              minWidth: 4,
              maxWidth: 16,
              height,
              background: color,
              borderRadius: 2,
              opacity: score == null ? 0.3 : 1,
            }}
          />
        )
      })}
    </div>
  )
}
