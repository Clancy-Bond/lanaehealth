import { createServiceClient } from '@/lib/supabase'
import type {
  DailyLog, PainPoint, Symptom, FoodEntry, CycleEntry, NcImported,
  MoodEntry, SleepDetail, CustomTrackable, CustomTrackableEntry, GratitudeEntry,
  LogPeriod, OuraDaily,
} from '@/lib/types'
import { format, subDays } from 'date-fns'
import DailyStoryClient from '@/components/log/DailyStoryClient'
import { assemblePrefill } from '@/lib/log/prefill'
import EnergyModeToggle from '@/components/log/EnergyModeToggle'
import EnergyModeBanner from '@/components/log/EnergyModeBanner'
import RestDayCard from '@/components/log/RestDayCard'
import HeadacheQuickLog from '@/components/log/HeadacheQuickLog'
import NutrientRollupCard from '@/components/log/NutrientRollupCard'
import LiteLogCard from '@/components/log/LiteLogCard'
import { inferEnergyMode } from '@/lib/intelligence/energy-inference'
import { getResolvedTargets } from '@/lib/api/nutrient-targets'

// This page creates DB records (get-or-create daily log + cycle entry)
// so it MUST be server-rendered on each request, never statically prerendered
export const dynamic = 'force-dynamic'

/**
 * Count days in the last 7 where Lanae logged any pain value.
 *
 * Non-shaming voice: we show a positive presence count (how many days
 * she checked in), never a streak or percentage. Missed days are
 * invisible -- we celebrate when she logs and stay silent when she
 * does not. See docs/plans/2026-04-16-non-shaming-voice-rule.md.
 */
function computeCheckInsThisWeek(
  logs: { date: string; overall_pain: number | null }[]
): number {
  const byDate = new Map(logs.map((l) => [l.date, l.overall_pain]))
  let count = 0
  for (let i = 0; i < 7; i++) {
    const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
    if (byDate.has(d) && byDate.get(d) !== null) {
      count++
    }
  }
  return count
}

export interface RecentMeal {
  meal_type: string | null
  food_items: string
  flagged_triggers: string[]
  logged_at: string
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const params = await searchParams
  const period = (['morning', 'afternoon', 'evening'].includes(params.period ?? '')
    ? params.period
    : undefined) as LogPeriod | undefined
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

  // Fetch all data in parallel (existing + new Bearable-killer data)
  const [painPointsResult, symptomsResult, foodResult, recentMealsResult, ncResult, recentLogsResult, moodResult, sleepDetailResult, trackablesResult, trackableEntriesResult, gratitudeResult] = await Promise.all([
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
    // Last 30 days of logs for check-in count (non-shaming voice)
    sb
      .from('daily_logs')
      .select('date, overall_pain')
      .gte('date', thirtyDaysAgo)
      .lte('date', today)
      .order('date', { ascending: false }),
    // Mood entry for today
    sb
      .from('mood_entries')
      .select('*')
      .eq('log_id', log.id)
      .maybeSingle(),
    // Sleep details for today
    sb
      .from('sleep_details')
      .select('*')
      .eq('log_id', log.id)
      .maybeSingle(),
    // Custom trackable definitions (active only)
    sb
      .from('custom_trackables')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    // Custom trackable entries for today
    sb
      .from('custom_trackable_entries')
      .select('*')
      .eq('log_id', log.id),
    // Gratitude entries for today
    sb
      .from('gratitude_entries')
      .select('*')
      .eq('log_id', log.id)
      .order('logged_at', { ascending: true }),
  ])

  // Fetch user preferences for module filtering
  const { data: prefsRow } = await sb
    .from('user_preferences')
    .select('enabled_modules')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const enabledModules = (prefsRow?.enabled_modules as string[] | null) ?? undefined

  // Wave 2d D5: active_problems catalog for the ConditionTagSelector on
  // SymptomPills. Non-resolved only; order matches the doctor page.
  const { data: activeProblemsRaw } = await sb
    .from('active_problems')
    .select('id, problem')
    .neq('status', 'resolved')
    .order('updated_at', { ascending: false })
  const availableConditions = ((activeProblemsRaw ?? []) as Array<{ id: string; problem: string }>).map(
    (p) => ({ id: p.id, label: p.problem }),
  )

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

