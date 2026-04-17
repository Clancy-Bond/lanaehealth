/**
 * Menstrual-migraine correlation classifier.
 *
 * Quantifies the bias of headache attacks toward the perimenstrual window
 * using the IHS ICHD-3 A1.1.1 criterion for pure menstrual migraine
 * without aura: attacks occurring exclusively on days -2 through +3 of
 * menstruation (where day 1 is the first day of flow).
 *
 * The classifier reads the denormalized `cycle_phase` column that Wave 2a
 * writes on the headache_attacks row at save time, plus the raw attack
 * start date compared against NC cycle boundaries. Phase alone is not
 * enough: the menstrual phase can include days 4 and 5 of flow, which
 * fall outside the IHS A1.1.1 window. We combine phase + day-relative-
 * to-period-start for precision.
 *
 * Statistical test:
 *   - The perimenstrual window is 6 days out of an average 28-day cycle
 *     (21.4 percent of days). Under the null hypothesis that attacks are
 *     uniformly distributed across the cycle, the probability of an
 *     attack falling in the window is 0.214 per attack. We compute a
 *     one-sided exact binomial test against this rate to get a p-value.
 *   - An odds ratio expresses how much more likely a menstrual attack is
 *     vs the null uniform rate. OR = (menstrualPct / 0.214) / ((1 -
 *     menstrualPct) / (1 - 0.214)). Values above 1.0 indicate clustering.
 *
 * Non-diagnostic. A 60 percent menstrual bias surfaces the UI flag
 * "pattern consistent with menstrual migraine" per the non-shaming voice
 * rule, but never "you have menstrual migraine". Diagnosis remains
 * between Lanae and her neurologist.
 *
 * Reference: International Classification of Headache Disorders, 3rd ed.,
 * criterion A1.1.1 (pure menstrual migraine without aura).
 * Reference: MacGregor EA 2012, "Menstrual and perimenopausal migraine:
 * a narrative review", Maturitas.
 */

import type { HeadacheAttack } from '@/lib/api/headache'
import type { NcImported } from '@/lib/types'
import { buildCyclesFromNc, type CycleWindow } from './anovulatory-detection'

// ── Constants ──────────────────────────────────────────────────────────

/**
 * IHS A1.1.1 perimenstrual window boundaries. Day offsets relative to
 * the first day of menstrual flow (day 1). Negative values are days
 * before flow starts, positive are days after.
 */
export const PERIMENSTRUAL_WINDOW_START = -2
export const PERIMENSTRUAL_WINDOW_END = 3

/** Length of the perimenstrual window in days, inclusive of both endpoints. */
export const PERIMENSTRUAL_WINDOW_DAYS =
  PERIMENSTRUAL_WINDOW_END - PERIMENSTRUAL_WINDOW_START + 1 // 6

/** Average cycle length used as the null-hypothesis denominator. */
export const AVERAGE_CYCLE_LENGTH = 28

/** Null probability that a random attack lands in the window. */
export const NULL_WINDOW_PROBABILITY = PERIMENSTRUAL_WINDOW_DAYS / AVERAGE_CYCLE_LENGTH

/**
 * Threshold at which the UI surfaces the "pattern consistent with
 * menstrual migraine" message. Chosen at 60 percent per the brief; this
 * is well above the 21 percent null expectation.
 */
export const MENSTRUAL_PATTERN_THRESHOLD = 0.6

/** Minimum attacks required before we publish a statistic. */
export const MIN_ATTACKS_FOR_STATS = 3

// ── Types ──────────────────────────────────────────────────────────────

export type MenstrualClassification = 'menstrual' | 'non-menstrual' | 'unknown'

export interface AttackClassification {
  attackId: string
  startedAt: string
  classification: MenstrualClassification
  cycleDayRelative: number | null // signed, day 1 = first day of flow
  nearestPeriodStart: string | null
  reason: string
}

export interface MenstrualMigraineStats {
  totalAttacks: number
  menstrualAttacks: number
  nonMenstrualAttacks: number
  unknownAttacks: number
  pct: number // 0-1, share of classifiable attacks in the window
  oddsRatio: number | null
  p: number | null // one-sided exact binomial p-value
  patternFlag: boolean // true iff pct >= MENSTRUAL_PATTERN_THRESHOLD AND
  //                     totalAttacks >= MIN_ATTACKS_FOR_STATS
  sufficientData: boolean
  windowDescription: string
  phaseHeatmap: PhaseHeatmap
}

export interface PhaseHeatmap {
  /** Count of attacks per cycle phase bucket. unknown = no cycle context. */
  menstrual: number
  follicular: number
  ovulatory: number
  luteal: number
  unknown: number
}

export interface ClassifyOptions {
  /** NC-derived cycles for the patient. If omitted the function falls
   *  back to the denormalized cycle_phase on the attack row. */
  cycles?: CycleWindow[]
  /** Raw NC rows. Used to build cycles when `cycles` is not supplied. */
  ncRows?: NcImported[]
}

// ── Pure classification ────────────────────────────────────────────────

