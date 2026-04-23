/*
 * MonthlyCalorieSparkline
 *
 * Thirty-day bar chart, same bar language as WeeklyCalorieSparkline
 * in ../../_components/WeeklyCalorieSparkline.tsx : today filled
 * teal, logged days in the soft-teal tint, empty days a short grey
 * stub. Bars here are narrower (30 instead of 7) and day-of-week
 * labels are dropped; only the eyebrow and the accent on today
 * anchor the axis.
 *
 * LEARNING-MODE HOOK G8: Monthly bar shape choice.
 *   The weekly sparkline uses a day-initial beneath each bar; here
 *   we drop labels entirely because 30 single-letter labels would
 *   either collide or require tiny 4pt glyphs on 375pt viewports.
 *   The dashboard is the place to learn single days; this chart is
 *   the place to feel the trend. If we ever add week tick marks,
 *   this is where.
 */
import { Card } from '@/v2/components/primitives'

export interface MonthlyCalorieSparklineProps {
  /** 30 daily totals, oldest → newest, each with date and calories. */
  days: Array<{ date: string; calories: number }>
  /** ISO date of today (rendered in the accent fill). */
  todayISO: string
  /** Daily calorie target, used as upper bound when any day exceeds it. */
  target: number
}

export default function MonthlyCalorieSparkline({
  days,
  todayISO,
  target,
}: MonthlyCalorieSparklineProps) {
  if (days.length === 0) return null
  const max = Math.max(target, ...days.map((d) => d.calories), 1)

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
            }}
          >
            Last 30 days
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Each bar is a day. Today is filled in teal.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            height: 72,
            width: '100%',
          }}
          aria-hidden
        >
          {days.map((d) => {
            const isToday = d.date === todayISO
            const isEmpty = d.calories === 0
            const heightPct = max > 0 ? (d.calories / max) * 100 : 0
            return (
              <div
                key={d.date}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: '100%',
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
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
