/**
 * Adaptive Calorie Algorithm
 *
 * MacroFactor-style weekly adjustment based on actual weight trends.
 * Instead of static TDEE calculators, this uses real data to determine
 * whether calorie targets need adjustment.
 *
 * Algorithm:
 * 1. Calculate expected weight change from calorie intake vs expenditure
 * 2. Compare to actual weight change (smoothed 7-day trend)
 * 3. Adjust TDEE estimate based on discrepancy
 * 4. Generate new calorie/macro targets for next week
 *
 * Updates weekly. Requires at least 2 weeks of data.
 */

import { createServiceClient } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────

export interface CalorieTarget {
  dailyCalories: number
  protein: number                 // grams
  fat: number                    // grams
  carbs: number                  // grams
  tdeeEstimate: number           // Current estimated TDEE
  weeklyAdjustment: number       // Calories added/removed this week
  confidence: 'high' | 'moderate' | 'low'
  explanation: string
}

export interface WeeklyAnalysis {
  weekStart: string
  weekEnd: string
  avgDailyCalories: number | null
  weightStart: number | null      // kg, smoothed
  weightEnd: number | null        // kg, smoothed
  weightChange: number | null     // kg
  expectedChange: number | null   // kg (based on calorie surplus/deficit)
  tdeeAdjustment: number         // Calories to adjust TDEE
}

export type GoalType = 'lose' | 'maintain' | 'gain'

interface AdaptiveConfig {
  goal: GoalType
  targetWeeklyChange: number     // kg per week (negative for loss)
  proteinPerKg: number           // g protein per kg bodyweight
  fatMinPercent: number          // minimum fat as % of calories
}

const DEFAULT_CONFIGS: Record<GoalType, AdaptiveConfig> = {
  lose: {
    goal: 'lose',
    targetWeeklyChange: -0.5,    // 0.5 kg/week loss
    proteinPerKg: 2.0,           // High protein to preserve muscle
    fatMinPercent: 25,
  },
  maintain: {
    goal: 'maintain',
    targetWeeklyChange: 0,
    proteinPerKg: 1.6,
    fatMinPercent: 25,
  },
  gain: {
    goal: 'gain',
    targetWeeklyChange: 0.25,    // 0.25 kg/week gain
    proteinPerKg: 1.8,
    fatMinPercent: 25,
  },
}

// ── Core Algorithm ─────────────────────────────────────────────────

/**
 * 7-day moving average to smooth weight fluctuations.
 */
function smoothWeights(weights: Array<{ date: string; value: number }>): Map<string, number> {
  const smoothed = new Map<string, number>()

  for (let i = 0; i < weights.length; i++) {
    const window = weights.slice(Math.max(0, i - 6), i + 1)
    const avg = window.reduce((s, w) => s + w.value, 0) / window.length
    smoothed.set(weights[i].date, Math.round(avg * 100) / 100)
  }

  return smoothed
}

/**
 * Calculate TDEE from actual weight change and calorie intake.
 * If eating X calories caused Y weight change, actual TDEE = X - (Y * 7700 / 7)
 * (7700 kcal per kg of body weight change)
 */
function calculateActualTDEE(
  avgDailyCalories: number,
  weeklyWeightChange: number, // kg
): number {
  const calorieEquivalent = weeklyWeightChange * 7700 / 7 // Daily surplus/deficit implied by weight change
  return Math.round(avgDailyCalories - calorieEquivalent)
}

// ── Main Functions ─────────────────────────────────────────────────

/**
 * Analyze the last 4 weeks of data and produce an adaptive calorie target.
 */
