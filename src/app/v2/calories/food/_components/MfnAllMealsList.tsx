/**
 * MfnAllMealsList
 *
 * MFN parity surface for /v2/calories/food. Mirrors
 * `docs/reference/mynetdiary/frames/full-tour/frame_0035.png`:
 *
 *   ▤ Breakfast              502 cals
 *   🥯 Organic matcha green tea   2 tsp
 *   🥛 Organic lactose free milk  33 cals · 2 fl oz
 *   🍯 Raw and organic honey     60 cals · 1 tbsp
 *   ▤ Lunch                  204 cals
 *   🥬 Mates original cheese      204 cals · 44 g
 *   ▤ Dinner                 720 cals
 *   ...
 *
 * Flat list with gray section-pill headers (NOT boxed cards).
 * Each item row: photo / name / right-stacked cals over portion.
 *
 * Why a NEW component instead of editing MealSectionCard:
 * - MealSectionCard (566 lines) is the dashboard-inline meal card
 *   with expand/collapse + kebab edit sheets + add row. Lanae uses
 *   it on /v2/calories to log without leaving the dashboard.
 * - frame_0035 (All Meals view) is a different read-only inventory
 *   pattern: flat list, no inline log row, nav-driven log via the
 *   per-meal "+" affordance. Keeping the two component shapes
 *   separate prevents the dashboard from regressing when we polish
 *   the All Meals view and vice versa.
 *
 * Tap targets:
 * - Tapping an item row navigates to /v2/calories/food/[fdcId] (or
 *   the legacy edit route when no fdcId is present on the entry)
 *   so the user can adjust the portion.
 * - The "+" pill at the right of each section header opens
 *   /v2/calories/search?meal=<meal>&date=<date>.
 *
 * Data: receives the same buckets the existing page already
 * computes; no new server queries.
 */

import Link from 'next/link'

export interface AllMealsEntry {
  id: string
  food_items: string | null
  calories: number | null
  macros: Record<string, number> | null
  photoUrl?: string | null
  /** Optional fdcId so item rows can deep-link into the food detail
   *  page. Entries without an fdcId (legacy entries logged before
   *  the USDA-FDC shift) tap into the legacy edit route instead. */
  fdcId?: number | null
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

export interface MfnAllMealsListProps {
  date: string
  buckets: Record<Meal, AllMealsEntry[]>
  /**
   * Total calories per meal. Pass pre-rounded numbers; we just
   * format with toLocaleString (commas, no fractional). Keeps the
   * component pure (no number-cruncher inside).
   */
  perMealCalories: Record<Meal, number>
}

export default function MfnAllMealsList({
  date,
  buckets,
  perMealCalories,
}: MfnAllMealsListProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        // No gap — sections butt against each other; the gray pill
        // header is what visually separates them.
      }}
    >
      {MEAL_ORDER.map((meal) => (
        <MealSection
          key={meal}
          meal={meal}
          date={date}
          entries={buckets[meal]}
          totalCalories={perMealCalories[meal]}
        />
      ))}
    </div>
  )
}

function MealSection({
  meal,
  date,
  entries,
  totalCalories,
}: {
  meal: Meal
  date: string
  entries: AllMealsEntry[]
  totalCalories: number
}) {
  const isEmpty = entries.length === 0
  const addHref = `/v2/calories/search?meal=${meal}&date=${date}`

  return (
    <section aria-label={MEAL_LABELS[meal]}>
      {/* Gray pill section header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-3)',
          padding: 'var(--v2-space-3) var(--v2-space-4)',
          background: 'var(--v2-bg-surface)',
          borderTop: '1px solid var(--v2-border-subtle)',
          borderBottom: '1px solid var(--v2-border-subtle)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-bold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          {MEAL_LABELS[meal]}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-3)' }}>
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-primary)',
              fontWeight: 'var(--v2-weight-semibold)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(totalCalories).toLocaleString()} cals
          </span>
          <Link
            href={addHref}
            aria-label={`Add to ${MEAL_LABELS[meal]}`}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--v2-accent-primary)',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 18,
              lineHeight: 1,
              fontWeight: 'var(--v2-weight-bold)',
            }}
          >
            +
          </Link>
        </div>
      </header>

      {/* Empty state for the meal */}
      {isEmpty ? (
        <Link
          href={addHref}
          style={{
            display: 'block',
            padding: 'var(--v2-space-4)',
            color: 'var(--v2-text-muted)',
            fontSize: 'var(--v2-text-sm)',
            textDecoration: 'none',
            background: 'var(--v2-bg-card)',
            borderBottom: '1px solid var(--v2-border-subtle)',
          }}
        >
          Tap to add a food.
        </Link>
      ) : (
        entries.map((entry) => <ItemRow key={entry.id} entry={entry} date={date} meal={meal} />)
      )}
    </section>
  )
}