/**
 * Classify a single headache attack as menstrual or non-menstrual.
 *
 * Rule: an attack is classified menstrual when its start date falls in
 * [periodStart - 2, periodStart + 3] for some known period start. The
 * nearest period start within a 14 day radius is chosen (ties broken
 * toward the earlier period, which is conservative).
 *
 * Falls back to the attack's denormalized `cycle_phase` when cycle
 * boundaries are not supplied. The fallback classifies only attacks in
 * the 'menstrual' phase as menstrual, which can slightly over-count
 * because the menstrual phase extends through day 5. The `unknown`
 * classification is used when there is no cycle context at all.
 */
export function classifyAttack(
  attack: Pick<HeadacheAttack, 'id' | 'started_at' | 'cycle_phase'>,
  options: ClassifyOptions = {}
): AttackClassification {
  const cycles = resolveCycles(options)
  const startedDate = attack.started_at.slice(0, 10)

  if (cycles.length > 0) {
    const match = findNearestPeriodStart(startedDate, cycles)
    if (match) {
      const dayRel = dayOffset(startedDate, match)
      const inWindow =
        dayRel >= PERIMENSTRUAL_WINDOW_START && dayRel <= PERIMENSTRUAL_WINDOW_END
      return {
        attackId: attack.id,
        startedAt: attack.started_at,
        classification: inWindow ? 'menstrual' : 'non-menstrual',
        cycleDayRelative: dayRel,
        nearestPeriodStart: match,
        reason: inWindow
          ? `Attack fell on day ${formatRelativeDay(dayRel)} of cycle starting ${match}, within the -2 to +3 perimenstrual window.`
          : `Attack was on day ${formatRelativeDay(dayRel)} relative to the nearest period start ${match}, outside the -2 to +3 window.`,
      }
    }
  }

  // Fallback to denormalized cycle phase.
  const phase = attack.cycle_phase?.toLowerCase() ?? null
  if (phase === 'menstrual') {
    return {
      attackId: attack.id,
      startedAt: attack.started_at,
      classification: 'menstrual',
      cycleDayRelative: null,
      nearestPeriodStart: null,
      reason:
        'No cycle boundaries available, but the attack was logged during the menstrual phase.',
    }
  }
  if (phase === 'follicular' || phase === 'ovulatory' || phase === 'luteal') {
    return {
      attackId: attack.id,
      startedAt: attack.started_at,
      classification: 'non-menstrual',
      cycleDayRelative: null,
      nearestPeriodStart: null,
      reason: `Attack was logged during the ${phase} phase, outside the menstrual window.`,
    }
  }

  return {
    attackId: attack.id,
    startedAt: attack.started_at,
    classification: 'unknown',
    cycleDayRelative: null,
    nearestPeriodStart: null,
    reason: 'No cycle phase or period-start history available for this attack.',
  }
}

/**
 * Compute menstrual-migraine statistics over a batch of attacks.
 *
 * Returns zeroed stats with sufficientData = false when fewer than
 * `MIN_ATTACKS_FOR_STATS` classifiable attacks are present.
 */
export function computeMenstrualMigraineStats(
  attacks: Array<Pick<HeadacheAttack, 'id' | 'started_at' | 'cycle_phase'>>,
  options: ClassifyOptions = {}
): MenstrualMigraineStats {
  const classifications = attacks.map((a) => classifyAttack(a, options))
  const menstrualAttacks = classifications.filter(
    (c) => c.classification === 'menstrual'
  ).length
  const nonMenstrualAttacks = classifications.filter(
    (c) => c.classification === 'non-menstrual'
  ).length
  const unknownAttacks = classifications.filter((c) => c.classification === 'unknown').length

  const classifiable = menstrualAttacks + nonMenstrualAttacks
  const total = attacks.length

  const heatmap = buildPhaseHeatmap(attacks)

  if (classifiable < MIN_ATTACKS_FOR_STATS) {
    return {
      totalAttacks: total,
      menstrualAttacks,
      nonMenstrualAttacks,
      unknownAttacks,
      pct: 0,
      oddsRatio: null,
      p: null,
      patternFlag: false,
      sufficientData: false,
      windowDescription: windowDescription(),
      phaseHeatmap: heatmap,
    }
  }

  const pct = menstrualAttacks / classifiable
  const oddsRatio = computeOddsRatio(pct)
  const p = oneSidedBinomial(menstrualAttacks, classifiable, NULL_WINDOW_PROBABILITY)

  return {
    totalAttacks: total,
    menstrualAttacks,
    nonMenstrualAttacks,
    unknownAttacks,
    pct,
    oddsRatio,
    p,
    patternFlag: pct >= MENSTRUAL_PATTERN_THRESHOLD,
    sufficientData: true,
    windowDescription: windowDescription(),
    phaseHeatmap: heatmap,
  }
}

// ── Helpers (exported for tests) ───────────────────────────────────────

/**
 * Resolve cycles from options. Accepts either pre-built cycles or raw
 * NC rows. Returns an empty array when neither is provided.
 */
export function resolveCycles(options: ClassifyOptions): CycleWindow[] {
  if (options.cycles && options.cycles.length > 0) return options.cycles
  if (options.ncRows && options.ncRows.length > 0) return buildCyclesFromNc(options.ncRows)
  return []
}

