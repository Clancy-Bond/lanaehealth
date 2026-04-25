/*
 * MyRecipesSection
 *
 * Server component. Lists every recipe the user has saved, regardless
 * of source: imported from Edamam, parsed from a URL, or hand-built.
 * Edamam + URL imports live in user_recipes (Migration 039); the
 * legacy hand-built recipes still live in
 * health_profile.section='recipes'.
 */

import Link from 'next/link'
import { ListRow, EmptyState } from '@/v2/components/primitives'
import { loadRecipes } from '@/lib/calories/recipes'
import { listSavedRecipes } from '@/lib/api/recipes'

export default async function MyRecipesSection() {
  const [external, log] = await Promise.all([listSavedRecipes(), loadRecipes()])

  const items = [
    ...external.map((r) => ({
      id: r.id,
      name: r.name,
      caloriesPerServing: r.caloriesPerServing,
      servings: r.servings,
      ingredientCount: r.ingredients.length,
      source: r.source,
    })),
    ...log.entries.map((r) => ({
      id: r.id,
      name: r.name,
      caloriesPerServing: Math.round(r.perServing.calories),
      servings: r.servings,
      ingredientCount: r.ingredients.length,
      source: 'user_custom' as const,
    })),
  ]

  if (items.length === 0) {
    return (
      <EmptyState
        headline="No recipes yet"
        subtext="Search 2.3M recipes, paste a URL, or build your own."
      />
    )
  }

  return (
    <div>
      {items.map((r) => (
        <Link
          key={`${r.source}_${r.id}`}
          href={`/v2/calories/recipes/${encodeURIComponent(r.id)}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <ListRow
            label={r.name}
            subtext={`${r.servings} serving${r.servings === 1 ? '' : 's'} / ${r.ingredientCount} ingredient${r.ingredientCount === 1 ? '' : 's'}`}
            trailing={
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 'var(--v2-weight-semibold)',
                  color: 'var(--v2-text-secondary)',
                }}
              >
                {r.caloriesPerServing}
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
        </Link>
      ))}
    </div>
  )
}
