/*
 * MealDeletePreview
 *
 * Presentation-only preview of what a confirm-and-submit will
 * actually remove. Two modes:
 *
 *   single : one food row shown in a card. Used when the meal-delete
 *            page was routed to with an entry=<id> param.
 *   bulk   : list of all food rows for a (date, meal) pair.
 *
 * Kept in _components/ so the parent server page stays focused on
 * data-fetch + flow control.
 */
import { Card } from '@/v2/components/primitives'

export interface EntryPreview {
  id: string
  food_items: string | null
  calories: number | null
}

export interface MealDeletePreviewProps {
  mode: 'single' | 'bulk'
  single: EntryPreview | null
  entries: EntryPreview[]
  mealLabel: string
}

export default function MealDeletePreview({
  mode,
  single,
  entries,
  mealLabel,
}: MealDeletePreviewProps) {
  if (mode === 'single') {
    if (!single) {
      return (
        <Card padding="md">
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            That item is already gone. Nothing to remove.
          </p>
        </Card>
      )
    }
    return (
      <Card padding="md">
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
              color: 'var(--v2-text-primary)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            {single.food_items?.trim() || '(unnamed)'}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {Math.round(single.calories ?? 0)} cal
          </span>
        </div>
      </Card>
    )
  }

  // bulk
  return (
    <Card padding="md">
      {entries.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          Nothing logged for {mealLabel.toLowerCase()} yet. Nothing to remove.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-2)',
          }}
        >
          {entries.map((e) => (
            <li
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 'var(--v2-space-3)',
                fontSize: 'var(--v2-text-sm)',
              }}
            >
              <span style={{ color: 'var(--v2-text-primary)' }}>
                {e.food_items?.trim() || '(unnamed)'}
              </span>
              <span
                style={{
                  color: 'var(--v2-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {Math.round(e.calories ?? 0)} cal
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