/**
 * Find the nearest cycleStart (period start) to a given date within
 * 14 days on either side. Returns the YYYY-MM-DD of the cycleStart or
 * null when no period start is within range.
 *
 * When ties exist (equal absolute distance), the earlier period start
 * wins. This is conservative: a tie means the attack is exactly between
 * two periods, and the prior period is the more defensible anchor.
 */
export function findNearestPeriodStart(
  attackDate: string,
  cycles: CycleWindow[]
): string | null {
  let best: { start: string; distance: number } | null = null
  for (const cycle of cycles) {
    const distance = Math.abs(dayOffset(attackDate, cycle.cycleStart))
    if (distance > 14) continue
    if (best === null || distance < best.distance) {
      best = { start: cycle.cycleStart, distance }
    }
  }
  return best?.start ?? null
}

/**
 * Signed day offset between two ISO dates (YYYY-MM-DD). Positive when
 * `attackDate` is after `periodStart`, negative when before.
 */
export function dayOffset(attackDate: string, periodStart: string): number {
  const a = Date.UTC(
    Number(attackDate.slice(0, 4)),
    Number(attackDate.slice(5, 7)) - 1,
    Number(attackDate.slice(8, 10))
  )
  const b = Date.UTC(
    Number(periodStart.slice(0, 4)),
    Number(periodStart.slice(5, 7)) - 1,
    Number(periodStart.slice(8, 10))
  )
  const diff = Math.round((a - b) / (24 * 60 * 60 * 1000))
  // Convention: day 1 is periodStart, so offset 0 -> day 1.
  // We return the offset in "day offset" units used by the IHS window,
  // where 0 = period start day itself. A value of -1 is the day before,
  // +1 is the second day of flow. The PERIMENSTRUAL_WINDOW_START = -2
  // and PERIMENSTRUAL_WINDOW_END = 3 comparisons use this convention.
  return diff
}

/**
 * Compute the odds ratio for clustering attacks in the window vs the
 * null uniform expectation. Returns null when the ratio is undefined
 * (pct = 1, which means all attacks are menstrual and the denominator
 * collapses to zero).
 */
export function computeOddsRatio(pct: number): number | null {
  if (pct >= 1) return null
  if (pct <= 0) return 0
  const numerator = pct / NULL_WINDOW_PROBABILITY
  const denominator = (1 - pct) / (1 - NULL_WINDOW_PROBABILITY)
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 100) / 100
}

/**
 * One-sided exact binomial test: probability of observing `successes`
 * or more out of `trials` when the per-trial probability is `p`.
 *
 * Uses a numerically-stable direct sum over log-binomial coefficients
 * for small n. Wave 2b expects dozens of attacks at most, so this is
 * fine without a normal approximation.
 */
export function oneSidedBinomial(successes: number, trials: number, p: number): number {
  if (trials === 0) return 1
  if (successes <= 0) return 1
  let tail = 0
  for (let k = successes; k <= trials; k++) {
    tail += binomialPmf(k, trials, p)
  }
  return Math.min(1, Math.max(0, tail))
}

function binomialPmf(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0
  const logCoef = logBinomialCoefficient(n, k)
  const logP = k * Math.log(p) + (n - k) * Math.log(1 - p)
  return Math.exp(logCoef + logP)
}

function logBinomialCoefficient(n: number, k: number): number {
  if (k === 0 || k === n) return 0
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k)
}

const LOG_FACTORIAL_CACHE: number[] = [0, 0]
function logFactorial(n: number): number {
  if (LOG_FACTORIAL_CACHE[n] !== undefined) return LOG_FACTORIAL_CACHE[n]
  let value = LOG_FACTORIAL_CACHE[LOG_FACTORIAL_CACHE.length - 1]
  for (let i = LOG_FACTORIAL_CACHE.length; i <= n; i++) {
    value += Math.log(i)
    LOG_FACTORIAL_CACHE[i] = value
  }
  return LOG_FACTORIAL_CACHE[n]
}

/** Build a phase-bucket count from attacks using the denormalized phase. */
export function buildPhaseHeatmap(
  attacks: Array<Pick<HeadacheAttack, 'cycle_phase'>>
): PhaseHeatmap {
  const map: PhaseHeatmap = {
    menstrual: 0,
    follicular: 0,
    ovulatory: 0,
    luteal: 0,
    unknown: 0,
  }
  for (const a of attacks) {
    const phase = a.cycle_phase?.toLowerCase()
    if (phase === 'menstrual') map.menstrual += 1
    else if (phase === 'follicular') map.follicular += 1
    else if (phase === 'ovulatory') map.ovulatory += 1
    else if (phase === 'luteal') map.luteal += 1
    else map.unknown += 1
  }
  return map
}

function windowDescription(): string {
  return 'IHS A1.1.1 perimenstrual window: 2 days before period through day 3 of flow.'
}

function formatRelativeDay(dayRel: number): string {
  if (dayRel === 0) return '1 (period start)'
  if (dayRel < 0) return `${dayRel} (before period)`
  return `+${dayRel}`
}
