/**
 * Cycle statistics derivation.
 *
 * Pure functions over already-loaded menstruation rows. Given a merged set
 * of period days (cycle_entries + nc_imported flow days), we compute:
 *   - the list of completed cycles (period start to next period start)
 *   - cycle length mean + SD
 *   - period length mean + SD
 *   - most recent period start (for the current/in-progress cycle)
 *
 * Mirrors the grouping algorithm in current-day.ts: consecutive menstrual
 * days within a 2-day gap are one period. The gap between period starts is
 * the cycle length.
 *
 * Honest-uncertainty rule (NaturalCycles pattern 3): never report mean
 * without SD. Cycles in the 21-35 day ACOG window with SD<=3 days are
 * "regular"; wider than that, predictions should widen.
 */
import { differenceInDays, parseISO } from 'date-fns'

export interface MenstrualInputs {
  /** Rows from cycle_entries where menstruation = true (date only). */
  cycleEntries: ReadonlyArray<{ date: string; menstruation: boolean | null }>
  /** Rows from nc_imported (any flow_quantity or menstruation='MENSTRUATION'). */
  ncImported: ReadonlyArray<{
    date: string
    menstruation: string | null
    flow_quantity: string | null
  }>
}

export interface Cycle {
  /** YYYY-MM-DD of the first menstrual day of this cycle. */
  startDate: string
  /** YYYY-MM-DD of the last menstrual day of this cycle's period. */
  periodEndDate: string
  /** Cycle length in days (gap to next period start). null for most-recent/in-progress. */
  lengthDays: number | null
  /** Period length in days. */
  periodDays: number
}

export interface CycleStats {
  /** Completed cycles only (those with known length). Ordered oldest to newest. */
  completedCycles: Cycle[]
  /** Most-recent cycle, possibly in-progress (length null). null when no data. */
  currentCycle: Cycle | null
  /** Mean cycle length across completed cycles, rounded to 1 decimal. */
  meanCycleLength: number | null
  /** Sample SD of cycle length, rounded to 1 decimal. null if <2 completed cycles. */
  sdCycleLength: number | null
  /** Shortest / longest completed cycle lengths in days. */
  shortestCycle: number | null
  longestCycle: number | null
  /** Mean period length. */
  meanPeriodLength: number | null
  /** Sample SD of period length. */
  sdPeriodLength: number | null
  /** How regular the cycles look: "regular" | "somewhat" | "irregular" | "insufficient". */
  regularity: Regularity
  /** How many completed cycles were used to compute stats. */
  sampleSize: number
}

export type Regularity = 'regular' | 'somewhat' | 'irregular' | 'insufficient'

/** Upper bound of a "normal" cycle per ACOG (21-35 days). */
export const NORMAL_CYCLE_MIN = 21
export const NORMAL_CYCLE_MAX = 35

/**
 * Group a merged list of menstrual days into period runs. A gap > 2 days
 * starts a new period. Input must be sorted ascending.
 */
export function groupIntoPeriods(sortedDays: readonly string[]): Array<{ start: string; end: string }> {
  if (sortedDays.length === 0) return []
  const runs: Array<{ start: string; end: string }> = []
  let runStart = sortedDays[0]
  let runEnd = sortedDays[0]
  for (let i = 1; i < sortedDays.length; i++) {
    const gap = differenceInDays(parseISO(sortedDays[i]), parseISO(sortedDays[i - 1]))
    if (gap <= 2) {
      runEnd = sortedDays[i]
    } else {
      runs.push({ start: runStart, end: runEnd })
      runStart = sortedDays[i]
      runEnd = sortedDays[i]
    }
  }
  runs.push({ start: runStart, end: runEnd })
  return runs
}

/**
 * Union cycle_entries menstrual days with nc_imported flow days into a
 * single sorted, deduped ascending list of ISO dates.
 */
export function mergeMenstrualDays(input: MenstrualInputs): string[] {
  const fromCycles = input.cycleEntries.filter((c) => c.menstruation).map((c) => c.date)
  const fromNc = input.ncImported
    .filter(
      (n) =>
        n.menstruation === 'MENSTRUATION' ||
        (n.flow_quantity != null && n.menstruation !== 'SPOTTING')
    )
    .map((n) => n.date)
  return Array.from(new Set([...fromCycles, ...fromNc])).sort()
}

