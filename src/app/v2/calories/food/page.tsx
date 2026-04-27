/*
 * LEARNING-MODE HOOK G5: Food log meal-row interaction.
 *
 * Option A (inline quick-add, ship): MealSectionCard's inline "Add to
 *   breakfast" row at bottom of each meal handles fast additions.
 *   FAB on dashboard also works; food log itself just surfaces items.
 *
 * Option B (Sheet launcher): tap any row to open a Sheet for portion
 *   tweaks. Adds a slower but more precise per-entry edit path.
 *
 * Swap: replace MealSectionCard's `onAdd` prop with a Sheet launcher wrapper.
 */
import Link from 'next/link'
import { format } from 'date-fns'
import { createServiceClient } from '@/lib/supabase'
import { runScopedQuery } from '@/lib/auth/scope-query'
import { getCurrentUser } from '@/lib/auth/get-user'
import { getDayTotals } from '@/lib/calories/home-data'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { EmptyState, Button } from '@/v2/components/primitives'
import MealSectionCard, {
  type MealSectionEntry,
} from '../_components/MealSectionCard'
import FoodLogAllMealsHeader, {
  type MealFilter,
} from './_components/FoodLogAllMealsHeader'
import DayTotalsSummary from './_components/DayTotalsSummary'
import MfnAllMealsList from './_components/MfnAllMealsList'
import CaloriesLoadError from '../_components/CaloriesLoadError'
import RefreshRouter from '../../_components/RefreshRouter'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MEAL_FILTERS: MealFilter[] = ['all', 'breakfast', 'lunch', 'dinner', 'snack']

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function parseDate(raw: string | undefined): string {
  if (!raw) return todayISO()
  return DATE_RE.test(raw) ? raw : todayISO()
}

function parseMeal(raw: string | undefined): MealFilter {
  if (!raw) return 'all'
  return (MEAL_FILTERS as string[]).includes(raw) ? (raw as MealFilter) : 'all'
}

const MEAL_ORDER: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'> = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]

const MEAL_LABELS: Record<
  (typeof MEAL_ORDER)[number],
  'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

interface FoodEntryRow {
  id: string
  meal_type: string | null
  food_items: string | null
  calories: number | null
  macros: Record<string, number> | null
  logged_at: string
}

type MealBuckets = Record<(typeof MEAL_ORDER)[number], MealSectionEntry[]>

function emptyBuckets(): MealBuckets {
  return { breakfast: [], lunch: [], dinner: [], snack: [] }
}

function bucketByMeal(entries: FoodEntryRow[]): MealBuckets {
  const buckets = emptyBuckets()
  for (const e of entries) {
    const key = (
      (e.meal_type ?? 'snack').toLowerCase() as (typeof MEAL_ORDER)[number]
    )
    const bucket = key in buckets ? buckets[key] : buckets.snack
    bucket.push({
      id: e.id,
      food_items: e.food_items,
      calories: e.calories,
      macros: e.macros,
    })
  }
  return buckets
}

const BACK_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 'var(--v2-touch-target-min)',
  minHeight: 'var(--v2-touch-target-min)',
  color: 'var(--v2-text-secondary)',
  textDecoration: 'none',
}

const SEARCH_STYLE: React.CSSProperties = {
  color: 'var(--v2-accent-primary)',
  fontSize: 'var(--v2-text-sm)',
  fontWeight: 'var(--v2-weight-semibold)',
  padding: 'var(--v2-space-2)',
  textDecoration: 'none',
  minHeight: 'var(--v2-touch-target-min)',
  display: 'inline-flex',
  alignItems: 'center',
}

function totalsPerMeal(buckets: MealBuckets) {
  return {
    breakfast: buckets.breakfast.reduce((a, e) => a + (e.calories ?? 0), 0),
    lunch: buckets.lunch.reduce((a, e) => a + (e.calories ?? 0), 0),
    dinner: buckets.dinner.reduce((a, e) => a + (e.calories ?? 0), 0),
    snack: buckets.snack.reduce((a, e) => a + (e.calories ?? 0), 0),
  }
}

