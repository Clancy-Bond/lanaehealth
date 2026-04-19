/**
 * Shared data loader for cycle-aware surfaces.
 *
 * One query window, one computation, reused across /cycle landing,
 * /cycle/predict, and the three home widgets. Each widget on home is its
 * own RSC and would otherwise query the same rows independently; callers
 * that need a guaranteed single round-trip can memoize at the page level
 * instead. For now we accept the small N duplication to keep widgets
 * independent.
 */
import { createServiceClient } from '@/lib/supabase'
import { computeCycleDayFromRows, type CurrentCycleDay } from './current-day'
import { computeCycleStats, type CycleStats } from './cycle-stats'
import {
  predictFertileWindow,
  predictNextPeriod,
  type FertileWindowPrediction,
  type PeriodPrediction,
} from './period-prediction'
import { loadBbtLog, detectOvulationShift, type BbtLog } from './bbt-log'

export interface CycleContext {
  today: string
  current: CurrentCycleDay
  stats: CycleStats
  periodPrediction: PeriodPrediction
  fertilePrediction: FertileWindowPrediction
  bbtLog: BbtLog
  confirmedOvulation: boolean
}

/**
 * Load the cycle context for a target date. We pull 365 days of menstrual
 * history so cycle-stats can compute a meaningful SD even when NC's
 * imported cycles are older than 90 days.
 */
export async function loadCycleContext(todayISO: string): Promise<CycleContext> {
  const sb = createServiceClient()
  const yearAgo = new Date(new Date(todayISO + 'T00:00:00Z').getTime() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [cycleResult, ncResult, bbtLog] = await Promise.all([
    sb
      .from('cycle_entries')
      .select('date, menstruation')
      .gte('date', yearAgo)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
    sb
      .from('nc_imported')
      .select('date, menstruation, flow_quantity')
      .gte('date', yearAgo)
      .lte('date', todayISO)
      .order('date', { ascending: true }),
    loadBbtLog(),
  ])

  const cycleEntries = (cycleResult.data ?? []) as Array<{ date: string; menstruation: boolean | null }>
  const ncImported = (ncResult.data ?? []) as Array<{
    date: string
    menstruation: string | null
    flow_quantity: string | null
  }>

  const current = computeCycleDayFromRows(todayISO, cycleEntries, ncImported)
  const stats = computeCycleStats({ cycleEntries, ncImported })
  const periodPrediction = predictNextPeriod({ today: todayISO, stats })
  const fertilePrediction = predictFertileWindow({ today: todayISO, stats })
  const confirmedOvulation = detectOvulationShift(bbtLog)

  return {
    today: todayISO,
    current,
    stats,
    periodPrediction,
    fertilePrediction,
    bbtLog,
    confirmedOvulation,
  }
}