/**
 * Derive cycle stats from raw menstruation rows.
 */
export function computeCycleStats(input: MenstrualInputs): CycleStats {
  const days = mergeMenstrualDays(input)
  const periods = groupIntoPeriods(days)

  if (periods.length === 0) {
    return emptyStats()
  }

  // Build Cycle[] with length = days from start(i) to start(i+1).
  const cycles: Cycle[] = periods.map((p, i) => {
    const nextStart = periods[i + 1]?.start
    const periodDays = differenceInDays(parseISO(p.end), parseISO(p.start)) + 1
    const lengthDays = nextStart ? differenceInDays(parseISO(nextStart), parseISO(p.start)) : null
    return { startDate: p.start, periodEndDate: p.end, lengthDays, periodDays }
  })

  const completed = cycles.filter((c) => c.lengthDays !== null) as Array<Cycle & { lengthDays: number }>
  const currentCycle = cycles[cycles.length - 1] ?? null

  if (completed.length === 0) {
    return {
      completedCycles: [],
      currentCycle,
      meanCycleLength: null,
      sdCycleLength: null,
      shortestCycle: null,
      longestCycle: null,
      meanPeriodLength: round1(currentCycle?.periodDays ?? null),
      sdPeriodLength: null,
      regularity: 'insufficient',
      sampleSize: 0,
    }
  }

  const lengths = completed.map((c) => c.lengthDays)
  const periodLengths = completed.map((c) => c.periodDays)
  const meanLen = mean(lengths)
  const sdLen = completed.length >= 2 ? sampleSd(lengths, meanLen) : null
  const meanPer = mean(periodLengths)
  const sdPer = completed.length >= 2 ? sampleSd(periodLengths, meanPer) : null

  const shortest = Math.min(...lengths)
  const longest = Math.max(...lengths)

  return {
    completedCycles: completed,
    currentCycle,
    meanCycleLength: round1(meanLen),
    sdCycleLength: sdLen !== null ? round1(sdLen) : null,
    shortestCycle: shortest,
    longestCycle: longest,
    meanPeriodLength: round1(meanPer),
    sdPeriodLength: sdPer !== null ? round1(sdPer) : null,
    regularity: classifyRegularity(completed.length, sdLen, shortest, longest),
    sampleSize: completed.length,
  }
}

function emptyStats(): CycleStats {
  return {
    completedCycles: [],
    currentCycle: null,
    meanCycleLength: null,
    sdCycleLength: null,
    shortestCycle: null,
    longestCycle: null,
    meanPeriodLength: null,
    sdPeriodLength: null,
    regularity: 'insufficient',
    sampleSize: 0,
  }
}

function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function sampleSd(xs: readonly number[], m: number): number {
  const n = xs.length
  if (n < 2) return 0
  const sumSq = xs.reduce((acc, x) => acc + (x - m) ** 2, 0)
  return Math.sqrt(sumSq / (n - 1))
}

function round1(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.round(n * 10) / 10
}

/**
 * Regularity classification. Separate from raw stats so the UI can surface
 * a user-friendly label without forcing every caller to reproduce the
 * thresholds. Thresholds are inclusive on the lower bound.
 */
function classifyRegularity(
  sampleSize: number,
  sdLen: number | null,
  shortest: number,
  longest: number
): Regularity {
  if (sampleSize < 3) return 'insufficient'
  const inAcog = shortest >= NORMAL_CYCLE_MIN && longest <= NORMAL_CYCLE_MAX
  if (sdLen === null) return 'insufficient'
  if (sdLen <= 3 && inAcog) return 'regular'
  if (sdLen <= 5 && longest - shortest <= 10) return 'somewhat'
  return 'irregular'
}

/**
 * Last completed cycle's luteal length cannot be derived from period data
 * alone (ovulation day is needed). This helper is exposed for tests.
 * @deprecated use runCycleEngine for ovulation-aware metrics
 */
export function __meanForTests(xs: number[]): number {
  return mean(xs)
}
