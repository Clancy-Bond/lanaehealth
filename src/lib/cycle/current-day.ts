/**
 * Shared cycle-day helper: THE ONE SOURCE OF TRUTH for current cycle day
 * across the entire app. Every surface (home page, log prefill, intelligence
 * dashboard, reports) MUST call this helper; do not re-implement the logic
 * anywhere else.
 *
 * Why this file exists:
 *   Previously, three different code paths computed cycle day differently and
 *   disagreed on the same day (home=27, prefill=47, intelligence=51). See
 *   docs/qa/2026-04-16-cycle-day-three-values.md for the original divergence
 *   and docs/qa/session-2-matrix.md W2.1 for the unification design.
 *
 * Algorithm (mirrors src/lib/ai/cycle-intelligence.ts, which remains the
 * authoritative signal-intelligence engine):
 *   1. Query cycle_entries.menstruation = true and nc_imported.menstruation
 *      = 'MENSTRUATION' over a 90-day window. SPOTTING is excluded.
 *   2. Union both sources, deduplicate by ISO date.
 *   3. Sort descending and walk backwards from the most recent menstrual day,
 *      treating consecutive runs (gap <= 2 days) as one period. Land on the
 *      first day of the most recent run.
 *   4. cycleDay = floor((today - lastPeriodStart) / 86400000) + 1.
 *   5. Phase is derived from cycleDay via a standard calendar model when the
 *      signal engine is not available here.
 *
 * Keep this helper small: just {day, phase, lastPeriodStart}. The rich
 * signal-aware phase detection lives in analyzeCycleIntelligence; callers
 * who need ovulation/fertile-window data should call that directly.
 */

import { createServiceClient } from '@/lib/supabase'
import type { CyclePhase } from '@/lib/types'

/**
 * Upper bound of a "normal" cycle in days. Cycles of 21-35 days are
 * considered typical per ACOG; anything longer is oligomenorrhea-range and
 * worth surfacing to the user so they can either log a missed period or
 * flag a genuine anovulatory/endo flare.
 *
 * We treat cycleDay > this threshold as "unusually long" in the UI. The
 * raw day value is still returned truthfully (we do NOT cap it); the flag
 * just lets callers render context-aware framing.
 */
export const UNUSUALLY_LONG_CYCLE_DAY_THRESHOLD = 35

export interface CurrentCycleDay {
  /** 1-indexed cycle day, or null when no menstruation data is available. */
  day: number | null
  /** Calendar-derived phase, or null when day is null. */
  phase: CyclePhase | null
  /** ISO date of the most recent period's first day, or null. */
  lastPeriodStart: string | null
  /**
   * True when the computed cycle day exceeds
   * UNUSUALLY_LONG_CYCLE_DAY_THRESHOLD. Callers should display the raw day
   * alongside an informational note inviting the user to log a missed
   * period or confirm this is a genuine long cycle. NEVER silently cap the
   * displayed value: the number itself is clinically meaningful.
   */
  isUnusuallyLong: boolean
  /**
   * Whole days between lastPeriodStart and the target date. Equivalent to
   * day - 1 when day is non-null, null otherwise. Exposed separately so
   * copy like "Last period X days ago" doesn't have to re-derive it.
   */
  daysSinceLastPeriod: number | null
}

/**
 * Compute the patient's cycle day for a target date using the union of
 * cycle_entries + nc_imported menstrual days.
 *
 * @param today ISO date string (YYYY-MM-DD) to evaluate against. Defaults to
 *              the server's current UTC date when omitted.
 */
export async function getCurrentCycleDay(
  today?: string,
): Promise<CurrentCycleDay> {
  const targetIso = today ?? new Date().toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(
    new Date(targetIso + 'T00:00:00Z').getTime() - 90 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10)

  const sb = createServiceClient()

  const [cycleResult, ncResult] = await Promise.all([
    sb
      .from('cycle_entries')
      .select('date, menstruation')
      .gte('date', ninetyDaysAgo)
      .lte('date', targetIso)
      .order('date', { ascending: true }),
    sb
      .from('nc_imported')
      .select('date, menstruation')
      .gte('date', ninetyDaysAgo)
      .lte('date', targetIso)
      .order('date', { ascending: true }),
  ])

  const cycles = (cycleResult.data ?? []) as Array<{
    date: string
    menstruation: boolean | null
  }>
  const nc = (ncResult.data ?? []) as Array<{
    date: string
    menstruation: string | null
  }>

  return computeCycleDayFromRows(targetIso, cycles, nc)
}

/**
 * Pure function that computes cycle day from already-loaded menstruation
 * rows. Exported separately so unit tests can inject fixtures without mocking
 * Supabase and so callers that already hold the rows (e.g. prefill with its
 * own cycle history query) can avoid a duplicate round trip later if desired.
 */
export function computeCycleDayFromRows(
  targetIso: string,
  cycles: Array<{ date: string; menstruation: boolean | null }>,
  nc: Array<{ date: string; menstruation: string | null }>,
): CurrentCycleDay {
  const menstrualDaysFromCycles = cycles.filter(c => c.menstruation).map(c => c.date)
  const menstrualDaysFromNc = nc
    .filter(n => n.menstruation === 'MENSTRUATION')
    .map(n => n.date)

  const menstrualDays = Array.from(
    new Set([...menstrualDaysFromCycles, ...menstrualDaysFromNc]),
  )
    .sort()
    .reverse()

  if (menstrualDays.length === 0) {
    return {
      day: null,
      phase: null,
      lastPeriodStart: null,
      isUnusuallyLong: false,
      daysSinceLastPeriod: null,
    }
  }

  let lastPeriodStart = menstrualDays[0]
  for (let i = 1; i < menstrualDays.length; i++) {
    const diffDays =
      (new Date(menstrualDays[i - 1]).getTime() -
        new Date(menstrualDays[i]).getTime()) /
      (24 * 60 * 60 * 1000)
    if (diffDays <= 2) {
      lastPeriodStart = menstrualDays[i]
    } else {
      break
    }
  }

  const daysSinceLastPeriod = Math.floor(
    (new Date(targetIso).getTime() - new Date(lastPeriodStart).getTime()) /
      (24 * 60 * 60 * 1000),
  )
  const day = daysSinceLastPeriod + 1

  return {
    day,
    phase: phaseFromDay(day),
    lastPeriodStart,
    isUnusuallyLong: day > UNUSUALLY_LONG_CYCLE_DAY_THRESHOLD,
    daysSinceLastPeriod,
  }
}

/**
 * Calendar-model phase derivation. Mirrors src/app/page.tsx's
 * estimateCyclePhase and the calendar-fallback branch inside
 * analyzeCycleIntelligence.determineCyclePhase. Ovulation-signal-aware phase
 * detection stays inside cycle-intelligence.ts.
 */
function phaseFromDay(day: number): CyclePhase {
  if (day <= 5) return 'menstrual'
  if (day <= 13) return 'follicular'
  if (day <= 16) return 'ovulatory'
  return 'luteal'
}
