/*
 * WeeklyCalorieSparkline
 *
 * Seven-day bar chart showing calories per day, with today
 * highlighted. Empty days render as a short ghost bar so a full
 * empty week still reads as a legible row of tick marks rather
 * than blank space. NC voice above: "Your rhythm this week."
 *
 * Ported from `src/components/calories/home/WeeklyCalorieDelta.tsx`
 * Sparkline, rebuilt for the v2 dark chrome. No link; this sparkline
 * lives inside the dashboard, and a dedicated analysis route owns
 * the deep dive.
 */
import { format } from 'date-fns'
import { Card } from '@/v2/components/primitives'

export interface WeeklyCalorieSparklineProps {
  /** 7 daily totals, oldest → newest, each with date and calories. */
  week: Array<{ date: string; calories: number }>
  /** ISO date of the currently viewed day (usually today). */
  todayISO: string
  /** Daily calorie target (for normalization upper bound). */
  target: number
}

export default function WeeklyCalorieSparkline({
  week,
  todayISO,
  target,
}: WeeklyCalorieSparklineProps) {
  if (week.length === 0) return null
  const max = Math.max(target, ...week.map((d) => d.calories), 1)

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
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
            Your rhythm this week
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Seven days of intake. Today is filled in teal.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 'var(--v2-space-1)',
            height: 72,
            width: '100%',
          }}
          aria-hidden
        >
          {week.map((d) => {
            const isToday = d.date === todayISO
            const isEmpty = d.calories === 0
            const heightPct = max > 0 ? (d.calories / max) * 100 : 0
            return (
              <div
                key={d.date}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: isEmpty ? 4 : `${Math.max(4, heightPct)}%`,
                    borderRadius: 'var(--v2-radius-sm)',
                    background: isToday
                      ? 'var(--v2-accent-primary)'
                      : isEmpty
                        ? 'var(--v2-border)'
                        : 'var(--v2-accent-primary-soft)',
                    border: isToday ? 'none' : '1px solid var(--v2-border-subtle)',
                    transition:
                      'background var(--v2-duration-medium) var(--v2-ease-standard)',
                  }}
                />
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    color: isToday ? 'var(--v2-text-primary)' : 'var(--v2-text-muted)',
                    fontWeight: isToday ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-regular)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--v2-tracking-wide)',
                    lineHeight: 1,
                  }}
                >
                  {format(new Date(d.date + 'T00:00:00'), 'EEE').slice(0, 1)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
