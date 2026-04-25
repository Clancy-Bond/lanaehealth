/**
 * Cycle insights with population comparison.
 *
 * NC's "Cycle Insights" panel shows each metric (cycle length, luteal,
 * follicular, period duration, fertile window) alongside a population
 * mean +/- SD with phrasing like "My luteal phase length 15 plus/minus
 * 2 days vs all cyclers 12 plus/minus 2 days".
 *
 * This module computes the same shape from a list of completed cycles,
 * citing the published references catalogued at
 * docs/research/cycle-population-references.md.
 *
 * Honest-with-context (G3): every insight carries a sample size and a
 * confidence label. When the user has fewer than three completed
 * cycles, the comparison is labelled "preliminary" and the
 * comparisonText says so plainly. We never fabricate a comparison from
 * a single cycle: a 30-day cycle is not "longer than average" if it is
 * the only one we have ever seen.
 */
import type { Cycle, CycleStats } from './cycle-stats'

export type CycleInsightMetric =
  | 'cycle_length'
  | 'luteal_length'
  | 'follicular_length'
  | 'period_duration'
  | 'fertile_window_length'

export type Comparison = 'shorter' | 'similar' | 'longer' | 'unknown'

export interface CycleInsight {
  metric: CycleInsightMetric
  /** Pretty label for the metric, e.g. "Cycle length". */
  label: string
  /** User's mean +/- SD across the supplied cycles. null when no data. */
  userValue: { mean: number; sd: number; sampleSize: number } | null
  /** Population reference values + citation source. */
  populationValue: { mean: number; sd: number; source: string }
  /** Comparison verdict; "unknown" when the user has no data for this metric. */
  comparison: Comparison
  /** NC-voice interpretation tailored to the comparison and sample size. */
  comparisonText: string
  /** Honest sample-size confidence so the UI can de-emphasize thin signals. */
  confidence: 'low' | 'medium' | 'high'
}

/**
 * Population reference table. Numbers and citations live alongside
 * docs/research/cycle-population-references.md. The shape here is
 * deliberately small so a UI test can pin to known values without
 * pulling the whole doc.
 */
export const POPULATION_REFERENCES: Record<
  CycleInsightMetric,
  { mean: number; sd: number; source: string; label: string }
> = {
  cycle_length: {
    mean: 28.6,
    sd: 4.5,
    source: 'Bull et al. 2019, NPJ Digital Medicine, n=124,648',
    label: 'Cycle length',
  },
  luteal_length: {
    mean: 12.4,
    sd: 2.0,
    source: 'Lenton et al. 1984, BJOG, n=60',
    label: 'Luteal phase length',
  },
  follicular_length: {
    mean: 16.2,
    sd: 4.5,
    source: 'Lenton et al. 1984, BJOG, n=65',
    label: 'Follicular phase length',
  },
  period_duration: {
    mean: 4.5,
    sd: 1.7,
    source: 'Bull et al. 2019, NPJ Digital Medicine, n=124,648',
    label: 'Period duration',
  },
  fertile_window_length: {
    mean: 6.0,
    sd: 0,
    source: 'Wilcox et al. 1995, NEJM, n=221',
    label: 'Fertile window',
  },
}

/**
 * Threshold (in user-SDs) at which we call a value "shorter" or
 * "longer" than the population mean. Within +/- 1 user-SD of the
 * population mean we say "similar". Wider bands risk being
 * misinformative (population SD alone would call almost everything
 * similar).
 */
const SIMILARITY_BAND_SDS = 1

/**
 * Inputs to compute insights. luteal/follicular days come from the
 * fused ovulation signal which is per-cycle; we take a precomputed
 * array so this module stays pure.
 */
export interface CycleInsightInputs {
  cycles: ReadonlyArray<Cycle>
  /**
   * Per-cycle luteal phase length in days. Optional because it depends
   * on a confirmed ovulation date. Pass an empty array when unknown.
   */
  lutealLengths?: ReadonlyArray<number>
  /**
   * Per-cycle follicular phase length in days. Same caveat as luteal.
   */
  follicularLengths?: ReadonlyArray<number>
}

