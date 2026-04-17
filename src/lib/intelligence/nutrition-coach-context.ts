/**
 * Nutrition Coach Dynamic Context Builder
 *
 * Builds the DYNAMIC half of the nutrition-coach system prompt. The
 * static persona text lives in `src/lib/personas/nutrition-coach.ts`
 * and is cached. This module assembles fresh-from-database facts that
 * change day to day: recent meals, nutrient intake vs target, cycle
 * phase, active goals, active problems that touch nutrition.
 *
 * Static/Dynamic rule: the output of this module is always APPENDED
 * AFTER `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` by the API route. Nothing
 * in here should bake identity or rule content that would poison the
 * static prefix's cache.
 *
 * Data reads:
 *   - food_entries: last 7 days (READ-ONLY)
 *   - user_nutrient_targets: active preset (READ-ONLY, via API module)
 *   - cycle_entries + nc_imported: current cycle day/phase (READ-ONLY)
 *   - active_problems: unresolved (READ-ONLY)
 *
 * This module never writes. It composes a plain-text block intended to
 * concatenate with the assembler's `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__`
 * payload.
 */

import { createServiceClient } from '@/lib/supabase'
import { getResolvedTargets } from '@/lib/api/nutrient-targets'
import { getCurrentCycleDay } from '@/lib/cycle/current-day'
import type { ResolvedTarget } from '@/lib/nutrition/target-resolver'
import type { CyclePhase } from '@/lib/types'

const RECENT_MEAL_WINDOW_DAYS = 7
const MAX_RECENT_MEALS = 20
const MAX_ACTIVE_PROBLEMS = 6

// ── Result type ────────────────────────────────────────────────────────

export interface NutritionCoachContext {
  /** The rendered context block, ready to append after the boundary. */
  text: string
  /** Debug sections so tests and logging can inspect without parsing. */
  sections: {
    cyclePhase: { day: number | null; phase: CyclePhase | null } | null
    recentMealCount: number
    nutrientTargetCount: number
    activeProblemCount: number
  }
}

// ── Recent meals loader ────────────────────────────────────────────────

interface RecentMealRow {
  logged_at: string
  meal_type: string | null
  food_items: string | null
  flagged_triggers: string[] | null
  date?: string
}

async function loadRecentMeals(): Promise<RecentMealRow[]> {
  try {
    const sb = createServiceClient()
    const since = new Date(Date.now() - RECENT_MEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)

    // Join daily_logs so we filter by actual log date, not logged_at.
    // Backfilled entries should still surface if they live in the window.
    const { data, error } = await sb
      .from('food_entries')
      .select('logged_at, meal_type, food_items, flagged_triggers, daily_logs!inner(date)')
      .gte('daily_logs.date', since)
      .order('logged_at', { ascending: false })
      .limit(MAX_RECENT_MEALS)

    if (error) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data || []) as any[]).map((r): RecentMealRow => ({
      logged_at: r.logged_at,
      meal_type: r.meal_type,
      food_items: r.food_items,
      flagged_triggers: r.flagged_triggers,
      date: r.daily_logs?.date,
    }))
  } catch {
    return []
  }
}

// ── Nutrient targets loader ────────────────────────────────────────────

async function loadNutrientTargets(): Promise<ResolvedTarget[]> {
  try {
    return await getResolvedTargets()
  } catch {
    return []
  }
}

// ── Cycle phase loader ─────────────────────────────────────────────────

async function loadCyclePhase(): Promise<{ day: number | null; phase: CyclePhase | null } | null> {
  try {
    const cur = await getCurrentCycleDay()
    return { day: cur.day, phase: cur.phase }
  } catch {
    return null
  }
}

// ── Active problems loader ─────────────────────────────────────────────

interface ActiveProblemRow {
  problem: string
  status: string
  latest_data: string | null
}

async function loadActiveProblems(): Promise<ActiveProblemRow[]> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('active_problems')
      .select('problem, status, latest_data')
      .neq('status', 'resolved')
      .limit(MAX_ACTIVE_PROBLEMS)
    if (error) return []
    return (data || []) as ActiveProblemRow[]
  } catch {
    return []
  }
}

// ── Rendering helpers ──────────────────────────────────────────────────

