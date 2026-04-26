import { supabase } from '@/lib/supabase'
import type { FoodEntry, MealType } from '@/lib/types'
import { classifyFood } from './food-classification'

/**
 * Normalize free-text food_items for grouping.
 * Applies lowercase + trim + collapses internal whitespace so
 * "Oatmeal ", " oatmeal", and "Oatmeal" all group together.
 *
 * NOTE: This is lossy. "oatmeal" and "oats" still fragment.
 * MyFitnessPal-style MVP accepts this trade-off, see
 * docs/competitive/myfitnesspal/implementation-notes.md.
 */
export function normalizeFoodKey(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * A frequency-ranked meal suggestion, grouped by normalized food_items.
 * display_text is the most-recently-logged surface form, so chip labels
 * keep whatever capitalization Lanae originally typed.
 */
export interface FrequentMeal {
  meal_type: MealType
  food_items: string          // display-form (most recent surface spelling)
  flagged_triggers: string[]  // from the most recent matching entry
  count: number
  last_logged_at: string
}

/**
 * Get food entries for a log
 */
export async function getFoodEntries(logId: string): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('log_id', logId)
    .order('logged_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch food entries: ${error.message}`)
  return (data || []) as FoodEntry[]
}

/**
 * Get all food entries for a date range (using daily_logs join)
 */
export async function getFoodEntriesByDateRange(startDate: string, endDate: string): Promise<(FoodEntry & { date?: string })[]> {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*, daily_logs!inner(date)')
    .gte('daily_logs.date', startDate)
    .lte('daily_logs.date', endDate)
    .order('logged_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch food entries: ${error.message}`)
  // Flatten the joined data. The Supabase join puts the parent date on a
  // nested `daily_logs` object; we lift it up so callers can sort or
  // group by date without traversing the join shape.
  type JoinedRow = FoodEntry & { daily_logs?: { date?: string | null } | null }
  const rows = (data ?? []) as JoinedRow[]
  return rows.map((row) => {
    const { daily_logs, ...rest } = row
    return { ...rest, date: daily_logs?.date ?? '' }
  })
}

/**
 * Add a food entry
 */
export async function addFoodEntry(input: {
  log_id: string
  meal_type: MealType
  food_items: string
  flagged_triggers: string[]
}): Promise<FoodEntry> {
  // Auto-classify food for FODMAP, histamine, allergens, inflammation, iron
  const classification = classifyFood(input.food_items)

  // Merge auto-detected triggers with user-flagged triggers
  const allTriggers = [...new Set([
    ...input.flagged_triggers,
    ...classification.tags,
  ])]

  const { data, error } = await supabase
    .from('food_entries')
    .insert({
      ...input,
      flagged_triggers: allTriggers,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to add food entry: ${error.message}`)
  return data as FoodEntry
}

/**
 * Compute frequency-weighted top meal suggestions per meal_type.
 *
 * Returns the top `limit` normalized food_items strings for the given meal_type,
 * ranked by log count (desc) with most-recent log as tie-breaker. Normalization
 * uses lowercase + trim + whitespace collapse for grouping; the returned
 * `food_items` is the most-recent surface form so chips show natural casing.
 *
 * This is a READ-only query over existing food_entries. No writes.
 *
 * @param mealType  breakfast | lunch | dinner | snack
 * @param windowDays lookback window; default 90
 * @param limit      max chips to return; default 5
 */
export async function getFrequentMeals(
  mealType: MealType,
  windowDays = 90,
  limit = 5,
): Promise<FrequentMeal[]> {
  // Windowed query: we join daily_logs to filter by date rather than logged_at
  // so copied/backfilled entries respect the window.
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data, error } = await supabase
    .from('food_entries')
    .select('meal_type, food_items, flagged_triggers, logged_at, daily_logs!inner(date)')
    .eq('meal_type', mealType)
    .gte('daily_logs.date', since)
    .order('logged_at', { ascending: false })
    .limit(500) // pull a slice; we group in memory (5,781 total rows is tiny)

  if (error) throw new Error(`Failed to fetch frequent meals: ${error.message}`)

  const rows = (data || []) as Array<{
    meal_type: MealType
    food_items: string | null
    flagged_triggers: string[] | null
    logged_at: string
  }>

  // Group by normalized key. First row per key wins for display_text
  // (because rows are ordered by logged_at DESC, first = most recent).
  const grouped = new Map<
    string,
    {
      display: string
      meal_type: MealType
      flagged_triggers: string[]
      count: number
      last_logged_at: string
    }
  >()

  for (const row of rows) {
    const key = normalizeFoodKey(row.food_items)
    if (!key) continue
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
    } else {
      grouped.set(key, {
        display: (row.food_items ?? '').trim(),
        meal_type: row.meal_type,
        flagged_triggers: row.flagged_triggers ?? [],
        count: 1,
        last_logged_at: row.logged_at,
      })
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return b.last_logged_at.localeCompare(a.last_logged_at)
    })
    .slice(0, limit)
    .map((g) => ({
      meal_type: g.meal_type,
      food_items: g.display,
      flagged_triggers: g.flagged_triggers,
      count: g.count,
      last_logged_at: g.last_logged_at,
    }))
}

/**
 * Server-side convenience: fetch the top N frequent meals per meal_type
 * in parallel, returning a map keyed by MealType. Safe to call from a server
 * component (e.g. /log page) once per render.
 */
export async function getFrequentMealsByType(
  windowDays = 90,
  limit = 5,
): Promise<Record<MealType, FrequentMeal[]>> {
  const types: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
  const results = await Promise.all(types.map((t) => getFrequentMeals(t, windowDays, limit)))
  return {
    breakfast: results[0],
    lunch: results[1],
    dinner: results[2],
    snack: results[3],
  }
}

/**
 * Copy all food_entries from a source date into the target log.
 * Insert-only. Source rows are untouched. Re-runs classifyFood so copied rows
 * benefit from any classifier improvements since the source row was logged.
 *
 * Safety cap: 20 items per call to prevent accidental mass-insert from a
 * long-ago binge day.
 *
 * @param input.sourceDate   ISO date string, e.g. '2026-04-15'
 * @param input.targetLogId  daily_logs.id for today (or wherever we paste)
 * @param input.mealTypes    optional filter. If omitted, all meal types copy.
 */
export async function copyMealsFromDate(input: {
  sourceDate: string
  targetLogId: string
  mealTypes?: MealType[]
}): Promise<FoodEntry[]> {
  const COPY_CAP = 20

  // 1. Resolve source log by date
  const { data: sourceLog, error: logErr } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('date', input.sourceDate)
    .maybeSingle()

  if (logErr) throw new Error(`Failed to resolve source log: ${logErr.message}`)
  if (!sourceLog) return []

  // 2. Select source entries, optionally filtered by meal_type
  let q = supabase
    .from('food_entries')
    .select('meal_type, food_items, flagged_triggers')
    .eq('log_id', (sourceLog as { id: string }).id)

  if (input.mealTypes && input.mealTypes.length > 0) {
    q = q.in('meal_type', input.mealTypes)
  }

  const { data: sourceEntries, error: srcErr } = await q
  if (srcErr) throw new Error(`Failed to read source entries: ${srcErr.message}`)

  const source = (sourceEntries || []) as Array<{
    meal_type: MealType | null
    food_items: string | null
    flagged_triggers: string[] | null
  }>
  if (source.length === 0) return []

  // 3. Build insert payload. Cap at COPY_CAP to prevent runaway inserts.
  const toInsert = source.slice(0, COPY_CAP).map((row) => {
    const foodItems = row.food_items ?? ''
    const classification = classifyFood(foodItems)
    const mergedTriggers = Array.from(
      new Set([...(row.flagged_triggers ?? []), ...classification.tags]),
    )
    return {
      log_id: input.targetLogId,
      meal_type: row.meal_type,
      food_items: foodItems,
      flagged_triggers: mergedTriggers,
    }
  })

  // 4. Bulk insert. Supabase returns the new rows in insertion order.
  const { data: inserted, error: insErr } = await supabase
    .from('food_entries')
    .insert(toInsert)
    .select()

  if (insErr) throw new Error(`Failed to copy meals: ${insErr.message}`)
  return (inserted || []) as FoodEntry[]
}

/**
 * Delete a food entry
 */
export async function deleteFoodEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete food entry: ${error.message}`)
}
