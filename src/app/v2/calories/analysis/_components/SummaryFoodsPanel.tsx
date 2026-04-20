/*
 * SummaryFoodsPanel
 *
 * Top five contributor foods by total calories over the 30-day
 * window. Each row shows the food name, count, and rolled-up
 * calories. When Lanae has fewer than three logged days in the
 * window, the empty state nudges her back in a week instead of
 * rendering misleading "top 5" from a sample of one.
 */
import { Card, ListRow, EmptyState } from '@/v2/components/primitives'
import type { TopContributor } from './derive'

export interface SummaryFoodsPanelProps {
  contributors: TopContributor[]
  loggedDays: number
}

export default function SummaryFoodsPanel({
  contributors,
  loggedDays,
}: SummaryFoodsPanelProps) {
  if (loggedDays < 3) {
    return (
      <Card padding="md">
        <EmptyState
          headline="Not enough days yet"
          subtext="A few more logged days will give a useful picture. Come back after a week of food entries."
        />
      </Card>
    )
  }

  if (contributors.length === 0) {
    return (
      <Card padding="md">
        <EmptyState
          headline="No food entries in this window"
          subtext="Log a few meals and this list will fill in."
        />
      </Card>
    )
  }

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
            Top foods this month
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Ranked by total calories from the last 30 days.
          </p>
        </div>
        <div>
          {contributors.map((row, i) => (
            <ListRow
              key={row.key}
              label={row.display}
              subtext={`${row.count} log${row.count === 1 ? '' : 's'}`}
              trailing={
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(row.calories).toLocaleString()} cal
                </span>
              }
              divider={i < contributors.length - 1}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}
