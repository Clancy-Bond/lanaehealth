/*
 * Analysis derivations
 *
 * Section-local aggregation helpers for the /v2/calories/analysis
 * route. These stay here (not in src/lib) because they are shape-
 * shaped for a single view: top contributor chips, meal distribution
 * bars, and the 4/4/9 macro calorie split.
 *
 * Any of these could graduate to src/lib/calories/* if a second
 * caller shows up later.
 */
import type { FoodEntry, MealType } from '@/lib/types'
import { normalizeFoodKey } from '@/lib/api/food'
import type { DayTotals } from '@/lib/calories/home-data'

export interface TopContributor {
  key: string
  display: string
  count: number
  calories: number
}

/**
 * Group entries by normalized food_items, sum calories, sort desc.
 * display_text uses the most recently logged surface form (first
 * occurrence when iterating logged_at DESC from getFoodEntriesByDateRange).
 */
export function topContributors(
  entries: FoodEntry[],
  limit = 5,
): TopContributor[] {
  const map = new Map<string, TopContributor>()
  for (const e of entries) {
    const key = normalizeFoodKey(e.food_items)
    if (!key) continue
    const cal = e.calories ?? 0
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
      existing.calories += cal
    } else {
      map.set(key, {
        key,
        display: (e.food_items ?? '').trim(),
        count: 1,
        calories: cal,
      })
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.calories - a.calories)
    .slice(0, limit)
}

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export interface MealBreakdownRow {
  meal: MealType
  cal: number
  pct: number
}

/**
 * Sum calories per meal_type across the full range. pct is each
 * meal's share of the combined total; rows with zero total render
 * as 0% (not NaN).
 */
export function mealBreakdown(entries: FoodEntry[]): MealBreakdownRow[] {
  const totals: Record<MealType, number> = {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0,
  }
  for (const e of entries) {
    const key = (e.meal_type ?? 'snack') as MealType
    const bucket = key in totals ? key : 'snack'
    totals[bucket] += e.calories ?? 0
  }
  const grand = totals.breakfast + totals.lunch + totals.dinner + totals.snack
  return MEAL_ORDER.map((meal) => ({
    meal,
    cal: totals[meal],
    pct: grand > 0 ? (totals[meal] / grand) * 100 : 0,
  }))
}

export interface MacroCalSplit {
  carbCal: number
  proteinCal: number
  fatCal: number
  pcts: { carbs: number; protein: number; fat: number }
}

/**
 * Aggregate macro grams across the range and convert to calories using
 * the standard Atwater factors (carbs 4 kcal/g, protein 4 kcal/g,
 * fat 9 kcal/g). Returns per-macro calories plus their percentage
 * share of the sum (NOT of the raw calorie totals, because tracked
 * entries often have calories without full macros).
 */
export function macroCalSplit(totals: DayTotals[]): MacroCalSplit {
  let carbG = 0
  let proteinG = 0
  let fatG = 0
  for (const d of totals) {
    carbG += d.carbs
    proteinG += d.protein
    fatG += d.fat
  }
  const carbCal = carbG * 4
  const proteinCal = proteinG * 4
  const fatCal = fatG * 9
  const grand = carbCal + proteinCal + fatCal
  return {
    carbCal,
    proteinCal,
    fatCal,
    pcts: {
      carbs: grand > 0 ? (carbCal / grand) * 100 : 0,
      protein: grand > 0 ? (proteinCal / grand) * 100 : 0,
      fat: grand > 0 ? (fatCal / grand) * 100 : 0,
    },
  }
}

/**
 * Count unique logged days in the range (days with any food entry).
 * Used to gate the empty state: fewer than 3 days of data produces
 * noise, not signal.
 */
export function loggedDaysCount(totals: DayTotals[]): number {
  return totals.filter((d) => d.entryCount > 0).length
}
