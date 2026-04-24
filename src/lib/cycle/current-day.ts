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
 *   1. Query cycle_entries.menstruation = true and nc_imported menstrual
 *      signals over a 90-day window. Menstrual signal for an nc row =
 *      menstruation = 'MENSTRUATION' (user-confirmed) OR flow_quantity is
 *      non-null (NC's own period record, which includes its predicted
 *      cycle starts when the user has not opened the app in a few weeks).
 *      SPOTTING is still excluded. Treating flow_quantity as a signal
 *      was added 2026-04-18 after the home page wrongly reported 51 days
 *      since the last period: NC had flow_quantity populated for cycle
 *      #48 (Mar 22) and cycle #49 (Apr 18) but the confirmed MENSTRUATION
 *      strings were not set, so the prior helper ignored them.
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
      .select('date, menstruation, flow_quantity')
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
    flow_quantity: string | null
  }>

  return computeCycleDayFromRows(targetIso, cycles, nc)
}

/**
 * Pure function that computes cycle day from already-loaded menstruation
 * rows. Exported separately so unit tests can inject fixtures without mocking
 * Supabase and so callers that already hold the rows (e.g. prefill with its
 * own cycle history query) can avoid a duplicate round trip later if desired.
 *
 * `meanCycleLength` (optional) lets callers pass in the user's personal
 * cycle length so phase boundaries scale. When omitted, we fall back to
 * the textbook 28-day model. Per NC's methodology, the luteal phase is
 * approximately fixed at ~14 days while the follicular phase absorbs
 * cycle-length variability; a 32-day cycler gets a longer follicular
 * phase, not a longer luteal phase.
 */
export function computeCycleDayFromRows(
  targetIso: string,
  cycles: Array<{ date: string; menstruation: boolean | null }>,
  nc: Array<{
    date: string
    menstruation: string | null
    flow_quantity?: string | null
  }>,
  meanCycleLength?: number | null,
): CurrentCycleDay {
  const menstrualDaysFromCycles = cycles.filter(c => c.menstruation).map(c => c.date)
  const menstrualDaysFromNc = nc
    .filter(
      n =>
        n.menstruation === 'MENSTRUATION' ||
        (n.flow_quantity != null && n.menstruation !== 'SPOTTING'),
    )
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

  // All date math here parses YYYY-MM-DD as UTC midnight explicitly. The
  // bare `new Date('2026-04-23')` form parses as LOCAL midnight in some V8
  // versions and as UTC midnight in others; mixing the two on the same
  // process timezone produced an off-by-one cycle day in earlier audits.
  // Pinning every parse to T00:00:00Z removes the drift regardless of the
  // server's TZ.
  let lastPeriodStart = menstrualDays[0]
  for (let i = 1; i < menstrualDays.length; i++) {
    const diffDays =
      (Date.parse(menstrualDays[i - 1] + 'T00:00:00Z') -
        Date.parse(menstrualDays[i] + 'T00:00:00Z')) /
      (24 * 60 * 60 * 1000)
    if (diffDays <= 2) {
      lastPeriodStart = menstrualDays[i]
    } else {
      break
    }
  }

  const daysSinceLastPeriod = Math.floor(
    (Date.parse(targetIso + 'T00:00:00Z') -
      Date.parse(lastPeriodStart + 'T00:00:00Z')) /
      (24 * 60 * 60 * 1000),
  )
  const day = daysSinceLastPeriod + 1

  return {
    day,
    phase: phaseFromDay(day, meanCycleLength ?? null),
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
 *
 * When `meanCycleLength` is provided, phase boundaries scale with the
 * user's actual cycle length. NC's published methodology treats the
 * luteal phase as near-fixed (~14 days) while the follicular phase
 * absorbs the variance. Examples:
 *   - 28-day cycler: menstrual 1-5, follicular 6-12, ovulatory 13-15, luteal 16+
 *   - 32-day cycler: menstrual 1-5, follicular 6-16, ovulatory 17-19, luteal 20+
 *   - 24-day cycler: menstrual 1-4, follicular 5-8, ovulatory 9-11, luteal 12+
 * When `meanCycleLength` is null we keep the textbook 28-day fallback.
 */
export function phaseFromDay(day: number, meanCycleLength: number | null = null): CyclePhase {
  if (meanCycleLength == null || !Number.isFinite(meanCycleLength) || meanCycleLength < 18) {
    if (day <= 5) return 'menstrual'
    if (day <= 13) return 'follicular'
    if (day <= 16) return 'ovulatory'
    return 'luteal'
  }
  const m = Math.round(meanCycleLength)
  // Ovulation typically happens CD (m - 14); we give a 3-day window
  // centered on that anchor, bounded by the actual cycle shape.
  const ovAnchor = Math.max(10, m - 14)
  const ovStart = Math.max(6, ovAnchor - 1)
  const ovEnd = Math.min(m - 1, ovAnchor + 1)
  // Menstrual keeps its 1-5 convention unless the cycle is extremely
  // short (<=20 days); we shrink proportionally if so.
  const menstrualEnd = m < 22 ? Math.max(3, Math.min(5, Math.round(m * 0.2))) : 5
  if (day <= menstrualEnd) return 'menstrual'
  if (day < ovStart) return 'follicular'
  if (day <= ovEnd) return 'ovulatory'
  return 'luteal'
}
