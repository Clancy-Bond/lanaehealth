/*
 * FoodSearchResultRow
 *
 * ListRow specialization for a USDA search hit. Tap navigates to the
 * food detail screen with the active meal + date carried through.
 *
 * Calorie chip on the trailing side reads the per-result calorie value
 * the search API already returns; we never re-fetch nutrient data here.
 *
 * Photos (PR: v2-food-database-photos): when the parent passes a
 * `photoUrl`, render the actual product photo at the leading edge in
 * place of the colored letter badge. Photo lookup happens server-side
 * in the search page via `lookupFoodPhotos` (Open Food Facts), so this
 * component stays a pure render with no fetch. When no photo is found,
 * fall back to the colored letter badge from PR #64 -- the colored
 * rhythm is still preferable to a wall of text.
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

function FoodPhotoBadge({ url, alt }: { url: string; alt: string }) {
  // Plain <img> sidesteps next/image remote-host config; OFF's CDN does
  // its own resizing via the *_small_url variant. Reserve the box with
  // explicit width/height so layout is stable while the image loads
  // (no CLS). loading="lazy" + decoding="async" keep the long search
  // list from blocking initial paint.
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.04))',
        border: '1px solid var(--v2-border-subtle)',
      }}
    >
      <img
        src={url}
        alt={alt}
        width={32}
        height={32}
        loading="lazy"
        decoding="async"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  )
}

export default function FoodSearchResultRow({
  result,
  meal,
  date,
  photoUrl,
}: {
  result: FoodSearchResult
  meal: string
  date: string
  /** OFF-sourced photo URL when available; falls back to colored badge. */
  photoUrl?: string | null
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

  const leading = photoUrl
    ? <FoodPhotoBadge url={photoUrl} alt={result.description} />
    : <FoodIconBadge name={result.description} />

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
        leading={leading}
        label={result.description}
        subtext={subtext || undefined}
        trailing={trailing}
        chevron
      />
    </Link>
  )
}
