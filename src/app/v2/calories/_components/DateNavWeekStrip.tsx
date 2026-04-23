/*
 * DateNavWeekStrip
 *
 * 9-day scroll strip for navigating the dashboard via
 * ?date=YYYY-MM-DD. Today (or the viewed date) sits in the center,
 * chevrons on each side step one day. Each cell shows the day-of-week
 * glyph (Mon/Tue/...), the date number, and an optional micro
 * calorie total beneath when logged. Current view is highlighted.
 *
 * Pure server component: nav uses <Link> and the page reloads with
 * the new ?date= value. No client JS.
 */
import Link from 'next/link'
import { format, addDays, startOfDay } from 'date-fns'

export interface DateNavWeekStripProps {
  /** ISO date (YYYY-MM-DD) being viewed. */
  viewDate: string
  /** ISO date (YYYY-MM-DD) for today. */
  todayISO: string
  /** Total calories per date, for the micro-indicator. */
  caloriesByDate: Map<string, number>
}

export default function DateNavWeekStrip({
  viewDate,
  todayISO,
  caloriesByDate,
}: DateNavWeekStripProps) {
  const anchor = startOfDay(new Date(viewDate + 'T00:00:00'))
  const dates: Date[] = []
  for (let i = -4; i <= 4; i++) {
    dates.push(addDays(anchor, i))
  }

  const prevISO = format(addDays(anchor, -1), 'yyyy-MM-dd')
  const nextISO = format(addDays(anchor, 1), 'yyyy-MM-dd')
  const label = viewDate === todayISO ? 'Today' : format(anchor, 'EEE MMM d')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-2)',
        }}
      >
        <NavArrow href={`/v2/calories?date=${prevISO}`} direction="prev" ariaLabel="Previous day" />
        <span
          style={{
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          {label}
        </span>
        <NavArrow href={`/v2/calories?date=${nextISO}`} direction="next" ariaLabel="Next day" />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))`,
          gap: 'var(--v2-space-1)',
        }}
        role="group"
        aria-label="Date strip"
      >
        {dates.map((d) => {
          const iso = format(d, 'yyyy-MM-dd')
          const isSelected = iso === viewDate
          const cal = caloriesByDate.get(iso) ?? 0
          return (
            <Link
              key={iso}
              href={`/v2/calories?date=${iso}`}
              aria-label={`${format(d, 'EEEE, MMMM d')}${cal > 0 ? `, ${Math.round(cal)} calories` : ''}`}
              aria-current={isSelected ? 'date' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minHeight: 56,
                padding: 'var(--v2-space-2) 0',
                borderRadius: 'var(--v2-radius-md)',
                border: '1px solid',
                borderColor: isSelected ? 'var(--v2-accent-primary)' : 'var(--v2-border-subtle)',
                background: isSelected ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-card)',
                color: 'var(--v2-text-primary)',
                textDecoration: 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--v2-tracking-wide)',
                }}
              >
                {format(d, 'EEE').slice(0, 2)}
              </span>
              <span
                style={{
                  fontSize: 'var(--v2-text-base)',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: isSelected ? 'var(--v2-accent-primary)' : 'var(--v2-text-primary)',
                  lineHeight: 1,
                }}
              >
                {format(d, 'd')}
              </span>
              {cal > 0 && (
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--v2-text-muted)',
                    fontWeight: 'var(--v2-weight-medium)',
                    lineHeight: 1,
                  }}
                >
                  {Math.round(cal)}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function NavArrow({
  href,
  direction,
  ariaLabel,
}: {
  href: string
  direction: 'prev' | 'next'
  ariaLabel: string
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 'var(--v2-touch-target-min)',
        minHeight: 'var(--v2-touch-target-min)',
        borderRadius: 'var(--v2-radius-md)',
        color: 'var(--v2-text-secondary)',
        textDecoration: 'none',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        {direction === 'prev' ? (
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </Link>
  )
}
