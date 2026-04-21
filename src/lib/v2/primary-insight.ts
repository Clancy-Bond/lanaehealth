/**
 * Primary insight generator for the home screen.
 *
 * Returns a single, shippable sentence synchronously (no API call).
 * The sentence observes G3 honest-with-context: every claim includes
 * the data source it rests on.
 *
 * Philosophy: the user should never see an empty insight card. If we
 * have any signal, we say something truthful about it. If we do not,
 * we name the gap and point to a logging step that would fill it.
 *
 * An async Claude-routed upgrade pass is a future addition. Even then
 * the local sentence remains the contract: Claude refines tone, never
 * replaces the baseline.
 */

import type { OuraDaily } from '@/lib/types'
import type { CycleContext } from '@/lib/cycle/load-cycle-context'
import type { DayTotals } from '@/lib/calories/home-data'
import { bandForScore, deltaFromMedian, humanTimeAgo, secondsToHoursMinutes } from './home-signals'

export interface PrimaryInsightInput {
  today: string
  ouraTrend: OuraDaily[] // last 7 days inclusive of today
  cycle: CycleContext | null
  calories: DayTotals | null
}

export interface PrimaryInsight {
  /** Short label above the sentence, e.g. "Today's signal". */
  eyebrow: string
  /** Single-sentence insight. Always shippable, always honest. */
  sentence: string
  /**
   * Source attribution rendered as muted subtext. Keeps the main
   * sentence short while satisfying G3.
   */
  source: string
}

/**
 * Compose a single insight sentence from whatever signal is strongest
 * today. The priority order below was chosen to surface the signal
 * most likely to change tomorrow's choices.
 *
 *   1. Overnight Oura sleep score (the freshest bedside-table data)
 *   2. Cycle-phase orientation (the signal that shapes a week)
 *   3. HRV / resting HR trend (the early-flare tells)
 *   4. Calorie gap or quiet day prompt (the fallback)
 *
 * The priority is intentional. Sleep speaks loudest in the morning,
 * cycle phase orients the whole day, and HRV trends matter when the
 * first two are quiet. If you want a different lead, reorder the
 * branches.
 */
export function getPrimaryInsight({
  today,
  ouraTrend,
  cycle,
  calories,
}: PrimaryInsightInput): PrimaryInsight {
  const latest = ouraTrend[ouraTrend.length - 1] ?? null
  const isLatestToday = latest?.date === today

  // 1. Sleep score, only if we have last night's data.
  if (latest && isLatestToday && latest.sleep_score != null) {
    const band = bandForScore(latest.sleep_score)
    const duration = secondsToHoursMinutes(latest.sleep_duration)
    const delta = deltaFromMedian(ouraTrend.map((d) => d.sleep_score))
    const trendClause =
      delta == null
        ? ''
        : delta > 2
          ? ' and running above your recent pattern'
          : delta < -2
            ? ' and running below your recent pattern'
            : ''
    const opener =
      band === 'optimal'
        ? 'Last night landed in the optimal range'
        : band === 'good'
          ? 'Last night was a solid recovery'
          : band === 'fair'
            ? 'Last night was a fair recovery'
            : 'Last night asks for a gentler day'
    return {
      eyebrow: "Today's signal",
      sentence: `${opener}${trendClause}.`,
      source: `Based on your Oura sleep score of ${latest.sleep_score} and ${duration} of sleep.`,
    }
  }

  // 2. Cycle-phase orientation when we know where we are.
  if (cycle?.current?.day && cycle.current.phase) {
    const { day, phase, isUnusuallyLong } = cycle.current
    if (isUnusuallyLong) {
      return {
        eyebrow: 'Cycle check-in',
        sentence: `You are on day ${day}, running longer than usual; log a period if one started, otherwise this is information, not alarm.`,
        source: `Based on your last menstruation on ${cycle.current.lastPeriodStart ?? 'unknown date'}.`,
      }
    }
    const phraseByPhase: Record<typeof phase, string> = {
      menstrual: 'Rest is productive today; protein and iron-rich foods help recovery',
      follicular: 'Energy usually rises this week; consider the tougher tasks on your list',
      ovulatory: 'Your body is in its strongest-feeling phase; outputs here tend to be higher quality',
      luteal: 'Winding toward your period; sleep and gentle movement go further now',
    }
    // Fallback keeps the sentence shippable if CyclePhase gains a variant
    // without an updated phrase here. Better than rendering "undefined."
    const phrase =
      phraseByPhase[phase] ?? 'A new phase of your cycle; small signals are still settling'
    return {
      eyebrow: `${phase[0].toUpperCase()}${phase.slice(1)} phase`,
      sentence: `${phrase}.`,
      source: `Based on cycle day ${day} of your current cycle.`,
    }
  }

  // 3. HRV or resting HR trend when Oura data exists but not for today.
  if (ouraTrend.length >= 3) {
    const hrvDelta = deltaFromMedian(ouraTrend.map((d) => d.hrv_avg))
    const rhrDelta = deltaFromMedian(ouraTrend.map((d) => d.resting_hr))
    if (hrvDelta != null && Math.abs(hrvDelta) > 5) {
      const verb = hrvDelta > 0 ? 'climbing' : 'dipping'
      return {
        eyebrow: 'Recovery trend',
        sentence: `Your HRV is ${verb} against your recent pattern; worth watching how today lands.`,
        source: `Based on your last ${ouraTrend.length} days of Oura data. Latest reading ${humanTimeAgo(latest?.date ?? null, today)}.`,
      }
    }
    if (rhrDelta != null && rhrDelta > 3) {
      return {
        eyebrow: 'Recovery trend',
        sentence: `Your resting heart rate is running higher than usual; gentle pacing tends to help.`,
        source: `Based on your last ${ouraTrend.length} days of Oura data. Latest reading ${humanTimeAgo(latest?.date ?? null, today)}.`,
      }
    }
  }

  // 4. Calorie prompt as a fallback when there is nothing else loud.
  if (calories && calories.entryCount === 0) {
    return {
      eyebrow: 'Today',
      sentence: 'A quiet day of data so far; a quick meal log or mood note keeps your pattern-finding honest.',
      source: 'Based on zero entries logged today.',
    }
  }

  // 5. Final fallback when the patient has almost no data for today.
  return {
    eyebrow: 'Today',
    sentence: 'Logging a few check-ins today will sharpen what this screen can tell you tomorrow.',
    source: `Based on limited data available for ${today}.`,
  }
}
