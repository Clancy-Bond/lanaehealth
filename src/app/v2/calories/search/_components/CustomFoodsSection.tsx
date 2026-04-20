/*
 * CustomFoodsSection
 *
 * Server component. Lists user-created foods (health_profile section
 * 'custom_foods'). The detail route for a custom food is owned by
 * Task 10; in the meantime taps loop the user back into search with
 * the food's name pre-filled so they can still find a USDA stand-in
 * if needed. The +New action lives on the legacy /calories route for
 * now.
 */

import Link from 'next/link'
import { ListRow, EmptyState } from '@/v2/components/primitives'
import { loadCustomFoods } from '@/lib/calories/custom-foods'

export default async function CustomFoodsSection({ meal }: { meal: string }) {
  const log = await loadCustomFoods()

  if (log.entries.length === 0) {
    return (
      <EmptyState
        headline="No custom foods yet"
        subtext="Add recipes the grocery store doesn't carry."
      />
    )
  }

  return (
    <div>
      {log.entries.map((f) => {
        const params = new URLSearchParams({
          view: 'search',
          q: f.name,
        })
        if (meal) params.set('meal', meal)
        return (
          <Link
            key={f.id}
            href={`/v2/calories/search?${params.toString()}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <ListRow
              label={f.name}
              subtext={f.servingLabel}
              trailing={
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 'var(--v2-weight-semibold)',
                    color: 'var(--v2-text-secondary)',
                  }}
                >
                  {Math.round(f.calories)}
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
              chevron
            />
          </Link>
        )
      })}
    </div>
  )
}
