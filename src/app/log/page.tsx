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
import LiteLogCard from '@/components/log/LiteLogCard'
import PrnEffectivenessPoll from '@/components/log/PrnEffectivenessPoll'
import SymptomCarousel from '@/components/symptoms/SymptomCarousel'
import Link from 'next/link'
import { inferEnergyMode } from '@/lib/intelligence/energy-inference'
import { getOpenInAppPolls } from '@/lib/api/prn-doses'

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

/**
 * Wave 2d D5: client-safe view of `active_problems` for ConditionTagSelector.
 * Only {id, label} cross the server/client boundary so heavy clinical notes
 * (latest_data, onset, status) stay server-side.
 */
export interface ActiveProblemOption {
  id: string
  label: string
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
  const [painPointsResult, symptomsResult, foodResult, recentMealsResult, ncResult, streakLogsResult, moodResult, sleepDetailResult, trackablesResult, trackableEntriesResult, gratitudeResult] = await Promise.all([
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

  // Wave 2d D5: active_problems as condition options for the tag selector.
  // Fetched outside the batch above so a failure here never blocks the log
  // page. Tagging is optional and we degrade silently to "no options".
  const { data: activeProblemsRaw } = await sb
    .from('active_problems')
    .select('id, problem, status')
    .in('status', ['active', 'investigating', 'improving'])
    .order('problem', { ascending: true })
  const activeProblems: ActiveProblemOption[] = (activeProblemsRaw ?? []).map(
    (row) => ({ id: row.id as string, label: row.problem as string })
  )

  // Fetch user preferences for module filtering
  const { data: prefsRow } = await sb
    .from('user_preferences')
    .select('enabled_modules')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const enabledModules = (prefsRow?.enabled_modules as string[] | null) ?? undefined

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

  // Compute logging streak (consecutive days with non-null overall_pain, backwards from yesterday)
  const streakLogs = (streakLogsResult.data || []) as { date: string; overall_pain: number | null }[]
  const streak = computeStreak(streakLogs)

  const prefill = await assemblePrefill(today)

  // ── Wave 2a signals for EnergyMode + Nutrient components ─────────────
  // Pulled server-side so the inference is a pure function call. If any
  // query fails the result is treated as "no signal" and the banner
  // self-hides via usedFallback. Nutrient targets come from migration 017
  // (currently pending DB creds), so getResolvedTargets falls back to RDAs.
  const yesterdayDate = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const [latestOuraResult, yesterdayLogResult] = await Promise.all([
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

  // Wave 2e F7: seed the in-app PRN efficacy poll surface. Any dose
  // whose poll_scheduled_for has passed (and has not yet been answered
  // or aged out of the grace window) surfaces here as a "Did X help?"
  // card. Fallback path for iOS PWA push unreliability.
  const openPrnPolls = await getOpenInAppPolls().catch(() => [])

  return (
    <div style={{ background: '#FAFAF7' }}>
      {/* Wave 2a: Energy mode surface at the top of the log page. */}
      <div
        className="mx-auto max-w-2xl route-desktop-wide px-4 pt-4 space-y-3"
      >
        {/* Symptoms clone (Bearable): Pill carousel with per-entry timestamps.
            Replaces the 6-hour-block model. Saves via /api/symptoms/quick-log. */}
        <SymptomCarousel initialSymptoms={symptoms} />
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/log/quick"
            style={{
              flex: 1,
              minWidth: 140,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              color: 'var(--accent-sage)',
              border: '1px solid var(--accent-sage)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Ten-second log
          </Link>
          <Link
            href="/log/attack"
            style={{
              flex: 1,
              minWidth: 140,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              color: 'var(--accent-sage)',
              border: '1px solid var(--accent-sage)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Start attack timer
          </Link>
          <Link
            href="/symptoms"
            style={{
              flex: 1,
              minWidth: 140,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(107,144,128,0.2)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            All symptoms
          </Link>
        </div>
        {/* Wave 2e F7: PRN efficacy poll surfaces inline when a dose's
            90-min follow-up is due. In-app fallback for iOS push. */}
        <PrnEffectivenessPoll initialPolls={openPrnPolls} />
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
        <div id="headache">
          <HeadacheQuickLog />
        </div>
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
        streak={streak}
        initialMood={initialMood}
        initialSleepDetail={initialSleepDetail}
        initialTrackables={initialTrackables}
        initialTrackableEntries={initialTrackableEntries}
        initialGratitudes={initialGratitudes}
        period={period}
        enabledModules={enabledModules}
        activeProblems={activeProblems}
      />
    </div>
  )
}
