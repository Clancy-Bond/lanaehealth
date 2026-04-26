'use client'

/**
 * HrvBalanceCard
 *
 * Surfaces HRV trend as a clinical signal, not a generic recovery
 * tile. Shows current night, 7-day average, 30-day average, and the
 * trend direction (up / flat / down).
 *
 * Why this matters for Lanae specifically (per
 * docs/research/oura-condition-mapping.md):
 *   - HRV is a critical POTS signal. Sustained drops correlate with
 *     active flares per the Emma N. POTS spotlight.
 *   - Low HRV + elevated RHR over a 7-day rolling window predicts
 *     migraine prodrome (PubMed PMID 41607086, with the caveat that
 *     thresholds are individualised, not population-level).
 *
 * Color coding:
 *   green  -> trending up (recovery / stable autonomics)
 *   yellow -> flat (within 5% of 30-day average)
 *   red    -> trending down (POTS flare risk, migraine prodrome window)
 *
 * The insight line is rule-based and transparent. We do not invent
 * predictions; we describe the pattern and cite the research.
 */
import type { OuraDaily } from '@/lib/types'
import Card from '@/v2/components/primitives/Card'

export interface HrvBalanceCardProps {
  nights: OuraDaily[]
}

interface HrvSnapshot {
  current: number | null
  sevenDayAvg: number | null
  thirtyDayAvg: number | null
  trend: 'up' | 'flat' | 'down'
  recentRhrAvg: number | null
  baselineRhrAvg: number | null
}

function avg(xs: number[]): number | null {
  const arr = xs.filter((x) => Number.isFinite(x))
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function snapshot(nights: OuraDaily[]): HrvSnapshot {
  const sorted = [...nights].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1] ?? null
  const last7 = sorted.slice(-7)
  const last30 = sorted.slice(-30)
  const current = last?.hrv_avg ?? null
  const sevenDayAvg = avg(last7.map((n) => n.hrv_avg ?? Number.NaN))
  const thirtyDayAvg = avg(last30.map((n) => n.hrv_avg ?? Number.NaN))

  let trend: 'up' | 'flat' | 'down' = 'flat'
  if (sevenDayAvg != null && thirtyDayAvg != null && thirtyDayAvg > 0) {
    const pct = (sevenDayAvg - thirtyDayAvg) / thirtyDayAvg
    if (pct > 0.05) trend = 'up'
    else if (pct < -0.05) trend = 'down'
    else trend = 'flat'
  }

  const recentRhrAvg = avg(last7.map((n) => n.resting_hr ?? Number.NaN))
  const baselineRhrAvg = avg(last30.map((n) => n.resting_hr ?? Number.NaN))

  return { current, sevenDayAvg, thirtyDayAvg, trend, recentRhrAvg, baselineRhrAvg }
}

function trendColor(t: 'up' | 'flat' | 'down'): string {
  if (t === 'up') return 'var(--v2-accent-positive, #22c55e)'
  if (t === 'down') return 'var(--v2-accent-danger, #ef4444)'
  return 'var(--v2-accent-warning, #f59e0b)'
}

function trendLabel(t: 'up' | 'flat' | 'down'): string {
  if (t === 'up') return 'Trending up'
  if (t === 'down') return 'Trending down'
  return 'Flat'
}

function buildInsight(s: HrvSnapshot): string {
  if (s.current == null && s.sevenDayAvg == null) {
    return 'Not enough HRV data yet. As your ring syncs, your trend will fill in here.'
  }
  if (s.trend === 'down') {
    const rhrUp =
      s.recentRhrAvg != null &&
      s.baselineRhrAvg != null &&
      s.recentRhrAvg - s.baselineRhrAvg >= 3
    if (rhrUp) {
      return 'Your HRV is trending down and your resting heart rate is up over the past week. POTS flares often present this way; in NC research this same cluster precedes migraine prodrome. Consider extra sodium and a lower-effort day.'
    }
    return 'Your HRV has been declining the past week. POTS flares often precede this pattern. Consider extra sodium today.'
  }
  if (s.trend === 'up') {
    return 'Your HRV is trending up over your 30-day baseline. Autonomics look settled.'
  }
  return 'Your HRV is steady around your 30-day baseline. Nothing unusual.'
}

export default function HrvBalanceCard({ nights }: HrvBalanceCardProps) {
  const s = snapshot(nights)
  const color = trendColor(s.trend)
  const label = trendLabel(s.trend)
  const insight = buildInsight(s)

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            HRV balance
          </span>
          <span
            aria-label={`HRV trend: ${label}`}
            style={{
              fontSize: 'var(--v2-text-xs)',
              color,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'transparent',
              border: `1px solid ${color}`,
            }}
          >
            {label}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--v2-space-3)' }}>
          <Stat label="Last night" value={s.current != null ? Math.round(s.current).toString() : '-'} />
          <Stat label="7-day avg" value={s.sevenDayAvg != null ? Math.round(s.sevenDayAvg).toString() : '-'} />
          <Stat label="30-day avg" value={s.thirtyDayAvg != null ? Math.round(s.thirtyDayAvg).toString() : '-'} />
        </div>

        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)', lineHeight: 1.5 }}>
          {insight}
        </p>
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 'var(--v2-text-xl)', color: 'var(--v2-text-primary)', fontWeight: 500 }}>
        {value}
      </span>
    </div>
  )
}
