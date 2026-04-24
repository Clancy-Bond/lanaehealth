/**
 * LogProgressHeader
 *
 * Top of /v2/log. Shows a short progress sentence and which day we
 * are logging. v1 is today-only. A future enhancement adds a
 * SegmentedControl for yesterday / today when the pattern is proven.
 *
 * The copy here is deliberately permissive: "There is no required
 * minimum" keeps the log from feeling like a compliance checklist.
 */
import { formatLongDate } from '@/lib/v2/home-signals'

export interface LogProgressHeaderProps {
  iso: string
  loggedCount: number
  totalCount: number
}

export default function LogProgressHeader({ iso, loggedCount, totalCount }: LogProgressHeaderProps) {
  const subtext =
    loggedCount === 0
      ? 'There is no required minimum. Log what feels useful.'
      : loggedCount >= totalCount
        ? 'Everything for today is in. Nicely done.'
        : `${loggedCount} of ${totalCount} in. Do what feels right today.`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
          fontWeight: 'var(--v2-weight-medium)',
        }}
      >
        Logging
      </span>
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-2xl)',
          fontWeight: 'var(--v2-weight-medium)',
          letterSpacing: 'var(--v2-tracking-tight)',
          color: 'var(--v2-text-primary)',
          lineHeight: 'var(--v2-leading-tight)',
        }}
      >
        {formatLongDate(iso)}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-normal)',
        }}
      >
        {subtext}
      </p>
    </div>
  )
}
