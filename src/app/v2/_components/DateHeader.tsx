/**
 * DateHeader
 *
 * Large weekday + date used on Home and Today. Designed for the
 * moment right under TopAppBar(large) where we want the first line
 * of body text to feel grounded in "now".
 */
import { formatLongDate, greetingFor } from '@/lib/v2/home-signals'

export interface DateHeaderProps {
  iso: string
  hour?: number
  subtext?: string
}

export default function DateHeader({ iso, hour, subtext }: DateHeaderProps) {
  const h = hour ?? new Date().getHours()
  const greeting = greetingFor(h)
  const longDate = formatLongDate(iso)

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
        {greeting}
      </span>
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-2xl)',
          fontWeight: 'var(--v2-weight-medium)',
          color: 'var(--v2-text-primary)',
          letterSpacing: 'var(--v2-tracking-tight)',
          lineHeight: 'var(--v2-leading-tight)',
        }}
      >
        {longDate}
      </h2>
      {subtext && (
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
      )}
    </div>
  )
}
