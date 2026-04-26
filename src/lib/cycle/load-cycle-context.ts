/**
 * Shared data loader for cycle-aware surfaces.
 *
 * One query window, one computation, reused across /cycle landing,
 * /cycle/predict, and the three home widgets. Each widget on home is its
 * own RSC and would otherwise query the same rows independently; callers
 * that need a guaranteed single round-trip can memoize at the page level
 * instead. For now we accept the small N duplication to keep widgets
 * independent.
 *
 * Wave 1 (2026-04-23) of the cycle deep rebuild adds:
 *   - reads of nc_imported.{temperature, fertility_color, cycle_day,
 *     ovulation_status, lh_test} which prior versions discarded.
 *   - bbt source (Oura primary, NC fallback, manual last) via bbt-source.ts.
 *   - cover line (personal moving baseline) via cover-line.ts.
 *   - signal fusion (BBT + LH + calendar) via signal-fusion.ts.
 *   - the date's NC-imported fertility color when present, surfaced as
 *     `ncFertilityColorToday` so callers can prefer NC's verdict.
 *
 * Multi-user scoping (PR #115 follow-up): callers pass `userId` so the
 * loader can scope every query by user_id. When the user_id column is
 * not yet present (pre-migration 035), the queries gracefully fall back
 * to unfiltered reads via `runScopedQuery`. NEVER does user A see user
 * B's rows, in either state. See `src/lib/auth/scope-query.ts`.
 */
import { createServiceClient } from '@/lib/supabase'
import { runScopedQuery } from '@/lib/auth/scope-query'
import { trace } from '@/lib/observability/tracing'
import { computeCycleDayFromRows, type CurrentCycleDay } from './current-day'
import { computeCycleStats, type CycleStats } from './cycle-stats'
import {
  predictFertileWindow,
  predictNextPeriod,
  type FertileWindowPrediction,
  type PeriodPrediction,
} from './period-prediction'
import { loadBbtLog, detectOvulationShift, type BbtLog } from './bbt-log'
import { mergeBbtSources, type BbtReading } from './bbt-source'
import { computeCoverLine, type CoverLineResult } from './cover-line'
import {
  fuseOvulationSignal,
  type FusionResult,
  type LhTestEntry,
  type NcImportedColor,
} from './signal-fusion'

export interface CycleContext {
  today: string
  current: CurrentCycleDay
  stats: CycleStats
  periodPrediction: PeriodPrediction
  fertilePrediction: FertileWindowPrediction
  bbtLog: BbtLog
  confirmedOvulation: boolean
  /** New (Wave 1): unified BBT stream merged across Oura + NC + manual. */
  bbtReadings: BbtReading[]
  /** New (Wave 1): personal moving baseline computed from bbtReadings. */
  coverLine: CoverLineResult
  /** New (Wave 1): fused ovulation signal. */
  ovulation: FusionResult
  /**
   * New (Wave 1): NC's own daily verdict for `today`, when present in
   * nc_imported. Callers that render the binary fertile/not-fertile
   * status MUST prefer this over our recomputation.
   */
  ncFertilityColorToday: 'GREEN' | 'RED' | null
  /**
   * New (Wave 1): NC's own ovulation_status for `today`, when present.
   * 'OVU_CONFIRMED' is gold-standard.
   */
  ncOvulationStatusToday: 'OVU_CONFIRMED' | 'OVU_PREDICTION' | 'OVU_NOT_CONFIRMED' | null
}

/**
 * Load the cycle context for a target date. We pull 365 days of menstrual
 * history so cycle-stats can compute a meaningful SD even when NC's
 * imported cycles are older than 90 days.
 *
 * Pass `userId` to scope the queries to a specific user. Server pages
 * resolve it via getCurrentUser() before calling. Omitted userId falls
 * back to the legacy unfiltered single-user view.
 */
export async function loadCycleContext(
  todayISO: string,
  userId?: string | null,
): Promise<CycleContext> {
  return trace(
    {
      name: 'loadCycleContext',
      op: 'function',
      attributes: { has_user_id: Boolean(userId) },
    },
    () => loadCycleContextInner(todayISO, userId),
  )
}

