/*
 * DayTotalsSummary
 *
 * Compact summary card shown above the meal filter: the day's total
 * calories as headline, plus a row of mini-chips for each meal's
 * calorie subtotal. Server-rendered from getDayTotals plus the
 * bucketed entries, so it paints instantly and stays in sync with
 * the MealSectionCards below.
 *
 * NC voice: sentence-case eyebrow ("Today") and comma-formatted
 * numbers. Zero-days render gently, no scolding.
 */
import { Card } from '@/v2/components/primitives'

export interface DayTotalsSummaryProps {
  date: string
  todayISO: string
  totalCalories: number
  perMealCalories: {
    breakfast: number
    lunch: number
    dinner: number
    snack: number
  }
}

const MINI_CHIPS: Array<{
  key: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  label: string
}> = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
]

function formatCal(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

function eyebrowFor(date: string, todayISO: string): string {
  if (date === todayISO) return 'Today'
  // Parse YYYY-MM-DD as local so there's no timezone drift.
  const [y, m, d] = date.split('-').map(Number)
  const local = new Date(y, (m ?? 1) - 1, d ?? 1)
  return local.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function DayTotalsSummary({
  date,
  todayISO,
  totalCalories,
  perMealCalories,
}: DayTotalsSummaryProps) {
  const eyebrow = eyebrowFor(date, todayISO)

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-1)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              color: 'var(--v2-text-muted)',
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              color: 'var(--v2-text-primary)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 'var(--v2-tracking-tight)',
            }}
          >
            {formatCal(totalCalories)} cal
          </span>
        </div>

        <ul
          aria-label="Meal calorie subtotals"
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--v2-space-2)',
          }}
        >
          {MINI_CHIPS.map((chip) => (
            <li key={chip.key}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--v2-space-1)',
                  padding: 'var(--v2-space-1) var(--v2-space-2)',
                  background: 'var(--v2-bg-elevated)',
                  border: '1px solid var(--v2-border-subtle)',
                  borderRadius: 'var(--v2-radius-full)',
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ color: 'var(--v2-text-muted)' }}>{chip.label}</span>
                <span style={{ color: 'var(--v2-text-primary)', fontWeight: 'var(--v2-weight-semibold)' }}>
                  {formatCal(perMealCalories[chip.key])}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
