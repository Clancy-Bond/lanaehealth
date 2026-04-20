/*
 * MyRecipesSection
 *
 * Server component. Lists user-built recipes (health_profile section
 * 'recipes'). The recipe detail / log-as-meal route is owned by Task
 * 10; this section displays per-serving calorie totals so the list is
 * useful even before the detail screen lands.
 */

import { ListRow, EmptyState } from '@/v2/components/primitives'
import { loadRecipes } from '@/lib/calories/recipes'

export default async function MyRecipesSection() {
  const log = await loadRecipes()

  if (log.entries.length === 0) {
    return (
      <EmptyState
        headline="No recipes yet"
        subtext="Build a recipe once, reuse it as a meal any time."
      />
    )
  }

  return (
    <div>
      {log.entries.map((r) => (
        <ListRow
          key={r.id}
          label={r.name}
          subtext={`${r.servings} serving${r.servings === 1 ? '' : 's'} / ${r.ingredients.length} ingredient${r.ingredients.length === 1 ? '' : 's'}`}
          trailing={
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-secondary)',
              }}
            >
              {Math.round(r.perServing.calories)}
              <span
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  marginLeft: 4,
                  fontWeight: 'var(--v2-weight-medium)',
                }}
              >
                cal/srv
              </span>
            </span>
          }
        />
      ))}
    </div>
  )
}
