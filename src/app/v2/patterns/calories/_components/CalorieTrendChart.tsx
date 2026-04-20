/**
 * CalorieTrendChart
 *
 * 30-day bar chart of daily calorie totals. Bars are color-coded by
 * whether the day had any entries at all: filled for logged days,
 * dimmed for days with zero entries (honest about gaps).
 */
import type { DayTotals } from '@/lib/calories/home-data'
import { Card } from '@/v2/components/primitives'

export interface CalorieTrendChartProps {
  days: DayTotals[]
}

export default function CalorieTrendChart({ days }: CalorieTrendChartProps) {
  const logged = days.filter((d) => d.entryCount > 0)
  const maxCalories = Math.max(...logged.map((d) => d.calories), 0)
  const avg =
    logged.length > 0 ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length) : null
  const missing = days.length - logged.length

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
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
            {avg ?? '—'}
          </span>
          <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)', marginLeft: 'var(--v2-space-2)' }}>
            avg calories
          </span>
        </div>

        {logged.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-muted)' }}>
            Nothing to show yet. Once a week of meals is logged, trends become visible.
          </p>
        ) : (
          <div
            role="img"
            aria-label={`Daily calorie totals over ${days.length} days`}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 2,
              minHeight: 100,
            }}
          >
            {days.map((d) => {
              const hasData = d.entryCount > 0
              const height = hasData && maxCalories > 0 ? (d.calories / maxCalories) * 100 : 2
              return (
                <div
                  key={d.date}
                  title={hasData ? `${d.date}: ${Math.round(d.calories)} cal (${d.entryCount} entries)` : `${d.date}: no meals logged`}
                  style={{
                    flex: 1,
                    minWidth: 3,
                    maxWidth: 16,
                    height,
                    background: hasData ? 'var(--v2-accent-primary)' : 'var(--v2-border)',
                    borderRadius: 2,
                    opacity: hasData ? 1 : 0.4,
                  }}
                />
              )
            })}
          </div>
        )}

        <p style={{ margin: 0, fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', lineHeight: 'var(--v2-leading-normal)' }}>
          {missing === 0
            ? `Based on ${logged.length} days, all logged.`
            : `Based on ${logged.length} logged days. ${missing} day${missing === 1 ? '' : 's'} had no meals recorded.`}
        </p>
      </div>
    </Card>
  )
}
