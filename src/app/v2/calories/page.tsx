import Link from 'next/link'
import { addDays, format, startOfDay } from 'date-fns'
import { createServiceClient } from '@/lib/supabase'
import { loadNutritionGoals } from '@/lib/calories/goals'
import { getDayTotals, getDailyTotalsRange } from '@/lib/calories/home-data'
import { loadWeightLog, latestEntry, kgToLb } from '@/lib/calories/weight'
import { loadWaterLog, glassesForDate } from '@/lib/calories/water'
import { loadActivityForDate } from '@/lib/calories/activity'
import { lookupFoodPhotosByName } from '@/lib/api/food-photo'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Banner } from '@/v2/components/primitives'
import CalorieRingHero from './_components/CalorieRingHero'
import DateNavWeekStrip from './_components/DateNavWeekStrip'
import CaloriesReadinessBanner from './_components/CaloriesReadinessBanner'
import MacroTilesRow from './_components/MacroTilesRow'
import MealSectionCard, { type MealSectionEntry } from './_components/MealSectionCard'
import WeeklyCalorieSparkline from './_components/WeeklyCalorieSparkline'
import DashboardSideTiles from './_components/DashboardSideTiles'
import QuickLogFabV2 from './_components/QuickLogFabV2'
import CaloriesLoadError from './_components/CaloriesLoadError'
import CorrectionsPanel from '@/v2/components/CorrectionsPanel'

export const dynamic = 'force-dynamic'

/*
 * LEARNING-MODE HOOK G4: Ring-first vs prompt-first on Calories.
 *
 * Cycle (G1) hybridized a ring hero with a period prompt immediately
 * beneath because missed period logs starve every downstream
 * prediction. Calories is different: food logs are entered as they
 * happen, not retroactively; the dashboard's primary job is to
 * reflect the day's trajectory at a glance.
 *
 *   Option A (ring-first, Oura):  big hero ring is the first thing
 *     the eye finds. Remaining or Over reads as the headline.
 *     Risks feeling cold when the day has no data logged yet.
 *
 *   Option B (prompt-first, NC):  a log prompt / readiness chip
 *     above the ring. Catches fasting days and skipped meals early.
 *     Risks burying the brand moment.
 *
 * Default below: ring-first, confirmed by user for Session 02. The
 * readiness banner slides above the ring only when Oura has a score
 * for this date; otherwise the ring is the first card, unobstructed.
 * Swap the readiness block and ring block to go prompt-first. The
 * empty-ring state ("0 cal") was retuned for this choice to feel
 * like an invitation rather than a failure.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function parseDateParam(raw: string | undefined): string {
  if (!raw) return todayISO()
  return DATE_RE.test(raw) ? raw : todayISO()
}

interface FoodEntryRow {
  id: string
  log_id: string
  meal_type: string | null
  food_items: string | null
  calories: number | null
  macros: Record<string, number> | null
  logged_at: string
}

interface DailyLogLite {
  id: string
  date: string
  notes: string | null
}

const MEAL_ORDER: Array<'breakfast' | 'lunch' | 'dinner' | 'snack'> = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]

const MEAL_LABELS: Record<(typeof MEAL_ORDER)[number], 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

/*
 * Time-of-day relevance: only the current meal opens expanded; the
 * other three render as single tappable rows. Matches Oura's pattern
 * of showing the relevant signal now and keeping deeper detail one
 * tap away. Windows are simple wall-clock buckets, not strict; if
 * Lanae logs lunch at 11am the snack expansion at midnight still
 * makes sense for late-night browsing.
 *
 * Server-side hour matches the existing pattern on /v2 home
 * (page.tsx uses `new Date().getHours()` directly).
 */
function currentMealForHour(hour: number): (typeof MEAL_ORDER)[number] {
  if (hour >= 4 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 15) return 'lunch'
  if (hour >= 15 && hour < 21) return 'dinner'
  return 'snack'
}

