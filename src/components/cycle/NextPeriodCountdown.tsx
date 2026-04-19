/**
 * Next-period countdown with honest uncertainty range.
 *
 * Shared between /cycle landing, /cycle/predict, and the
 * "next-period-countdown" home widget. Always renders a range, not a
 * point estimate, per NC pattern 15. Overdue cycles surface with a blush
 * stripe, never red/alarm - chronic illness and travel break calendars
 * and the app must stay neutral (non-shaming voice rule).
 */
import type { PeriodPrediction } from '@/lib/cycle/period-prediction'
import { CalendarDays, Hourglass } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export interface NextPeriodCountdownProps {
  prediction: PeriodPrediction
  size?: 'hero' | 'widget'
}

export function NextPeriodCountdown({ prediction, size = 'hero' }: NextPeriodCountdownProps) {
  const unknown = prediction.status === 'unknown'
  const overdue = prediction.status === 'overdue'
  const padding = size === 'hero' ? '18px 20px' : '14px 16px'

  const accent = unknown
    ? 'var(--text-muted)'
    : overdue
      ? 'var(--accent-blush)'
      : 'var(--accent-sage)'
  const bg = unknown
    ? 'var(--bg-elevated)'
    : overdue
      ? 'var(--accent-blush-muted)'
      : 'var(--bg-card)'

  return (
    <div
      className="card"
      style={{
        padding,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: bg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: size === 'hero' ? 40 : 32,
            height: size === 'hero' ? 40 : 32,
            borderRadius: '50%',
            background: overdue ? 'var(--accent-blush-light)' : 'var(--accent-sage-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {overdue ? (
            <Hourglass size={size === 'hero' ? 20 : 16} style={{ color: accent }} />
          ) : (
            <CalendarDays size={size === 'hero' ? 20 : 16} style={{ color: accent }} />
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: accent,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {overdue ? 'Period is late' : 'Next period'}
          </div>
          <div
            className="tabular"
            style={{
              fontSize: size === 'hero' ? 22 : 17,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.1,
              marginTop: 2,
            }}
          >
            {headline(prediction)}
          </div>
        </div>
      </div>

      {prediction.rangeStart && prediction.rangeEnd && (
        <div
          className="tabular"
          style={{ fontSize: 12, color: 'var(--text-secondary)' }}
        >
          Window: {formatRange(prediction.rangeStart, prediction.rangeEnd)}
        </div>
      )}

      <p style={{ fontSize: 12, margin: 0, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        {prediction.caveat}
      </p>

      {!unknown && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            alignSelf: 'flex-start',
            padding: '3px 8px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: accent,
            background: 'var(--bg-card)',
          }}
        >
          Confidence: {prediction.confidence}
        </div>
      )}
    </div>
  )
}

function headline(prediction: PeriodPrediction): string {
  if (prediction.status === 'unknown') return 'Awaiting data'
  if (prediction.status === 'overdue') {
    const n = prediction.daysOverdue
    return `${n} day${n === 1 ? '' : 's'} later than predicted`
  }
  if (prediction.daysUntil != null) {
    if (prediction.daysUntil === 0) return 'Expected today'
    if (prediction.daysUntil === 1) return 'In about 1 day'
    return `In about ${prediction.daysUntil} days`
  }
  return 'Awaiting data'
}

function formatRange(startISO: string, endISO: string): string {
  const start = parseISO(startISO)
  const end = parseISO(endISO)
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} - ${format(end, 'd')}`
  }
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
}
