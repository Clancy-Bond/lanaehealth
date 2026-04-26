'use client'

/**
 * RecoveryTimeCard
 *
 * Home-screen card showing the user's last readiness dip and how
 * long it took (or is taking) to return to baseline. Mirrors Oura's
 * "Recovery Index" concept while staying transparent about the
 * baseline being personal, not generic.
 *
 * Data: last 14 days of `oura_daily.readiness_score` plus a baseline
 * (median of the last 30 days). Computation lives in
 * `src/lib/v2/recovery-time.ts` and is unit tested.
 */
import Card from '@/v2/components/primitives/Card'
import type { RecoveryTimeResult } from '@/lib/v2/recovery-time'

export interface RecoveryTimeCardProps {
  result: RecoveryTimeResult
  baselineScore: number
}

function trajectoryColor(t: RecoveryTimeResult['currentTrajectory']): string {
  if (t === 'recovered') return 'var(--v2-accent-positive, #22c55e)'
  if (t === 'recovering') return 'var(--v2-accent-warning, #f59e0b)'
  return 'var(--v2-accent-danger, #ef4444)'
}

function trajectoryLabel(t: RecoveryTimeResult['currentTrajectory']): string {
  if (t === 'recovered') return 'Recovered'
  if (t === 'recovering') return 'Recovering'
  return 'Flat'
}

function buildSentence(r: RecoveryTimeResult, baseline: number): string {
  if (r.lastDip <= 0) {
    return `Your readiness has stayed at or above your baseline (${Math.round(baseline)}) over the last two weeks.`
  }
  if (r.currentTrajectory === 'recovered' && r.daysToRecovery > 0) {
    return `Your last dip hit ${r.lastDip}, and it took ${r.daysToRecovery} day${r.daysToRecovery === 1 ? '' : 's'} to return to your baseline of ${Math.round(baseline)}.`
  }
  if (r.currentTrajectory === 'recovered') {
    return `Your last dip hit ${r.lastDip}, and you have returned to your baseline of ${Math.round(baseline)}.`
  }
  if (r.currentTrajectory === 'recovering') {
    return `Your last dip hit ${r.lastDip}. You are trending up but have not reached your baseline of ${Math.round(baseline)} yet.`
  }
  return `Your readiness has stayed at ${r.lastDip} or below for several days, off your baseline of ${Math.round(baseline)}. A gentler day may help.`
}

export default function RecoveryTimeCard({ result, baselineScore }: RecoveryTimeCardProps) {
  const color = trajectoryColor(result.currentTrajectory)
  const label = trajectoryLabel(result.currentTrajectory)
  const sentence = buildSentence(result, baselineScore)

  return (
    <Card padding="md" data-testid="recovery-time-card">
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
            Recovery time
          </span>
          <span
            aria-label={`Recovery trajectory: ${label}`}
            style={{
              fontSize: 'var(--v2-text-xs)',
              color,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              border: `1px solid ${color}`,
            }}
          >
            {label}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--v2-space-3)' }}>
          <Stat label="Last dip" value={result.lastDip > 0 ? `${result.lastDip}` : '—'} />
          <Stat
            label="Days to recover"
            value={result.daysToRecovery > 0 ? `${result.daysToRecovery}` : '—'}
          />
        </div>

        <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)', lineHeight: 1.5 }}>
          {sentence}
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