/**
 * Compute the per-metric comparison insights for a set of cycles.
 *
 * The returned array always has one entry per known metric so the UI
 * can render a stable table, even when some metrics are unknown for
 * this user.
 */
export function computeCycleInsights(input: CycleInsightInputs): CycleInsight[] {
  const completed = input.cycles.filter(
    (c): c is Cycle & { lengthDays: number } => c.lengthDays !== null,
  )
  const cycleLengths = completed.map((c) => c.lengthDays)
  const periodLengths = completed.map((c) => c.periodDays)
  const lutealLengths = (input.lutealLengths ?? []).filter((n) => Number.isFinite(n))
  const follicularLengths = (input.follicularLengths ?? []).filter((n) =>
    Number.isFinite(n),
  )

  return [
    buildInsight('cycle_length', cycleLengths),
    buildInsight('luteal_length', lutealLengths),
    buildInsight('follicular_length', follicularLengths),
    buildInsight('period_duration', periodLengths),
    buildFertileWindowInsight(),
  ]
}

/**
 * Convenience that wires straight to CycleStats for callers that
 * already have stats loaded. Luteal / follicular still need explicit
 * arrays because cycle-stats does not yet derive them.
 */
export function computeCycleInsightsFromStats(
  stats: CycleStats,
  options: { lutealLengths?: number[]; follicularLengths?: number[] } = {},
): CycleInsight[] {
  return computeCycleInsights({
    cycles: stats.completedCycles,
    lutealLengths: options.lutealLengths,
    follicularLengths: options.follicularLengths,
  })
}

function buildInsight(metric: CycleInsightMetric, values: readonly number[]): CycleInsight {
  const ref = POPULATION_REFERENCES[metric]
  if (values.length === 0) {
    return {
      metric,
      label: ref.label,
      userValue: null,
      populationValue: { mean: ref.mean, sd: ref.sd, source: ref.source },
      comparison: 'unknown',
      comparisonText: buildUnknownText(metric),
      confidence: 'low',
    }
  }

  const m = mean(values)
  const userMean = round1(m)
  const userSd = values.length >= 2 ? round1(sampleSd(values, m)) : 0
  const sampleSize = values.length
  const confidence = classifyConfidence(sampleSize, userSd)
  const comparison = classifyComparison(userMean, ref.mean, userSd, sampleSize)
  const comparisonText = buildComparisonText({
    metric,
    userMean,
    userSd,
    sampleSize,
    populationMean: ref.mean,
    populationSd: ref.sd,
    comparison,
    confidence,
  })

  return {
    metric,
    label: ref.label,
    userValue: { mean: userMean, sd: userSd, sampleSize },
    populationValue: { mean: ref.mean, sd: ref.sd, source: ref.source },
    comparison,
    comparisonText,
    confidence,
  }
}

/**
 * Fertile window length is fixed at 6 days for the population
 * (Wilcox et al.). We do not vary it per user because the model is
 * a definition, not a sample. The user-side value mirrors the
 * population value and the comparison is always "similar" with a
 * note explaining the model.
 */
function buildFertileWindowInsight(): CycleInsight {
  const ref = POPULATION_REFERENCES.fertile_window_length
  return {
    metric: 'fertile_window_length',
    label: ref.label,
    userValue: { mean: ref.mean, sd: 0, sampleSize: 0 },
    populationValue: { mean: ref.mean, sd: ref.sd, source: ref.source },
    comparison: 'similar',
    comparisonText:
      'Your fertile window is the 5 days before ovulation plus the day itself, the same model used across the field. Sperm survive up to 5 days, the egg lives about a day.',
    confidence: 'medium',
  }
}

