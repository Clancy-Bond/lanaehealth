/*
 * RecentMealsSection
 *
 * Server component. Pulls the last 7 days of food_entries, dedupes by
 * normalized food key (so "Oatmeal" and " oatmeal" don't both list),
 * orders by most recent log. Tap routes back into Search with the
 * food name pre-filled : the same pattern legacy uses.
 *
 * Limited to 30 unique entries to keep the list scannable on mobile.
 */

import Link from 'next/link'
import { format } from 'date-fns'
import { ListRow, EmptyState } from '@/v2/components/primitives'
import { getFoodEntriesByDateRange, normalizeFoodKey } from '@/lib/api/food'

const MAX_ROWS = 30

interface RecentEntry {
  id: string
  display: string
  meal: string
  loggedAt: string
  calories: number | null
}

export default async function RecentMealsSection({ meal }: { meal: string }) {
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const weekAgoIso = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  let recents: RecentEntry[] = []
  try {
    const rows = await getFoodEntriesByDateRange(weekAgoIso, todayIso)
    const seen = new Set<string>()
    const collected: RecentEntry[] = []
    for (const r of rows) {
      const display = (r.food_items ?? '').trim()
      if (!display) continue
      const key = normalizeFoodKey(display)
      if (seen.has(key)) continue
      seen.add(key)
      collected.push({
        id: r.id,
        display,
        meal: r.meal_type ?? 'meal',
        loggedAt: r.logged_at,
        calories: r.calories ?? null,
      })
      if (collected.length >= MAX_ROWS) break
    }
    recents = collected
  } catch {
    recents = []
  }

  if (recents.length === 0) {
    return (
      <EmptyState
        headline="No recent meals yet"
        subtext="Past meals will appear here once you've logged a few."
      />
    )
  }

  return (
    <div>
      {recents.map((r) => {
        const params = new URLSearchParams({
          view: 'search',
          q: r.display,
        })
        if (meal) params.set('meal', meal)
        const subParts: string[] = []
        if (r.meal) {
          subParts.push(r.meal.charAt(0).toUpperCase() + r.meal.slice(1))
        }
        try {
          subParts.push(format(new Date(r.loggedAt), 'MMM d'))
        } catch {
          // ignore parse errors so a single bad row never breaks the list
        }
        return (
          <Link
            key={r.id}
            href={`/v2/calories/search?${params.toString()}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <ListRow
              label={r.display}
              subtext={subParts.join(' / ')}
              trailing={
                typeof r.calories === 'number' ? (
                  <span
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 'var(--v2-weight-semibold)',
                      color: 'var(--v2-text-secondary)',
                    }}
                  >
                    {Math.round(r.calories)}
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
                ) : null
              }
              chevron
            />
          </Link>
        )
      })}
    </div>
  )
}