  // New Bearable-killer data
  const initialMood = (moodResult.data as MoodEntry | null) ?? null
  const initialSleepDetail = (sleepDetailResult.data as SleepDetail | null) ?? null
  const initialTrackables = (trackablesResult.data || []) as CustomTrackable[]
  const initialTrackableEntries = (trackableEntriesResult.data || []) as CustomTrackableEntry[]
  const initialGratitudes = (gratitudeResult.data || []) as GratitudeEntry[]

  // Count days in the last 7 where Lanae logged pain -- positive presence
  // count only. No streak, no percentage, no shame. See non-shaming voice rule.
  const recentLogs = (recentLogsResult.data || []) as { date: string; overall_pain: number | null }[]
  const checkInsThisWeek = computeCheckInsThisWeek(recentLogs)

  const prefill = await assemblePrefill(today)

  // ── Wave 2a signals for EnergyMode + Nutrient components ─────────────
  // Pulled server-side so the inference is a pure function call. If any
  // query fails the result is treated as "no signal" and the banner
  // self-hides via usedFallback. Nutrient targets come from migration 017
  // (currently pending DB creds), so getResolvedTargets falls back to RDAs.
  const yesterdayDate = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const [latestOuraResult, yesterdayLogResult, resolvedTargets] = await Promise.all([
    sb
      .from('oura_daily')
      .select('*')
      .lte('date', today)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('daily_logs')
      .select('overall_pain')
      .eq('date', yesterdayDate)
      .maybeSingle(),
    getResolvedTargets().catch(() => []),
  ])
  const latestOura = (latestOuraResult.data as OuraDaily | null) ?? null
  const yesterdayPain = (yesterdayLogResult.data?.overall_pain as number | null) ?? null
  const energyInference = inferEnergyMode({
    readinessScore: latestOura?.readiness_score ?? null,
    cyclePhase: log.cycle_phase ?? null,
    yesterdayPain,
    sleepHours: latestOura?.sleep_duration != null
      ? latestOura.sleep_duration / 3600
      : null,
  })

  return (
    <div style={{ background: '#FAFAF7' }}>
      {/* Wave 2a: Energy mode surface at the top of the log page. */}
      <div
        className="mx-auto max-w-2xl route-desktop-wide px-4 pt-4 space-y-3"
      >
        <EnergyModeBanner inference={energyInference} userOverrodeTo={log.energy_mode ?? null} />
        <EnergyModeToggle
          logId={log.id}
          initialMode={log.energy_mode ?? null}
          suggestedMode={energyInference.mode}
        />
        {/* Wave 2e F2: 30-second lite log. Positive choice on low-energy
            days, not a fallback. Writes mood_entries + custom_trackable_entries
            to the same tables as the full log. */}
        <LiteLogCard
          logId={log.id}
          initialMood={initialMood}
          trackables={initialTrackables}
          trackableEntries={initialTrackableEntries}
        />
        <RestDayCard logId={log.id} initialIsRestDay={log.rest_day ?? false} />
        <HeadacheQuickLog />
        <NutrientRollupCard targets={resolvedTargets} intake={{}} dateISO={today} />
      </div>

      <DailyStoryClient
        log={log}
        prefill={prefill}
        painPoints={painPoints}
        symptoms={symptoms}
        foodEntries={foodEntries}
        cycleEntry={cycleEntry}
        recentMeals={recentMeals}
        ncData={ncData}
        checkInsThisWeek={checkInsThisWeek}
        initialMood={initialMood}
        initialSleepDetail={initialSleepDetail}
        initialTrackables={initialTrackables}
        initialTrackableEntries={initialTrackableEntries}
        initialGratitudes={initialGratitudes}
        period={period}
        enabledModules={enabledModules}
        availableConditions={availableConditions}
      />
    </div>
  )
}