function ItemRow({
  entry,
  date,
  meal,
}: {
  entry: AllMealsEntry
  date: string
  meal: Meal
}) {
  const { name, portion } = splitFoodLabel(entry.food_items ?? 'Food')
  const cals = entry.calories !== null ? Math.round(entry.calories) : null
  // Item rows tap into the food-detail page when we have an fdcId.
  // Otherwise the entry is a legacy custom log; route to the
  // existing edit flow (which the existing /v2/calories meal-edit
  // sheet handles via search-param mode=edit on the dashboard).
  const href = entry.fdcId
    ? `/v2/calories/food/${entry.fdcId}?meal=${meal}&date=${date}`
    : `/v2/calories?date=${date}&edit=${encodeURIComponent(entry.id)}`

  return (
    <Link
      href={href}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-3) var(--v2-space-4)',
        background: 'var(--v2-bg-card)',
        borderBottom: '1px solid var(--v2-border-subtle)',
        textDecoration: 'none',
        color: 'inherit',
        minHeight: 56,
      }}
    >
      <ItemPhoto url={entry.photoUrl ?? null} name={name} />
      <span
        style={{
          fontSize: 'var(--v2-text-base)',
          color: 'var(--v2-text-primary)',
          fontWeight: 'var(--v2-weight-regular)',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {name}
      </span>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {cals !== null && (
          <span
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-accent-primary)',
              fontWeight: 'var(--v2-weight-semibold)',
              lineHeight: 1.2,
            }}
          >
            {cals.toLocaleString()} cals
          </span>
        )}
        {portion && (
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              fontWeight: 'var(--v2-weight-medium)',
              lineHeight: 1.2,
            }}
          >
            {portion}
          </span>
        )}
      </div>
    </Link>
  )
}

function ItemPhoto({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        width={36}
        height={36}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.04))',
          border: '1px solid var(--v2-border-subtle)',
        }}
      />
    )
  }
  // Letter-badge fallback. Smaller than the search row (36 vs 44)
  // since the All Meals list packs more rows per screen.
  const letter = (name.trim()[0] ?? '?').toUpperCase()
  return (
    <div
      aria-hidden
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'rgba(77, 184, 168, 0.18)',
        border: '1px solid rgba(77, 184, 168, 0.55)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--v2-text-sm)',
        fontWeight: 'var(--v2-weight-bold)',
        color: '#4DB8A8',
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  )
}

/**
 * Same parser MealSectionCard uses, duplicated here so this component
 * stays self-contained. food_items strings come in three flavors:
 *   "Apple, raw (1x 1 medium 118g)"   USDA + portion + grams
 *   "Bananas (118g)"                  USDA + grams only
 *   "Peanut butter, Skippy (32g)"     USDA + brand + grams
 * The trailing parenthesized group becomes the right-side portion
 * line on the row; the rest is the name.
 */
function splitFoodLabel(raw: string): { name: string; portion: string | null } {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(.*)\(([^()]*)\)\s*$/)
  if (!match) return { name: trimmed, portion: null }
  const [, namePart, portionPart] = match
  const cleanName = namePart.trim().replace(/[,\s]+$/, '')
  const cleanPortion = portionPart.trim()
  if (!cleanName) return { name: trimmed, portion: null }
  return { name: cleanName, portion: cleanPortion || null }
}
