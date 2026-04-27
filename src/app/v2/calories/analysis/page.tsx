import Link from 'next/link'
import { addDays, format } from 'date-fns'
import { loadNutritionGoals } from '@/lib/calories/goals'
import { getDailyTotalsRange } from '@/lib/calories/home-data'
import { getFoodEntriesByDateRange } from '@/lib/api/food'
import { MobileShell, TopAppBar } from '@/v2/components/shell'
import AnalysisSubTabs, { type AnalysisTab } from './_components/AnalysisSubTabs'
import AnalysisRangeTabs from './_components/AnalysisRangeTabs'
// Server-safe pure helpers in their own non-'use client' module:
// importing rangeToDays directly from AnalysisRangeTabs.tsx broke
// /v2/calories/analysis with a "Server Components render" error
// (Next.js refuses non-component exports across the use-client
// boundary at SSR time).
import { rangeToDays, type AnalysisRange } from './_components/range-helpers'
import MonthlyCalorieSparkline from './_components/MonthlyCalorieSparkline'
import SummaryFoodsPanel from './_components/SummaryFoodsPanel'
import MealAnalysisPanel from './_components/MealAnalysisPanel'
import CalsFromNutrientsPanel from './_components/CalsFromNutrientsPanel'
import {
  topContributors,
  mealBreakdown,
  macroCalSplit,
  loggedDaysCount,
} from './_components/derive'

export const dynamic = 'force-dynamic'

/*
 * Analysis route
 *
 * Surfaces 30-day rollups from the same data pipes that feed the
 * Calories dashboard (getDailyTotalsRange + getFoodEntriesByDateRange).
 * All aggregation happens in ./_components/derive : keep it section-
 * local unless a second caller appears.
 *
 * Three sub-tabs live on ?tab=: summary (default), meal, nutrients.
 * The sparkline renders once at the top; panels swap below.
 */

const VALID_TABS: readonly AnalysisTab[] = ['summary', 'meal', 'nutrients'] as const

// parseRange now lives in range-helpers.ts (server-safe).
import { parseRange } from './_components/range-helpers'

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function isoDateDaysAgo(fromISO: string, days: number): string {
  return format(addDays(new Date(fromISO + 'T00:00:00'), -days), 'yyyy-MM-dd')
}

function parseTab(raw: string | undefined): AnalysisTab {
  if (!raw) return 'summary'
  return (VALID_TABS as readonly string[]).includes(raw)
    ? (raw as AnalysisTab)
    : 'summary'
}

export default async function V2CaloriesAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; range?: string }>
}) {
  const params = await searchParams
  const activeTab = parseTab(params.tab)
  const activeRange = parseRange(params.range)
  const { days: rangeDays } = rangeToDays(activeRange)

  const today = todayISO()
  const startDate = isoDateDaysAgo(today, rangeDays - 1)

  const [goals, rangeTotals, rangeEntries] = await Promise.all([
    loadNutritionGoals(),
    getDailyTotalsRange(startDate, today),
    getFoodEntriesByDateRange(startDate, today),
  ])

  const contributors = topContributors(rangeEntries, 5)
  const meals = mealBreakdown(rangeEntries)
  const macros = macroCalSplit(rangeTotals)
  const loggedDays = loggedDaysCount(rangeTotals)

  return (
    <MobileShell
      top={
        <TopAppBar
          variant="standard"
          title="Analysis"
          leading={
            <Link
              href="/v2/calories"
              aria-label="Back to calories"
              style={{
                color: 'var(--v2-text-secondary)',
                fontSize: 'var(--v2-text-base)',
                padding: 'var(--v2-space-2)',
                textDecoration: 'none',
                minHeight: 'var(--v2-touch-target-min)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ‹
            </Link>
          }
        />
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-5)',
          padding: 'var(--v2-space-4)',
          paddingBottom: 'var(--v2-space-8)',
        }}
      >
        <AnalysisSubTabs active={activeTab} />
        <AnalysisRangeTabs active={activeRange} />

        <MonthlyCalorieSparkline
          days={rangeTotals.map((d) => ({ date: d.date, calories: d.calories }))}
          todayISO={today}
          target={goals.calorieTarget}
        />

        {activeTab === 'summary' && (
          <SummaryFoodsPanel contributors={contributors} loggedDays={loggedDays} />
        )}
        {activeTab === 'meal' && (
          <MealAnalysisPanel rows={meals} loggedDays={loggedDays} />
        )}
        {activeTab === 'nutrients' && (
          <CalsFromNutrientsPanel split={macros} loggedDays={loggedDays} />
        )}
      </div>
    </MobileShell>
  )
}