function bucketByMeal(entries: FoodEntryRow[]): Record<(typeof MEAL_ORDER)[number], MealSectionEntry[]> {
  const buckets: Record<(typeof MEAL_ORDER)[number], MealSectionEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  }
  for (const e of entries) {
    const key = ((e.meal_type ?? 'snack').toLowerCase() as (typeof MEAL_ORDER)[number])
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

export default async function V2CaloriesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const params = await searchParams
  const viewDate = parseDateParam(params.date)
  const todayIso = todayISO()
  const isToday = viewDate === todayIso

  // 7-day window ending on viewDate, for the sparkline + strip
  // micro-indicators. The strip spans 9 days, but we only fetch 7
  // of totals (past 6 + today) for the rhythm chart. The extra 2
  // future strip cells remain "0" until data arrives.
  const anchor = startOfDay(new Date(viewDate + 'T00:00:00'))
  const sevenAgoISO = format(addDays(anchor, -6), 'yyyy-MM-dd')
  const stripStartISO = format(addDays(anchor, -4), 'yyyy-MM-dd')
  const stripEndISO = format(addDays(anchor, 4), 'yyyy-MM-dd')

  const sb = createServiceClient()

  // Parallel fetches: every downstream render path wants at least
  // one of these before painting. Wrapped in try/catch so a network
  // blip or transient supabase error renders inside v2 chrome rather
  // than Next's default error boundary (CLAUDE.md: medical app, keep
  // the user oriented even when data loading fails).
  let goals, dayTotals, weekTotals, stripTotals, weightLog, waterLog, activity
  let ouraRow: { data: { readiness_score: number | null; sleep_score: number | null } | null }
  let logRow: { data: DailyLogLite | null }
  let foodEntries: FoodEntryRow[]
  try {
    ;[
      goals,
      dayTotals,
      weekTotals,
      stripTotals,
      weightLog,
      waterLog,
      activity,
      ouraRow,
      logRow,
    ] = await Promise.all([
      loadNutritionGoals(),
      getDayTotals(viewDate),
      getDailyTotalsRange(sevenAgoISO, viewDate),
      getDailyTotalsRange(stripStartISO, stripEndISO),
      loadWeightLog(),
      loadWaterLog(),
      loadActivityForDate(viewDate),
      sb
        .from('oura_daily')
        .select('readiness_score, sleep_score')
        .eq('date', viewDate)
        .maybeSingle()
        .then((res) => ({ data: res.data as { readiness_score: number | null; sleep_score: number | null } | null })),
      sb
        .from('daily_logs')
        .select('id, date, notes')
        .eq('date', viewDate)
        .maybeSingle()
        .then((res) => ({ data: res.data as DailyLogLite | null })),
    ])

    // Food entries for the viewed day, ordered by logged_at so the
    // per-meal list reads chronologically top-to-bottom.
    const viewLog = logRow.data
    foodEntries = viewLog
      ? await sb
          .from('food_entries')
          .select('id, log_id, meal_type, food_items, calories, macros, logged_at')
          .eq('log_id', viewLog.id)
          .order('logged_at', { ascending: true })
          .then((res) => ((res.data ?? []) as unknown) as FoodEntryRow[])
      : []
  } catch {
    return (
      <MobileShell top={<TopAppBar variant="large" title="Calories" />}>
        <CaloriesLoadError
          headline="We couldn't load today's calories"
          body="Usually a network blip. Try again in a moment."
          retryHref={`/v2/calories?date=${viewDate}`}
        />
      </MobileShell>
    )
  }

  const meals = bucketByMeal(foodEntries)

  // Per-meal-item photos (Open Food Facts, name search). Cached 30 days
  // and shared across the day's surfaces. Resolves to an empty map on
  // any failure -- photos are decorative so we never block the page.
  const allNames = foodEntries
    .map((e) => e.food_items?.trim())
    .filter((n): n is string => !!n && n.length >= 3)
  const photoMap = allNames.length > 0
    ? await lookupFoodPhotosByName(allNames).catch(
        () => new Map<string, { url: string | null; source: 'off' | null }>(),
      )
    : new Map<string, { url: string | null; source: 'off' | null }>()
  // Attach photoUrl to each entry by lowercased-name lookup.
  for (const meal of MEAL_ORDER) {
    meals[meal] = meals[meal].map((e) => {
      const key = e.food_items?.trim().toLowerCase()
      if (!key) return e
      const hit = photoMap.get(key)
      return hit?.url ? { ...e, photoUrl: hit.url } : e
    })
  }
  // Default-expanded meal: the time-of-day current bucket when viewing
  // today; for past days, breakfast (top of the day reads first).
  const expandedMeal = isToday ? currentMealForHour(new Date().getHours()) : 'breakfast'
  const caloriesByDate = new Map<string, number>()
  for (const d of stripTotals) caloriesByDate.set(d.date, d.calories)

  const readinessScore = ouraRow.data?.readiness_score ?? null
  const sleepScore = ouraRow.data?.sleep_score ?? null

  const latestWeight = latestEntry(weightLog)
  const weightLb = latestWeight ? kgToLb(latestWeight.kg) : null
  const glasses = glassesForDate(waterLog, viewDate)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="large"
          title="Calories"
          trailing={
            <Link
              href="/v2/calories/analysis"
              aria-label="Calories analysis"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-sm)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Analysis
            </Link>
          }
        />
      }
      fab={<QuickLogFabV2 />}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-16)',
        }}
      >
        <CaloriesReadinessBanner
          readinessScore={readinessScore}
          sleepScore={sleepScore}
          isToday={isToday}
        />

        <DateNavWeekStrip
          viewDate={viewDate}
          todayISO={todayIso}
          caloriesByDate={caloriesByDate}
        />

        <section style={{ paddingTop: 'var(--v2-space-2)' }}>
          <CalorieRingHero
            eaten={Math.round(dayTotals.calories)}
            target={goals.calorieTarget}
          />
        </section>

        {/* Explanatory voice block.
            Renders in chrome palette (dark + tinted gradient) per
            CLAUDE.md: NC cream/blush/sage is reserved for educational
            modals, onboarding, and printable doctor summaries. Pattern
            mirrors the cycle-page chrome card from PR #43. */}
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--v2-radius-lg)',
            border: '1px solid var(--v2-border-subtle)',
            padding: 'var(--v2-space-4)',
            overflow: 'hidden',
            background:
              'linear-gradient(135deg, rgba(77, 184, 168, 0.10) 0%, rgba(229, 201, 82, 0.05) 55%, rgba(23, 23, 27, 0) 100%), var(--v2-bg-card)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
              color: 'var(--v2-text-secondary)',
            }}
          >
            Numbers here are for orientation, not judgment. Partial data still helps.
          </p>
        </div>

        <MacroTilesRow
          carbsCurrent={dayTotals.carbs}
          carbsTarget={goals.macros.carbsG}
          proteinCurrent={dayTotals.protein}
          proteinTarget={goals.macros.proteinG}
          fatCurrent={dayTotals.fat}
          fatTarget={goals.macros.fatG}
          bodyweightKg={latestWeight?.kg ?? null}
        />

        {MEAL_ORDER.map((meal) => (
          <MealSectionCard
            key={meal}
            meal={meal}
            label={MEAL_LABELS[meal]}
            date={viewDate}
            entries={meals[meal]}
            defaultExpanded={meal === expandedMeal}
          />
        ))}

        <WeeklyCalorieSparkline
          week={weekTotals.map((d) => ({ date: d.date, calories: d.calories }))}
          todayISO={viewDate}
          target={goals.calorieTarget}
        />

        <DashboardSideTiles
          weightLb={weightLb}
          steps={activity.steps}
          activeCalories={activity.activeCalories}
          waterGlasses={glasses}
          notes={logRow.data?.notes ?? null}
        />

        {/* Data correction affordance for the most recently logged
            meal. USDA serving sizes and macros are best-effort; this
            lets the user override either and the AI sees the
            correction in every future conversation. */}
        {foodEntries.length > 0 && (
          <CorrectionsPanel
            tableName="food_entries"
            rowId={foodEntries[foodEntries.length - 1].id}
            source="v2_calories"
            heading="Did the latest entry import correctly?"
            subtext="Calories or food name off? Fix it and tell me why so I remember."
            fields={(() => {
              const latest = foodEntries[foodEntries.length - 1]
              return [
                {
                  label: 'Food item',
                  value: latest.food_items,
                  fieldName: 'food_items',
                  inputType: 'text' as const,
                  displayValue:
                    latest.food_items == null || latest.food_items === ''
                      ? 'Not set'
                      : String(latest.food_items),
                },
                {
                  label: 'Calories',
                  value: latest.calories,
                  fieldName: 'calories',
                  inputType: 'number' as const,
                  displayValue: latest.calories == null ? 'Not logged' : `${latest.calories} kcal`,
                },
              ]
            })()}
          />
        )}

        <Banner
          intent="info"
          title="Targets are soft"
          body="Adjust them on Plan."
          trailing={
            <Link
              href="/v2/calories/plan"
              aria-label="Open plan"
              style={{
                fontSize: 'var(--v2-text-sm)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-accent-primary)',
                textDecoration: 'none',
                padding: 'var(--v2-space-2)',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Plan
            </Link>
          }
        />
      </div>
    </MobileShell>
  )
}
