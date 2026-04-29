/**
 * FoodSearchResultRow (MFN parity rewrite, 2026-04-27)
 *
 * Mirrors `docs/reference/mynetdiary/frames/full-tour/frame_0040.png`:
 *
 *   ▢   Meat beef filet **m**ignon          166 cals
 *       Freshdirect                          104g    ○
 *
 *   ▢   Filet **m**ignon                    166 cals
 *       Generic                              104g    ○
 *
 * - Square-ish rounded photo on the left (~44pt). When no OFF photo
 *   is available, fall back to the colored letter badge from PR #64.
 * - Two-line label: name (bolded fragments matching the query) + brand
 *   on a muted second line.
 * - Right side: stacked `X cals` (blue, semibold) over `Yg` (muted)
 *   in tabular-nums so columns line up across rows.
 * - Empty radio-style circle on the far right indicating "tap to log."
 *
 * The previous design used a generic ListRow + single-line trailing
 * cal label. User feedback (2026-04-27) on the broader calories
 * surface forced a per-component MFN-parity audit; this row was the
 * primary search-results affordance and visibly different from the
 * spec.
 *
 * Tap target stays at the row level (entire <Link>) so we don't lose
 * the easy thumb hit; the radio is decorative.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { FoodSearchResult } from '@/lib/api/usda-food'
import { emojiForFood } from '@/lib/api/food-emoji'

const PHOTO_SIZE = 44

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

/**
 * Visual badge for foods that don't have an Open Food Facts photo
 * (which is most USDA Foundation foods -- generic produce, meats,
 * dairy, eggs all return null from OFF).
 *
 * MFN ships a real food thumbnail for every result. We don't have
 * that image database. Two-tier fallback so the badge always reads as
 * "this is a category of food" rather than just "this is a letter":
 *
 *   1. Try emojiForFood() to map the name to a food-category emoji
 *      ("🥚" for eggs, "🍞" for bread, "🥩" for meat, etc.) -- covers
 *      ~70% of common foods, instant render, no API call.
 *   2. Fall back to the colored letter badge for uncategorized foods
 *      (rare ingredients, custom foods, anything the keyword map
 *      doesn't recognize).
 */
function FoodIconBadge({ name }: { name: string }) {
  const trimmed = name.trim()
  const palette = PALETTE[pickPaletteIndex(trimmed.toLowerCase())]
  const emoji = emojiForFood(trimmed)
  return (
    <div
      aria-hidden
      style={{
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: 8,
        background: palette.bg,
        border: `1px solid ${palette.ring}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: emoji ? 24 : 'var(--v2-text-base)',
        lineHeight: 1,
        fontWeight: emoji ? 'normal' : 'var(--v2-weight-bold)',
        color: palette.text,
        flexShrink: 0,
      }}
    >
      {emoji ?? (trimmed[0] ?? '?').toUpperCase()}
    </div>
  )
}

function FoodPhotoBadge({ url, alt }: { url: string; alt: string }) {
  return (
    <div
      style={{
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: 8,
        overflow: 'hidden',
        flexShrink: 0,
        background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.04))',
        border: '1px solid var(--v2-border-subtle)',
      }}
    >
      <img
        src={url}
        alt={alt}
        width={PHOTO_SIZE}
        height={PHOTO_SIZE}
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

/**
 * Highlight every case-insensitive occurrence of `query` inside
 * `text` by wrapping matched runs in `<strong>`. MFN's frame_0040
 * shows the typed letter "M" bolded inside both "Meat" and "mignon"
 * so we treat the query as a substring matcher, not a word-boundary
 * one.
 *
 * Empty / single-character query falls through to plain text.
 */
function highlightQuery(text: string, query: string): ReactNode {
  if (!query || query.length < 1) return text
  const q = query.trim()
  if (!q) return text
  // Escape regex metacharacters so the query "1.5%" doesn't blow up.
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(re)
  return parts.map((part, i) =>
    re.test(part) ? (
      <strong
        key={i}
        style={{ fontWeight: 'var(--v2-weight-bold)', color: 'var(--v2-text-primary)' }}
      >
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export default function FoodSearchResultRow({
  result,
  meal,
  date,
  photoUrl,
  query,
}: {
  result: FoodSearchResult
  meal: string
  date: string
  /** OFF-sourced photo URL when available; falls back to colored badge. */
  photoUrl?: string | null
  /** Active search query, for partial-match highlighting on the name. */
  query?: string
}) {
  const params = new URLSearchParams()
  if (meal) params.set('meal', meal)
  if (date) params.set('date', date)
  const queryString = params.toString()
  const href = `/v2/calories/food/${result.fdcId}${queryString ? `?${queryString}` : ''}`

  // Subtext is the brand line under the food name. MFN shows real
  // brand names ("Freshdirect", "maesri", "bibigo"); when no brand
  // exists, shows nothing or "Generic". USDA's dataType field
  // ("Foundation", "SR Legacy", "Survey (FNDDS)") is internal jargon
  // about which sub-database the food came from -- meaningless to a
  // user reading "Eggs, Grade A". Surface the brand when present;
  // otherwise show "Generic" so the row stays balanced visually
  // without leaking USDA terminology.
  const brand = (result.brandName ?? '').trim()
  const subtext = brand || 'Generic'

  const cals =
    typeof result.calories === 'number' && Number.isFinite(result.calories) && result.calories > 0
      ? Math.round(result.calories)
      : null
  const grams =
    typeof result.servingSize === 'number' && Number.isFinite(result.servingSize) && result.servingSize > 0
      ? Math.round(result.servingSize)
      : 100

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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          alignItems: 'center',
          gap: 'var(--v2-space-3)',
          padding: 'var(--v2-space-3) var(--v2-space-1)',
          borderBottom: '1px solid var(--v2-border-subtle)',
          minHeight: 64,
        }}
      >
        {leading}

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-secondary)',
              fontWeight: 'var(--v2-weight-regular)',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {highlightQuery(result.description, query ?? '')}
          </div>
          {subtext && (
            <div
              style={{
                marginTop: 2,
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtext}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-primary)',
              fontWeight: 'var(--v2-weight-semibold)',
              lineHeight: 1.2,
            }}
          >
            {cals !== null ? `${cals} cals` : '— cals'}
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              fontWeight: 'var(--v2-weight-medium)',
              lineHeight: 1.2,
            }}
          >
            {grams}g
          </span>
        </div>

        <RadioCircle />
      </div>
    </Link>
  )
}

/**
 * Empty radio circle. MFN's frame_0040 shows this dot on every
 * search result row as a tap target preview; in our app the entire
 * row is the link, so the circle is decorative — just visual parity.
 */
function RadioCircle() {
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: '1.5px solid var(--v2-border)',
        flexShrink: 0,
      }}
    />
  )
}