function renderCycleSection(
  cycle: { day: number | null; phase: CyclePhase | null } | null,
): string {
  if (!cycle || cycle.day === null || cycle.phase === null) {
    return '<cycle>\nNo current cycle data available. Treat cycle-phase guidance cautiously.\n</cycle>'
  }
  return `<cycle>\nCurrent cycle day: ${cycle.day}\nCurrent phase: ${cycle.phase}\n</cycle>`
}

function renderMealsSection(meals: RecentMealRow[]): string {
  if (meals.length === 0) {
    return `<recent_meals window_days="${RECENT_MEAL_WINDOW_DAYS}">\nNo meals logged in the last ${RECENT_MEAL_WINDOW_DAYS} days.\n</recent_meals>`
  }

  const lines = meals.map((m) => {
    const datePart = m.date ?? m.logged_at.slice(0, 10)
    const mealType = m.meal_type ?? 'meal'
    const food = (m.food_items ?? '').slice(0, 180)
    const triggers = m.flagged_triggers && m.flagged_triggers.length > 0
      ? ` [triggers: ${m.flagged_triggers.join(', ')}]`
      : ''
    return `- ${datePart} ${mealType}: ${food}${triggers}`
  })

  return `<recent_meals window_days="${RECENT_MEAL_WINDOW_DAYS}" count="${meals.length}">\n${lines.join('\n')}\n</recent_meals>`
}

function renderTargetsSection(targets: ResolvedTarget[]): string {
  if (targets.length === 0) {
    return '<nutrient_targets>\nNo active targets resolved.\n</nutrient_targets>'
  }
  const lines = targets
    .slice(0, 25)
    .map((t) => {
      const src = t.source
      const cite = t.citation ? ` (${t.citation})` : ''
      return `- ${t.nutrient}: ${t.amount}${t.unit} [source=${src}]${cite}`
    })
  return `<nutrient_targets count="${targets.length}">\n${lines.join('\n')}\n</nutrient_targets>`
}

function renderProblemsSection(problems: ActiveProblemRow[]): string {
  if (problems.length === 0) {
    return '<active_problems>\nNone flagged.\n</active_problems>'
  }
  const lines = problems.map((p) => {
    const ld = p.latest_data ? ` -- ${p.latest_data.slice(0, 160)}` : ''
    return `- [${p.status}] ${p.problem}${ld}`
  })
  return `<active_problems count="${problems.length}">\n${lines.join('\n')}\n</active_problems>`
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Assemble the nutrition-coach dynamic context block. Safe to call from
 * the API route; failures in individual sections fall through to empty
 * placeholders rather than throwing so one broken source never kills
 * the whole response.
 */
export async function buildNutritionCoachContext(): Promise<NutritionCoachContext> {
  const [meals, targets, cycle, problems] = await Promise.all([
    loadRecentMeals(),
    loadNutrientTargets(),
    loadCyclePhase(),
    loadActiveProblems(),
  ])

  const parts = [
    '<nutrition_coach_context>',
    renderCycleSection(cycle),
    renderMealsSection(meals),
    renderTargetsSection(targets),
    renderProblemsSection(problems),
    '</nutrition_coach_context>',
  ]

  return {
    text: parts.join('\n\n'),
    sections: {
      cyclePhase: cycle,
      recentMealCount: meals.length,
      nutrientTargetCount: targets.length,
      activeProblemCount: problems.length,
    },
  }
}

// ── Pure renderer exposed for tests ────────────────────────────────────

/**
 * Pure composition over already-loaded data. Tests use this to verify
 * the text shape without hitting the database.
 */
export function renderNutritionCoachContext(input: {
  cycle: { day: number | null; phase: CyclePhase | null } | null
  meals: RecentMealRow[]
  targets: ResolvedTarget[]
  problems: ActiveProblemRow[]
}): NutritionCoachContext {
  const parts = [
    '<nutrition_coach_context>',
    renderCycleSection(input.cycle),
    renderMealsSection(input.meals),
    renderTargetsSection(input.targets),
    renderProblemsSection(input.problems),
    '</nutrition_coach_context>',
  ]
  return {
    text: parts.join('\n\n'),
    sections: {
      cyclePhase: input.cycle,
      recentMealCount: input.meals.length,
      nutrientTargetCount: input.targets.length,
      activeProblemCount: input.problems.length,
    },
  }
}

export type { RecentMealRow, ActiveProblemRow }
