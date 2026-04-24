/*
 * FoodSearchResultRow
 *
 * ListRow specialization for a USDA search hit. Tap navigates to the
 * food detail screen with the active meal + date carried through.
 *
 * Calorie chip on the trailing side reads the per-result calorie value
 * the search API already returns; we never re-fetch nutrient data here.
 *
 * MFN parity (PR: v2-calories-mfn-fidelity-2): each row gets a small
 * colored circular icon at the leading edge keyed off the food name's
 * first letter, mimicking MyNetDiary's per-row visual rhythm. Real
 * food photos would require an image pipeline; the colored letter
 * badge is the lightweight stand-in. Color hash makes the rows scan
 * as a visually-textured list, not a wall of text.
 */

import Link from 'next/link'
import { ListRow } from '@/v2/components/primitives'
import type { FoodSearchResult } from '@/lib/api/usda-food'

const PALETTE: Array<{ bg: string; ring: string; text: string }> = [
  { bg: 'rgba(229, 201, 82, 0.18)', ring: 'rgba(229, 201, 82, 0.55)', text: '#E5C952' },
  { bg: 'rgba(77, 184, 168, 0.18)', ring: 'rgba(77, 184, 168, 0.55)', text: '#4DB8A8' },
  { bg: 'rgba(183, 156, 217, 0.20)', ring: 'rgba(183, 156, 217, 0.60)', text: '#B79CD9' },
  { bg: 'rgba(232, 168, 124, 0.18)', ring: 'rgba(232, 168, 124, 0.55)', text: '#E8A87C' },
  { bg: 'rgba(140, 198, 119, 0.18)', ring: 'rgba(140, 198, 119, 0.55)', text: '#8CC677' },
  { bg: 'rgba(220, 130, 130, 0.18)', ring: 'rgba(220, 130, 130, 0.55)', text: '#DC8282' },
]

function pickPaletteIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return hash % PALETTE.length
}

function FoodIconBadge({ name }: { name: string }) {
  const trimmed = name.trim()
  const letter = (trimmed[0] ?? '?').toUpperCase()
  const palette = PALETTE[pickPaletteIndex(trimmed.toLowerCase())]
  return (
    <div
      aria-hidden
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: palette.bg,
        border: `1px solid ${palette.ring}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--v2-text-sm)',
        fontWeight: 'var(--v2-weight-bold)',
        color: palette.text,
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  )
}

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
        leading={<FoodIconBadge name={result.description} />}
        label={result.description}
        subtext={subtext || undefined}
        trailing={trailing}
        chevron
      />
    </Link>
  )
}
