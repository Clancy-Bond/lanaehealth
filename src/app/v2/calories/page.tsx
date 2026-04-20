import Link from 'next/link'
import { addDays, format, startOfDay } from 'date-fns'
import { createServiceClient } from '@/lib/supabase'
import { loadNutritionGoals } from '@/lib/calories/goals'
import { getDayTotals, getDailyTotalsRange } from '@/lib/calories/home-data'
import { loadWeightLog, latestEntry, kgToLb } from '@/lib/calories/weight'
import { loadWaterLog, glassesForDate } from '@/lib/calories/water'
import { loadActivityForDate } from '@/lib/calories/activity'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import { Card, Banner } from '@/v2/components/primitives'
import CalorieRingHero from './_components/CalorieRingHero'
import DateNavWeekStrip from './_components/DateNavWeekStrip'
import CaloriesReadinessBanner from './_components/CaloriesReadinessBanner'
import MacroTilesRow from './_components/MacroTilesRow'
import MealSectionCard, { type MealSectionEntry } from './_components/MealSectionCard'
import WeeklyCalorieSparkline from './_components/WeeklyCalorieSparkline'
import DashboardSideTiles from './_components/DashboardSideTiles'
import QuickLogFabV2 from './_components/QuickLogFabV2'

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
  // one of these before painting.
  const [
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
      .maybeSingle(),
    sb
      .from('daily_logs')
      .select('id, date, notes')
      .eq('date', viewDate)
      .maybeSingle(),
  ])

  // Food entries for the viewed day, ordered by logged_at so the
  // per-meal list reads chronologically top-to-bottom.
  const viewLog = (logRow.data as DailyLogLite | null) ?? null
  const foodEntries: FoodEntryRow[] = viewLog
    ? await sb
        .from('food_entries')
        .select('id, log_id, meal_type, food_items, calories, macros, logged_at')
        .eq('log_id', viewLog.id)
        .order('logged_at', { ascending: true })
        .then((res) => ((res.data ?? []) as unknown) as FoodEntryRow[])
    : []

  const meals = bucketByMeal(foodEntries)
  const caloriesByDate = new Map<string, number>()
  for (const d of stripTotals) caloriesByDate.set(d.date, d.calories)

  const readinessScore =
    (ouraRow.data as { readiness_score: number | null } | null)?.readiness_score ?? null
  const sleepScore =
    (ouraRow.data as { sleep_score: number | null } | null)?.sleep_score ?? null

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

        <Card variant="explanatory" padding="md">
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Numbers here are for orientation, not judgment. Partial data still helps.
          </p>
        </Card>

        <MacroTilesRow
          carbsCurrent={dayTotals.carbs}
          carbsTarget={goals.macros.carbsG}
          proteinCurrent={dayTotals.protein}
          proteinTarget={goals.macros.proteinG}
          fatCurrent={dayTotals.fat}
          fatTarget={goals.macros.fatG}
        />

        {MEAL_ORDER.map((meal) => (
          <MealSectionCard
            key={meal}
            meal={meal}
            label={MEAL_LABELS[meal]}
            date={viewDate}
            entries={meals[meal]}
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
          notes={viewLog?.notes ?? null}
        />

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