async function loadCycleContextInner(
  todayISO: string,
  userId?: string | null,
): Promise<CycleContext> {
  const sb = createServiceClient()
  const yearAgo = new Date(new Date(todayISO + 'T00:00:00Z').getTime() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [cycleResult, ncResult, ouraResult, bbtLog] = await Promise.all([
    runScopedQuery({
      table: 'cycle_entries',
      userId,
      withFilter: () =>
        sb
          .from('cycle_entries')
          .select('date, menstruation, lh_test_result')
          .gte('date', yearAgo)
          .lte('date', todayISO)
          .eq('user_id', userId as string)
          .order('date', { ascending: true }),
      withoutFilter: () =>
        sb
          .from('cycle_entries')
          .select('date, menstruation, lh_test_result')
          .gte('date', yearAgo)
          .lte('date', todayISO)
          .order('date', { ascending: true }),
    }),
    runScopedQuery({
      table: 'nc_imported',
      userId,
      withFilter: () =>
        sb
          .from('nc_imported')
          .select(
            'date, menstruation, flow_quantity, temperature, cycle_day, fertility_color, ovulation_status, lh_test',
          )
          .gte('date', yearAgo)
          .lte('date', todayISO)
          .eq('user_id', userId as string)
          .order('date', { ascending: true }),
      withoutFilter: () =>
        sb
          .from('nc_imported')
          .select(
            'date, menstruation, flow_quantity, temperature, cycle_day, fertility_color, ovulation_status, lh_test',
          )
          .gte('date', yearAgo)
          .lte('date', todayISO)
          .order('date', { ascending: true }),
    }),
    runScopedQuery({
      table: 'oura_daily',
      userId,
      withFilter: () =>
        sb
          .from('oura_daily')
          .select('date, body_temp_deviation')
          .gte('date', yearAgo)
          .lte('date', todayISO)
          .eq('user_id', userId as string)
          .order('date', { ascending: true }),
      withoutFilter: () =>
        sb
          .from('oura_daily')
          .select('date, body_temp_deviation')
          .gte('date', yearAgo)
          .lte('date', todayISO)
          .order('date', { ascending: true }),
    }),
    loadBbtLog(),
  ])

  const cycleEntries = (cycleResult.data ?? []) as Array<{
    date: string
    menstruation: boolean | null
    lh_test_result: string | null
  }>
  const ncImported = (ncResult.data ?? []) as Array<{
    date: string
    menstruation: string | null
    flow_quantity: string | null
    temperature: number | null
    cycle_day: number | null
    fertility_color: 'GREEN' | 'RED' | null
    ovulation_status: 'OVU_CONFIRMED' | 'OVU_PREDICTION' | 'OVU_NOT_CONFIRMED' | null
    lh_test: string | null
  }>
  const ouraRows = (ouraResult.data ?? []) as Array<{
    date: string
    body_temp_deviation: number | null
  }>

  // Stats first, so cycle-day can adapt phase boundaries to the user's
  // actual mean cycle length. NC adjusts phase boundaries per-user; the
  // textbook 28-day boundaries would mis-classify a 32-day cycler's
  // mid-cycle days as ovulatory when they are still follicular.
  const stats = computeCycleStats({ cycleEntries, ncImported })
  const current = computeCycleDayFromRows(
    todayISO,
    cycleEntries,
    ncImported,
    stats.meanCycleLength,
  )
  const periodPrediction = predictNextPeriod({ today: todayISO, stats })
  const confirmedOvulation = detectOvulationShift(bbtLog)

  // Merge unified BBT sources. Oura wins per-date, then NC import, then manual.
  const bbtReadings = mergeBbtSources({
    oura: ouraRows,
    ncImported: ncImported.map((r) => ({ date: r.date, temperature: r.temperature })),
    manual: bbtLog.entries,
  })
  const coverLine = computeCoverLine(bbtReadings)

  // Pull LH tests from both sources. nc_imported.lh_test is a free-form
  // string (NC's own export uses 'POSITIVE' / 'NEGATIVE'); cycle_entries
  // uses lh_test_result. Normalize both.
  const lhTests: LhTestEntry[] = []
  for (const r of cycleEntries) {
    const v = (r.lh_test_result ?? '').toLowerCase()
    if (v === 'positive') lhTests.push({ date: r.date, result: 'positive' })
    else if (v === 'negative') lhTests.push({ date: r.date, result: 'negative' })
  }
  for (const r of ncImported) {
    const v = (r.lh_test ?? '').toUpperCase()
    if (v === 'POSITIVE') lhTests.push({ date: r.date, result: 'positive' })
    else if (v === 'NEGATIVE') lhTests.push({ date: r.date, result: 'negative' })
  }

  // Restrict signal-fusion inputs to the current cycle window for
  // performance and to avoid old-cycle BBT shifts contaminating today's
  // verdict.
  const cycleStartIso = stats.currentCycle?.startDate ?? null
  const inCycle = (date: string): boolean =>
    cycleStartIso != null ? date >= cycleStartIso && date <= todayISO : true

  const ncForFusion: NcImportedColor[] = ncImported
    .filter((r) => inCycle(r.date))
    .map((r) => ({
      date: r.date,
      fertility_color: r.fertility_color,
      ovulation_status: r.ovulation_status,
      cycle_day: r.cycle_day,
    }))

  const ovulation = fuseOvulationSignal({
    cycleStartIso,
    bbt: bbtReadings.filter((r) => inCycle(r.date)),
    lhTests: lhTests.filter((t) => inCycle(t.date)),
    ncRows: ncForFusion,
    meanCycleLength: stats.meanCycleLength,
  })

  // Wave 4: predictFertileWindow now consumes ovulation as the source of
  // truth when BBT or NC has confirmed it. Calendar is the documented
  // fallback. One verdict instead of two parallel ones.
  const fertilePrediction = predictFertileWindow({ today: todayISO, stats, ovulation })

  // NC's verdict for today, if NC has imported data for today.
  const todayNcRow = ncImported.find((r) => r.date === todayISO) ?? null
  const ncFertilityColorToday = todayNcRow?.fertility_color ?? null
  const ncOvulationStatusToday = todayNcRow?.ovulation_status ?? null

  return {
    today: todayISO,
    current,
    stats,
    periodPrediction,
    fertilePrediction,
    bbtLog,
    confirmedOvulation,
    bbtReadings,
    coverLine,
    ovulation,
    ncFertilityColorToday,
    ncOvulationStatusToday,
  }
}
