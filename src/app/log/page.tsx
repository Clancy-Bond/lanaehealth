import { createServiceClient } from '@/lib/supabase'
import type { DailyLog, PainPoint, Symptom, FoodEntry, CycleEntry, NcImported } from '@/lib/types'
import { format, subDays } from 'date-fns'
import DailyLogClient from '@/components/log/DailyLogClient'

// This page creates DB records (get-or-create daily log + cycle entry)
// so it MUST be server-rendered on each request, never statically prerendered
export const dynamic = 'force-dynamic'

/**
 * Count consecutive days with a logged pain value,
 * working backwards from yesterday.
 */
function computeStreak(
  logs: { date: string; overall_pain: number | null }[]
): number {
  const byDate = new Map(logs.map((l) => [l.date, l.overall_pain]))
  let streak = 0
  for (let i = 1; i <= 30; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
    if (byDate.has(d) && byDate.get(d) !== null) {
      streak++
    } else {
      break
    }
  }
  return streak
}

export interface RecentMeal {
  meal_type: string | null
  food_items: string
  flagged_triggers: string[]
  logged_at: string
}

export default async function LogPage() {
  const sb = createServiceClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  // Get or create today's daily log
  const { data: existing } = await sb
    .from('daily_logs')
    .select('*')
    .eq('date', today)
    .maybeSingle()

  let log: DailyLog
  if (existing) {
    log = existing as DailyLog
  } else {
    const { data: created, error } = await sb
      .from('daily_logs')
      .insert({ date: today })
      .select()
      .single()
    if (error) throw new Error(`Failed to create today's log: ${error.message}`)
    log = created as DailyLog
  }

  // Get or create today's cycle entry
  const { data: existingCycle } = await sb
    .from('cycle_entries')
    .select('*')
    .eq('date', today)
    .maybeSingle()

  let cycleEntry: CycleEntry
  if (existingCycle) {
    cycleEntry = existingCycle as CycleEntry
  } else {
    const { data: createdCycle, error } = await sb
      .from('cycle_entries')
      .insert({ date: today, menstruation: false })
      .select()
      .single()
    if (error) throw new Error(`Failed to create cycle entry: ${error.message}`)
    cycleEntry = createdCycle as CycleEntry
  }

  // Fetch pain points, symptoms, food entries, recent meals, NC data, and streak in parallel
  const [painPointsResult, symptomsResult, foodResult, recentMealsResult, ncResult, streakLogsResult] = await Promise.all([
    sb
      .from('pain_points')
      .select('*')
      .eq('log_id', log.id)
      .order('logged_at', { ascending: false }),
    sb
      .from('symptoms')
      .select('*')
      .eq('log_id', log.id)
      .order('logged_at', { ascending: true }),
    sb
      .from('food_entries')
      .select('*')
      .eq('log_id', log.id)
      .order('logged_at', { ascending: false }),
    // Recent meals: last 7 days, limit 15, ordered by most recent
    sb
      .from('food_entries')
      .select('meal_type, food_items, flagged_triggers, logged_at')
      .gte('logged_at', `${sevenDaysAgo}T00:00:00`)
      .order('logged_at', { ascending: false })
      .limit(15),
    // Today's Natural Cycles data
    sb
      .from('nc_imported')
      .select('*')
      .eq('date', today)
      .maybeSingle(),
    // Last 30 days of logs for streak calculation
    sb
      .from('daily_logs')
      .select('date, overall_pain')
      .gte('date', thirtyDaysAgo)
      .lte('date', today)
      .order('date', { ascending: false }),
  ])

  const painPoints = (painPointsResult.data || []) as PainPoint[]
  const symptoms = (symptomsResult.data || []) as Symptom[]
  const foodEntries = (foodResult.data || []) as FoodEntry[]

  // Deduplicate recent meals by food_items text (keep most recent)
  const seenFoodItems = new Set<string>()
  const recentMeals: RecentMeal[] = []
  for (const row of (recentMealsResult.data || [])) {
    const foodText = (row.food_items ?? '').trim().toLowerCase()
    if (foodText && !seenFoodItems.has(foodText)) {
      seenFoodItems.add(foodText)
      recentMeals.push({
        meal_type: row.meal_type,
        food_items: row.food_items ?? '',
        flagged_triggers: row.flagged_triggers ?? [],
        logged_at: row.logged_at,
      })
    }
  }

  const ncData = (ncResult.data as NcImported | null) ?? null

  // Compute logging streak (consecutive days with non-null overall_pain, backwards from yesterday)
  const streakLogs = (streakLogsResult.data || []) as { date: string; overall_pain: number | null }[]
  const streak = computeStreak(streakLogs)

  return (
    <DailyLogClient
      log={log}
      painPoints={painPoints}
      symptoms={symptoms}
      foodEntries={foodEntries}
      cycleEntry={cycleEntry}
      recentMeals={recentMeals}
      ncData={ncData}
      streak={streak}
    />
  )
}
