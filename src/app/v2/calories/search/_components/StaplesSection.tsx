/*
 * StaplesSection
 *
 * Server component. "Staples" = the foods Lanae actually leans on
 * day-to-day: starred favorites first (explicit signal), then the
 * top frequent items per meal type (implicit signal). Deduped by
 * normalized food key so a starred + frequently-logged item appears
 * once.
 *
 * Each row taps back into Search with the staple's name pre-filled,
 * which keeps the data path honest: we re-resolve through USDA so
 * the user picks the exact match they want. Capped at 10.
 */

import Link from 'next/link'
import { ListRow, EmptyState } from '@/v2/components/primitives'
import { loadFavorites } from '@/lib/calories/favorites'
import { getFrequentMealsByType, normalizeFoodKey } from '@/lib/api/food'

interface Staple {
  display: string
  href: string
  subtext: string
}

export default async function StaplesSection({ meal }: { meal: string }) {
  let staples: Staple[] = []
  try {
    const [favLog, frequentByMeal] = await Promise.all([
      loadFavorites(),
      getFrequentMealsByType(90, 5),
    ])

    const seen = new Set<string>()
    const collected: Staple[] = []

    for (const fav of favLog.entries) {
      const key = normalizeFoodKey(fav.name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      collected.push({
        display: fav.name,
        href: `/v2/calories/food/${fav.fdcId}${meal ? `?meal=${meal}` : ''}`,
        subtext: 'Favorite',
      })
    }

    const frequentRows = (
      ['breakfast', 'lunch', 'dinner', 'snack'] as const
    ).flatMap((m) => frequentByMeal[m].map((fm) => ({ ...fm, mealKey: m })))

    frequentRows.sort((a, b) => b.count - a.count)

    for (const fm of frequentRows) {
      const key = normalizeFoodKey(fm.food_items)
      if (!key || seen.has(key)) continue
      seen.add(key)
      collected.push({
        display: fm.food_items,
        href: `/v2/calories/search?view=search&q=${encodeURIComponent(fm.food_items)}${meal ? `&meal=${meal}` : ''}`,
        subtext: `Logged ${fm.count} time${fm.count === 1 ? '' : 's'}`,
      })
    }

    staples = collected.slice(0, 10)
  } catch {
    staples = []
  }

  if (staples.length === 0) {
    return (
      <EmptyState
        headline="No staples yet"
        subtext="Your staple foods will show up here once you've logged a few."
      />
    )
  }

  return (
    <div>
      {staples.map((s) => (
        <Link
          key={s.href + s.display}
          href={s.href}
          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
          <ListRow label={s.display} subtext={s.subtext} chevron />
        </Link>
      ))}
    </div>
  )
}
