/*
 * FavoritesSection
 *
 * Server component. Renders the user's starred foods (health_profile
 * section='food_favorites') as a tap-to-detail list. Empty state uses
 * NC voice and points the user back to the food detail screen where
 * favoriting actually happens.
 */

import Link from 'next/link'
import { ListRow, EmptyState } from '@/v2/components/primitives'
import { loadFavorites } from '@/lib/calories/favorites'

export default async function FavoritesSection({
  meal,
  date,
}: {
  meal: string
  date: string
}) {
  const log = await loadFavorites()

  if (log.entries.length === 0) {
    return (
      <EmptyState
        headline="No favorites yet"
        subtext="Heart a food from the detail screen to add it here."
      />
    )
  }

  const params = new URLSearchParams()
  if (meal) params.set('meal', meal)
  if (date) params.set('date', date)
  const query = params.toString()

  return (
    <div>
      {log.entries.map((f) => (
        <Link
          key={f.fdcId}
          href={`/v2/calories/food/${f.fdcId}${query ? `?${query}` : ''}`}
          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
          <ListRow
            label={f.name}
            subtext={`USDA fdcId ${f.fdcId}`}
            chevron
          />
        </Link>
      ))}
    </div>
  )
}
