/*
 * MyMealsSection
 *
 * Server component. Lists saved meal templates (health_profile section
 * 'meal_templates'). A template is a frozen snapshot of a meal's food
 * rows. Tapping previews the template; the apply-to-day action is
 * surfaced from the per-row controls owned by a later task.
 */

import { ListRow, EmptyState } from '@/v2/components/primitives'
import { loadMealTemplates } from '@/lib/calories/meal-templates'

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export default async function MyMealsSection() {
  const log = await loadMealTemplates()

  if (log.entries.length === 0) {
    return (
      <EmptyState
        headline="No saved meals yet"
        subtext="Save any meal combo as a template and reuse it."
      />
    )
  }

  return (
    <div>
      {log.entries.map((t) => {
        const totalCals = t.items.reduce((acc, i) => acc + (i.calories ?? 0), 0)
        const mealLabel = MEAL_LABELS[t.meal] ?? t.meal
        const itemLabel = `${t.items.length} item${t.items.length === 1 ? '' : 's'}`
        return (
          <ListRow
            key={t.id}
            label={t.name}
            subtext={`${mealLabel} / ${itemLabel}`}
            trailing={
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-secondary)',
                }}
              >
                {Math.round(totalCals)}
                <span
                  style={{
                    fontSize: 'var(--v2-text-xs)',
                    color: 'var(--v2-text-muted)',
                    marginLeft: 4,
                    fontWeight: 'var(--v2-weight-medium)',
                  }}
                >
                  cal
                </span>
              </span>
            }
          />
        )
      })}
    </div>
  )
}