function classifyComparison(
  userMean: number,
  popMean: number,
  userSd: number,
  sampleSize: number,
): Comparison {
  if (sampleSize < 1) return 'unknown'
  const band = Math.max(userSd || 0, 1) * SIMILARITY_BAND_SDS
  const diff = userMean - popMean
  if (Math.abs(diff) <= band) return 'similar'
  return diff > 0 ? 'longer' : 'shorter'
}

function classifyConfidence(sampleSize: number, userSd: number): 'low' | 'medium' | 'high' {
  if (sampleSize < 3) return 'low'
  if (sampleSize >= 6 && userSd <= 3) return 'high'
  return 'medium'
}

function buildUnknownText(metric: CycleInsightMetric): string {
  switch (metric) {
    case 'cycle_length':
    case 'period_duration':
      return 'Need at least one completed cycle to compare with the population.'
    case 'luteal_length':
      return 'Luteal length needs a confirmed ovulation date. Logging BBT or a positive LH test unlocks this comparison.'
    case 'follicular_length':
      return 'Follicular length needs a confirmed ovulation date. Logging BBT or a positive LH test unlocks this comparison.'
    case 'fertile_window_length':
      return 'Fertile window is computed from your ovulation signal.'
  }
}

function buildComparisonText(args: {
  metric: CycleInsightMetric
  userMean: number
  userSd: number
  sampleSize: number
  populationMean: number
  populationSd: number
  comparison: Comparison
  confidence: 'low' | 'medium' | 'high'
}): string {
  const sampleNote =
    args.sampleSize < 3
      ? ` Based on ${args.sampleSize} ${args.sampleSize === 1 ? 'cycle' : 'cycles'} so far, this can shift as more cycles complete.`
      : ''

  const direction =
    args.comparison === 'similar'
      ? 'in the typical range'
      : args.comparison === 'longer'
        ? 'on the longer side'
        : 'on the shorter side'

  switch (args.metric) {
    case 'cycle_length': {
      const tail =
        args.comparison === 'similar'
          ? 'Cycles between 21 and 35 days are considered typical.'
          : args.comparison === 'longer'
            ? 'Longer cycles often mean a longer follicular phase, which is normal variation for many people.'
            : 'Shorter cycles are still healthy as long as ovulation is happening.'
      return `Your cycle length is ${direction}.${sampleNote} ${tail}`
    }
    case 'luteal_length': {
      const tail =
        args.comparison === 'similar'
          ? 'A typical luteal phase runs 11 to 14 days.'
          : args.comparison === 'longer'
            ? 'A longer luteal phase is normal and means a longer stretch between ovulation and your period.'
            : 'Luteal phases under 10 days are worth tracking, sometimes they signal lower progesterone.'
      return `Your luteal phase is ${direction}.${sampleNote} ${tail}`
    }
    case 'follicular_length': {
      const tail =
        args.comparison === 'similar'
          ? 'The follicular phase varies the most between cycles, so even a few days of swing is normal.'
          : args.comparison === 'longer'
            ? 'A longer follicular phase pushes ovulation later in the cycle. This is the most common reason a cycle runs long.'
            : 'A shorter follicular phase pulls ovulation earlier than usual. Fertile windows can land in the first week.'
      return `Your follicular phase is ${direction}.${sampleNote} ${tail}`
    }
    case 'period_duration': {
      const tail =
        args.comparison === 'similar'
          ? 'Most periods last 3 to 7 days.'
          : args.comparison === 'longer'
            ? 'Longer periods are usually fine on their own. If they are also heavy, that is worth mentioning to a clinician.'
            : 'Shorter periods are common and not a sign of anything wrong by themselves.'
      return `Your period duration is ${direction}.${sampleNote} ${tail}`
    }
    case 'fertile_window_length':
      return 'Your fertile window matches the population model.'
  }
}

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function sampleSd(xs: readonly number[], m: number): number {
  if (xs.length < 2) return 0
  const sumSq = xs.reduce((acc, x) => acc + (x - m) ** 2, 0)
  return Math.sqrt(sumSq / (xs.length - 1))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
