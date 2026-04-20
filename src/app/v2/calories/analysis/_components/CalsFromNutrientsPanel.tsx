/*
 * CalsFromNutrientsPanel
 *
 * Macro-calorie split over the 30-day window: carbs and protein
 * each contribute 4 kcal per gram, fat 9 kcal per gram (standard
 * Atwater factors). Each row pairs the macro label with its
 * absolute calories and its share of the macro-derived total.
 *
 * The percentages here do NOT equal the raw calorie percentages,
 * because some entries have calories logged without full macros.
 * That gap is intentional : this view is specifically "where do
 * the calories we can attribute come from".
 */
import ProgressBar from '../../_components/ProgressBar'
import { Card, EmptyState } from '@/v2/components/primitives'
import type { MacroCalSplit } from './derive'

export interface CalsFromNutrientsPanelProps {
  split: MacroCalSplit
  loggedDays: number
}

interface Row {
  label: string
  cal: number
  pct: number
  color: string
}

export default function CalsFromNutrientsPanel({
  split,
  loggedDays,
}: CalsFromNutrientsPanelProps) {
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

  const total = split.carbCal + split.proteinCal + split.fatCal
  if (total === 0) {
    return (
      <Card padding="md">
        <EmptyState
          headline="No macros logged in this window"
          subtext="Foods with carbs, protein, or fat will fill this in."
        />
      </Card>
    )
  }

  const rows: Row[] = [
    {
      label: 'Carbs',
      cal: split.carbCal,
      pct: split.pcts.carbs,
      color: 'var(--v2-accent-primary)',
    },
    {
      label: 'Protein',
      cal: split.proteinCal,
      pct: split.pcts.protein,
      color: 'var(--v2-accent-orange)',
    },
    {
      label: 'Fat',
      cal: split.fatCal,
      pct: split.pcts.fat,
      color: 'var(--v2-accent-warning)',
    },
  ]

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
            Where your calories come from
          </span>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Carbs and protein give 4 cal per gram; fat gives 9.
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
              key={r.label}
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
                  {r.label}
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
                color={r.color}
                ariaLabel={`${r.label} is ${Math.round(r.pct)} percent of macro calories`}
              />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