export async function getAdaptiveCalorieTarget(
  goal: GoalType = 'maintain',
  currentWeight: number | null = null,
): Promise<CalorieTarget> {
  const sb = createServiceClient()
  const config = DEFAULT_CONFIGS[goal]
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Fetch calorie data
  const { data: foodData } = await sb
    .from('food_entries')
    .select('logged_at, calories')
    .gte('logged_at', fourWeeksAgo)
    .order('logged_at')

  // Fetch weight data (from lab_results where test_name = 'Weight')
  const { data: weightData } = await sb
    .from('lab_results')
    .select('date, value')
    .eq('test_name', 'Weight')
    .gte('date', fourWeeksAgo)
    .order('date')

  // Also check oura_daily for any weight data
  const { data: ouraData } = await sb
    .from('oura_daily')
    .select('date, cal_total')
    .gte('date', fourWeeksAgo)
    .order('date')

  // Aggregate daily calories
  const dailyCalories = new Map<string, number>()
  for (const entry of foodData ?? []) {
    const date = (entry.logged_at as string).slice(0, 10)
    const cal = entry.calories as number ?? 0
    dailyCalories.set(date, (dailyCalories.get(date) ?? 0) + cal)
  }

  // Fallback: use Oura total calories if no food logging
  if (dailyCalories.size < 7) {
    for (const entry of ouraData ?? []) {
      if (entry.cal_total && !dailyCalories.has(entry.date)) {
        dailyCalories.set(entry.date, entry.cal_total as number)
      }
    }
  }

  // Smooth weight data
  const weights = (weightData ?? [])
    .filter(w => w.value !== null)
    .map(w => ({ date: w.date as string, value: w.value as number }))

  const bodyWeight = currentWeight ?? weights[weights.length - 1]?.value ?? 65 // Default 65kg

  // Not enough data -- use Mifflin-St Jeor estimate
  if (dailyCalories.size < 7 || weights.length < 3) {
    // Mifflin-St Jeor for 24F, assume 163cm, moderate activity
    const bmr = 10 * bodyWeight + 6.25 * 163 - 5 * 24 - 161
    const tdee = Math.round(bmr * 1.4) // Lightly active
    const targetCalories = Math.round(tdee + config.targetWeeklyChange * 7700 / 7)

    const protein = Math.round(bodyWeight * config.proteinPerKg)
    const fatCalories = Math.round(targetCalories * config.fatMinPercent / 100)
    const fat = Math.round(fatCalories / 9)
    const carbs = Math.round((targetCalories - protein * 4 - fat * 9) / 4)

    return {
      dailyCalories: targetCalories,
      protein,
      fat,
      carbs,
      tdeeEstimate: tdee,
      weeklyAdjustment: 0,
      confidence: 'low',
      explanation: 'Estimated from Mifflin-St Jeor formula. Log meals and weigh yourself weekly for adaptive adjustments.',
    }
  }

  // Enough data -- calculate actual TDEE from weight change
  const smoothedWeights = smoothWeights(weights)
  const smoothedArray = Array.from(smoothedWeights.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  // Split into 2-week halves for trend
  const midpoint = Math.floor(smoothedArray.length / 2)
  const firstHalfWeight = smoothedArray.slice(0, midpoint)
  const secondHalfWeight = smoothedArray.slice(midpoint)

  const weightStart = firstHalfWeight[0]?.[1] ?? bodyWeight
  const weightEnd = secondHalfWeight[secondHalfWeight.length - 1]?.[1] ?? bodyWeight
  const totalWeightChange = weightEnd - weightStart
  const weeksOfData = dailyCalories.size / 7

  const avgDailyCalories = Array.from(dailyCalories.values()).reduce((s, c) => s + c, 0) / dailyCalories.size
  const weeklyWeightChange = totalWeightChange / Math.max(weeksOfData, 1)

  const actualTDEE = calculateActualTDEE(avgDailyCalories, weeklyWeightChange)

  // Target calories = TDEE + weekly goal adjustment
  const dailyDeficit = config.targetWeeklyChange * 7700 / 7
  const targetCalories = Math.round(actualTDEE + dailyDeficit)

  // Compute macros
  const protein = Math.round(bodyWeight * config.proteinPerKg)
  const fatCalories = Math.round(targetCalories * config.fatMinPercent / 100)
  const fat = Math.round(fatCalories / 9)
  const remainingCalories = targetCalories - protein * 4 - fat * 9
  const carbs = Math.max(0, Math.round(remainingCalories / 4))

  // Adjustment from last week
  const lastWeekAvg = Array.from(dailyCalories.entries())
    .slice(-7)
    .reduce((s, [, c]) => s + c, 0) / 7
  const weeklyAdjustment = Math.round(targetCalories - lastWeekAvg)

  const explanation = weeklyAdjustment > 50
    ? `Increasing by ${weeklyAdjustment} cal/day. Weight trend suggests you need more fuel.`
    : weeklyAdjustment < -50
    ? `Decreasing by ${Math.abs(weeklyAdjustment)} cal/day. Weight trend shows excess intake.`
    : `Current intake aligns with your ${goal} goal.`

  return {
    dailyCalories: targetCalories,
    protein,
    fat,
    carbs,
    tdeeEstimate: actualTDEE,
    weeklyAdjustment,
    confidence: weeksOfData >= 3 ? 'high' : 'moderate',
    explanation,
  }
}
