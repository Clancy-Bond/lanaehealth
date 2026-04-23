/*
 * MealAnalysisPanel
 *
 * Four stacked rows (breakfast / lunch / dinner / snack) showing
 * each meal's share of the 30-day calorie pot as a percentage
 * plus absolute cal. The ProgressBar is used as a share visual,
 * not a goal bar : max = 100 and the value is the meal's pct.
 *
 * Voice eyebrow is "How your days split up" per NC register.
 * Empty state mirrors SummaryFoodsPanel's threshold (3 days).
 */
import ProgressBar from '../../_components/ProgressBar'
import { Card, EmptyState } from '@/v2/components/primitives'
import { MEAL_LABELS, type MealBreakdownRow } from './derive'

export interface MealAnalysisPanelProps {
  rows: MealBreakdownRow[]
  loggedDays: number
}

export default function MealAnalysisPanel({
  rows,
  loggedDays,
}: MealAnalysisPanelProps) {
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

  const total = rows.reduce((sum, r) => sum + r.cal, 0)
  if (total === 0) {
    return (
      <Card padding="md">
        <EmptyState
          headline="No meals logged in this window"
          subtext="Add a breakfast, lunch, or dinner and the split will appear here."
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
            How your days split up
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Share of total calories by meal, over the last 30 days.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-4)',
          }}
        >
          {rows.map((r) => (
            <div
              key={r.meal}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--v2-space-2)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 'var(--v2-space-3)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--v2-text-base)',
                    fontWeight: 'var(--v2-weight-medium)',
                    color: 'var(--v2-text-primary)',
                  }}
                >
                  {MEAL_LABELS[r.meal]}
                </span>
                <span
                  style={{
                    fontSize: 'var(--v2-text-sm)',
                    color: 'var(--v2-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(r.pct)}%{'  '}·{'  '}
                  {Math.round(r.cal).toLocaleString()} cal
                </span>
              </div>
              <ProgressBar
                value={r.pct}
                max={100}
                ariaLabel={`${MEAL_LABELS[r.meal]} is ${Math.round(r.pct)} percent`}
              />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
