import { Card } from '@/v2/components/primitives'
import type { PeriodPrediction } from '@/lib/cycle/period-prediction'

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sameMonth = s.getMonth() === e.getMonth()
  const fmt = (d: Date, short: boolean) =>
    d.toLocaleDateString('en-US', short ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return sameMonth ? `${fmt(s, false)}–${fmt(e, true)}` : `${fmt(s, false)} – ${fmt(e, false)}`
}

export interface PeriodCountdownCardProps {
  prediction: PeriodPrediction
}

export default function PeriodCountdownCard({ prediction }: PeriodCountdownCardProps) {
  const { status, daysUntil, daysOverdue, rangeStart, rangeEnd, confidence, caveat } = prediction

  const eyebrow =
    status === 'overdue' ? 'Period overdue' : status === 'unknown' ? 'Next period' : 'Next period'
  const big =
    status === 'unknown'
      ? '—'
      : status === 'overdue'
        ? `${daysOverdue}d late`
        : daysUntil != null
          ? `${daysUntil}d`
          : '—'
  const rangeText = formatRange(rangeStart, rangeEnd)

  /*
   * LEARNING-MODE HOOK G3 — Uncertainty copy.
   *
   * When `confidence === 'low'` we need a voice-matched caveat. The default
   * below ("Your pattern is still coming into focus") leans toward NC's
   * gentle-honesty register from user-reviews.md ("helping me be more
   * compassionate with myself"). Strict-honesty alternative would be
   * "We don't have enough cycles to predict with confidence."
   *
   * Replace the next 5-line block with the voice you want the whole
   * section to carry. ≤10 lines.
   */
  const lowConfidenceVoice =
    'Your pattern is still coming into focus. A few more cycles and this range will tighten.'

  const subtitle =
    confidence === 'low' && status !== 'unknown' ? lowConfidenceVoice : caveat

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          {eyebrow}
        </span>
        <span
          style={{
            fontSize: 'var(--v2-text-2xl)',
            fontWeight: 'var(--v2-weight-bold)',
            color: 'var(--v2-text-primary)',
            letterSpacing: 'var(--v2-tracking-tight)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {big}
        </span>
        {rangeText && (
          <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
            Window: {rangeText}
          </span>
        )}
        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-normal)',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </Card>
  )
}
