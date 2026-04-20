/**
 * Aggregate symptom / pain data by cycle phase.
 *
 * Feeds /patterns/cycle's phase heatmap. Given a day-keyed map of pain +
 * symptom rows and a menstrual-day history, we assign each day to its
 * phase using the same cycle-day algorithm as current-day.ts, then
 * aggregate counts and mean intensity per phase x symptom.
 *
 * This is purely for data visualization, not clinical grading. "More
 * fatigue in the luteal phase" is the shape of answer we produce.
 */
import { differenceInDays, parseISO } from 'date-fns'
import type { CyclePhase } from '@/lib/types'

export const PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal']

export interface DailyInput {
  date: string
  overall_pain?: number | null
  fatigue?: number | null
  bloating?: number | null
  stress?: number | null
  sleep_quality?: number | null
}

export interface PhaseCounts {
  /** Phase -> average metric value for days with a recorded value. */
  averages: Record<CyclePhase, Record<Metric, number | null>>
  /** Phase -> count of days with any log. */
  daysLoggedByPhase: Record<CyclePhase, number>
  /** Phase -> total days classified (for denominator). */
  daysByPhase: Record<CyclePhase, number>
  /** Phase -> percent of days at each pain bucket. */
  painBuckets: Record<CyclePhase, { good: number; moderate: number; rough: number; severe: number }>
}

export type Metric = 'overall_pain' | 'fatigue' | 'bloating' | 'stress' | 'sleep_quality'

export const METRIC_LABELS: Record<Metric, string> = {
  overall_pain: 'Pain',
  fatigue: 'Fatigue',
  bloating: 'Bloating',
  stress: 'Stress',
  sleep_quality: 'Sleep quality',
}

/**
 * Classify each dated row into a phase using a sorted list of period-start
 * dates. Days before the first known period start are "unknown" and
 * excluded. We use the standard calendar model (menstrual 1-5, follicular
 * 6-13, ovulatory 14-16, luteal 17+).
 */
export function aggregatePhaseSymptoms(
  dailyRows: ReadonlyArray<DailyInput>,
  periodStarts: readonly string[]
): PhaseCounts {
  if (periodStarts.length === 0 || dailyRows.length === 0) {
    return emptyCounts()
  }

  const startsAsc = [...periodStarts].sort()
  const daysByPhase = makePhaseRecord(0)
  const daysLoggedByPhase = makePhaseRecord(0)
  const sums: Record<CyclePhase, Record<Metric, { sum: number; n: number }>> = {
    menstrual: emptyMetrics(),
    follicular: emptyMetrics(),
    ovulatory: emptyMetrics(),
    luteal: emptyMetrics(),
  }
  const buckets: Record<CyclePhase, { good: number; moderate: number; rough: number; severe: number }> = {
    menstrual: { good: 0, moderate: 0, rough: 0, severe: 0 },
    follicular: { good: 0, moderate: 0, rough: 0, severe: 0 },
    ovulatory: { good: 0, moderate: 0, rough: 0, severe: 0 },
    luteal: { good: 0, moderate: 0, rough: 0, severe: 0 },
  }

  for (const row of dailyRows) {
    const phase = classifyDay(row.date, startsAsc)
    if (!phase) continue
    daysByPhase[phase]++
    let anyMetric = false

    for (const metric of Object.keys(METRIC_LABELS) as Metric[]) {
      const v = (row as unknown as Record<string, unknown>)[metric]
      if (typeof v === 'number' && Number.isFinite(v)) {
        sums[phase][metric].sum += v
        sums[phase][metric].n += 1
        anyMetric = true
      }
    }

    if (anyMetric) daysLoggedByPhase[phase]++

    const pain = row.overall_pain
    if (typeof pain === 'number' && Number.isFinite(pain)) {
      if (pain <= 2) buckets[phase].good++
      else if (pain <= 5) buckets[phase].moderate++
      else if (pain <= 8) buckets[phase].rough++
      else buckets[phase].severe++
    }
  }

  const averages: Record<CyclePhase, Record<Metric, number | null>> = {
    menstrual: finalizeMetrics(sums.menstrual),
    follicular: finalizeMetrics(sums.follicular),
    ovulatory: finalizeMetrics(sums.ovulatory),
    luteal: finalizeMetrics(sums.luteal),
  }

  return { averages, daysLoggedByPhase, daysByPhase, painBuckets: buckets }
}

function classifyDay(dateISO: string, startsAsc: readonly string[]): CyclePhase | null {
  const target = parseISO(dateISO)
  let applicableStart: string | null = null
  for (const s of startsAsc) {
    if (parseISO(s) <= target) applicableStart = s
    else break
  }
  if (!applicableStart) return null
  const cd = differenceInDays(target, parseISO(applicableStart)) + 1
  if (cd <= 5) return 'menstrual'
  if (cd <= 13) return 'follicular'
  if (cd <= 16) return 'ovulatory'
  if (cd <= 40) return 'luteal'
  return null
}

function makePhaseRecord<T>(init: T): Record<CyclePhase, T> {
  return {
    menstrual: init,
    follicular: init,
    ovulatory: init,
    luteal: init,
  } as Record<CyclePhase, T>
}

function emptyMetrics(): Record<Metric, { sum: number; n: number }> {
  return {
    overall_pain: { sum: 0, n: 0 },
    fatigue: { sum: 0, n: 0 },
    bloating: { sum: 0, n: 0 },
    stress: { sum: 0, n: 0 },
    sleep_quality: { sum: 0, n: 0 },
  }
}

function finalizeMetrics(
  sums: Record<Metric, { sum: number; n: number }>
): Record<Metric, number | null> {
  const out = {} as Record<Metric, number | null>
  for (const m of Object.keys(sums) as Metric[]) {
    out[m] = sums[m].n > 0 ? round1(sums[m].sum / sums[m].n) : null
  }
  return out
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function emptyCounts(): PhaseCounts {
  return {
    averages: {
      menstrual: finalizeMetrics(emptyMetrics()),
      follicular: finalizeMetrics(emptyMetrics()),
      ovulatory: finalizeMetrics(emptyMetrics()),
      luteal: finalizeMetrics(emptyMetrics()),
    },
    daysLoggedByPhase: makePhaseRecord(0),
    daysByPhase: makePhaseRecord(0),
    painBuckets: {
      menstrual: { good: 0, moderate: 0, rough: 0, severe: 0 },
      follicular: { good: 0, moderate: 0, rough: 0, severe: 0 },
      ovulatory: { good: 0, moderate: 0, rough: 0, severe: 0 },
      luteal: { good: 0, moderate: 0, rough: 0, severe: 0 },
    },
  }
}