export default async function V2CaloriesFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; meal?: string }>
}) {
  const params = await searchParams
  const viewDate = parseDate(params.date)
  const todayIso = todayISO()
  const mealFilter = parseMeal(params.meal)

  const sb = createServiceClient()
  const user = await getCurrentUser()
  const userId = user?.id ?? null

  // Wrap loaders so a transient supabase/network failure renders inside
  // v2 chrome rather than Next's default error boundary.
  let totals: Awaited<ReturnType<typeof getDayTotals>>
  let logId: string | null
  let foodEntries: FoodEntryRow[]
  try {
    const [totalsRes, logRow] = await Promise.all([
      getDayTotals(viewDate, userId),
      runScopedQuery({
        table: 'daily_logs',
        userId,
        withFilter: () =>
          sb
            .from('daily_logs')
            .select('id, date')
            .eq('date', viewDate)
            .eq('user_id', userId as string)
            .maybeSingle(),
        withoutFilter: () =>
          sb
            .from('daily_logs')
            .select('id, date')
            .eq('date', viewDate)
            .maybeSingle(),
      }),
    ])
    totals = totalsRes
    logId = (logRow.data as { id: string } | null)?.id ?? null
    foodEntries = logId
      ? await sb
          .from('food_entries')
          .select('id, meal_type, food_items, calories, macros, logged_at')
          .eq('log_id', logId)
          .order('logged_at', { ascending: true })
          .then((res) => ((res.data ?? []) as unknown) as FoodEntryRow[])
      : []
  } catch {
    return (
      <MobileShell top={<TopAppBar title="All meals" />}>
        <CaloriesLoadError
          headline="We couldn't load your meals"
          body="Usually a network blip. Try again in a moment."
          retryHref={`/v2/calories/food?date=${viewDate}`}
        />
      </MobileShell>
    )
  }

  const buckets = bucketByMeal(foodEntries)
  const perMealCalories = totalsPerMeal(buckets)
  const dayIsEmpty = foodEntries.length === 0

  const backHref = `/v2/calories?date=${viewDate}`
  const searchHref = `/v2/calories/search?date=${viewDate}`

  const leading = (
    <Link href={backHref} aria-label="Back to calories" style={BACK_STYLE}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
  const trailing = (
    <Link href={searchHref} aria-label="Search foods" style={SEARCH_STYLE}>
      Search
    </Link>
  )

  return (
    <MobileShell top={<TopAppBar title="All meals" leading={leading} trailing={trailing} />}>
      <RefreshRouter>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-5)',
            padding: 'var(--v2-space-4)',
            paddingBottom: 'var(--v2-space-12)',
          }}
        >
          <DayTotalsSummary
          date={viewDate}
          todayISO={todayIso}
          totalCalories={totals.calories}
          perMealCalories={perMealCalories}
        />

        <FoodLogAllMealsHeader date={viewDate} initialMeal={mealFilter} />

        {dayIsEmpty ? (
          <EmptyState
            headline="Nothing logged yet"
            subtext="Tap the plus to start your first meal. Breakfast, lunch, dinner, or a snack all count."
            cta={
              <Link href={searchHref} style={{ textDecoration: 'none' }}>
                <Button variant="primary">Add a meal</Button>
              </Link>
            }
          />
        ) : mealFilter === 'all' ? (
          /* MFN parity (frame_0035): flat list with gray-pill section
             headers and item rows showing photo / name / cals over
             portion. Replaces the boxed MealSectionCard stack which
             was correct for the dashboard inline-log surface but
             wrong for the All Meals inventory view. */
          <MfnAllMealsList
            date={viewDate}
            buckets={buckets}
            perMealCalories={perMealCalories}
          />
        ) : (
          /* Single-meal filter view: keep the dashboard's
             MealSectionCard (with kebab edit + inline add row) since
             this is essentially "edit one meal in detail" - the
             filter pill picks one meal and the user expects the
             dashboard-style affordances. */
          <MealSectionCard
            meal={mealFilter}
            label={MEAL_LABELS[mealFilter]}
            date={viewDate}
            entries={buckets[mealFilter]}
          />
        )}
        </div>
      </RefreshRouter>
    </MobileShell>
  )
}
