/*
 * FoodSearchResultRow
 *
 * ListRow specialization for a USDA search hit. Tap navigates to the
 * food detail screen with the active meal + date carried through.
 *
 * Calorie chip on the trailing side reads the per-result calorie value
 * the search API already returns; we never re-fetch nutrient data here.
 */

import Link from 'next/link'
import { ListRow } from '@/v2/components/primitives'
import type { FoodSearchResult } from '@/lib/api/usda-food'

export default function FoodSearchResultRow({
  result,
  meal,
  date,
}: {
  result: FoodSearchResult
  meal: string
  date: string
}) {
  const params = new URLSearchParams()
  if (meal) params.set('meal', meal)
  if (date) params.set('date', date)
  const query = params.toString()
  const href = `/v2/calories/food/${result.fdcId}${query ? `?${query}` : ''}`

  const subtext = [result.brandName, result.dataType].filter(Boolean).join(' / ')

  const trailing =
    typeof result.calories === 'number' && Number.isFinite(result.calories) && result.calories > 0 ? (
      <span
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-secondary)',
        }}
      >
        {result.calories}
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

  return (
    <Link
      href={href}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
      }}
    >
      <ListRow
        label={result.description}
        subtext={subtext || undefined}
        trailing={trailing}
        chevron
      />
    </Link>
  )
}
