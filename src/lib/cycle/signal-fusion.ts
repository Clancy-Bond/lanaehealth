/**
 * Ovulation signal fusion (BBT + LH + calendar).
 *
 * Wave 1 of the cycle deep rebuild. Per NC's published methodology:
 *   - The algorithm uses TEMPERATURE + LH TEST + PERIOD only.
 *   - Cervical mucus, mood, sleep, sex drive, skin, etc are tracked for
 *     personal pattern-finding but are NOT inputs to the fertility algo.
 *     ("subjective and may lead to user error")
 *   - LH peaks ~48h before ovulation. A positive LH alone is never enough
 *     to confirm ovulation; it must be followed by a sustained
 *     temperature shift.
 *   - Temperature wins conflicts. If LH says CD10 but temperature only
 *     rises CD18, NC places ovulation around CD18.
 *   - LH overrides temperature ONLY when temperature data is missing or
 *     too noisy AND a broader temperature shift was detected.
 *   - Calendar (mean luteal phase length) is the fallback when neither
 *     BBT nor LH is informative.
 *
 * This module returns a single best-guess ovulation date plus a
 * confidence label and source attribution. Callers (load-cycle-context,
 * fertile-window) use it to pick between live signal-derived ovulation
 * and the calendar prediction.
 */

import type { BbtReading } from './bbt-source'
import { computeCoverLine } from './cover-line'

export type OvulationSource = 'bbt' | 'lh' | 'bbt+lh' | 'calendar' | 'none'
export type FusionConfidence = 'low' | 'medium' | 'high'

export interface LhTestEntry {
  /** ISO date YYYY-MM-DD. */
  date: string
  /** Test result; only positives narrow the prediction. */
  result: 'positive' | 'negative'
}

export interface NcImportedColor {
  date: string
  /** NC's own daily verdict, when present. Beats anything we recompute. */
  fertility_color: 'GREEN' | 'RED' | null
  /** NC's own ovulation status. OVU_CONFIRMED is gold-standard. */
  ovulation_status: 'OVU_CONFIRMED' | 'OVU_PREDICTION' | 'OVU_NOT_CONFIRMED' | null
  /** NC's logged cycle day. Only used for sanity-checking. */
  cycle_day: number | null
}

export interface FusionInputs {
  /** Optional cycle-start date for the cycle being analyzed (CD1). */
  cycleStartIso?: string | null
  /** All BBT readings inside the cycle window. */
  bbt: ReadonlyArray<BbtReading>
  /** All LH tests inside the cycle window. */
  lhTests?: ReadonlyArray<LhTestEntry>
  /** NC import rows inside the cycle window, when available. */
  ncRows?: ReadonlyArray<NcImportedColor>
  /** Mean cycle length, for the calendar-fallback path. */
  meanCycleLength?: number | null
  /** Optional luteal-phase length override; defaults to 14 (textbook). */
  lutealLength?: number
}

export interface FusionResult {
  /** Best-guess ovulation date, or null when no signal at all. */
  ovulationDate: string | null
  confidence: FusionConfidence
  source: OvulationSource
  /** True when source consumed a sustained BBT shift, not just a single point. */
  bbtShiftDetected: boolean
  /** True when at least one positive LH test was inside a plausible window. */
  lhPositiveDetected: boolean
  /** Free-form rationale for surfaces that want to show their work. */
  rationale: string
}

const DEFAULT_LUTEAL = 14

/**
 * Fuse BBT + LH + (NC import) + calendar into a single ovulation estimate.
 *
 * Order of evaluation:
 *   1. NC import says OVU_CONFIRMED for some date inside the cycle. Done;
 *      that is NC's own algorithmic verdict and beats anything we compute.
 *   2. BBT shift detected (sustained 2-4 day rise above the cover line) +
 *      a positive LH test ~24-72h prior -> "bbt+lh" with high confidence.
 *   3. BBT shift detected with no LH context -> "bbt" with medium-high
 *      confidence depending on shift magnitude.
 *   4. Positive LH test recent + no BBT data -> "lh" with low confidence
 *      (NC says LH alone is never enough to confirm).
 *   5. Calendar fallback: cycleStart + (meanCycleLength - lutealLength).
 *      Low confidence; NC notes it is generic averages until ovulation is
 *      detected in the current cycle.
 *   6. Nothing -> "none".
 */
export function fuseOvulationSignal(input: FusionInputs): FusionResult {
  const { bbt, lhTests = [], ncRows = [], meanCycleLength = null, lutealLength = DEFAULT_LUTEAL } = input

  // 1. NC's own confirmed ovulation wins.
  const ncConfirmed = ncRows.find((r) => r.ovulation_status === 'OVU_CONFIRMED')
  if (ncConfirmed) {
    return {
      ovulationDate: ncConfirmed.date,
      confidence: 'high',
      source: 'bbt+lh',
      bbtShiftDetected: true,
      lhPositiveDetected: lhTests.some((t) => t.result === 'positive'),
      rationale: 'Natural Cycles confirmed ovulation on this date in the imported history.',
    }
  }

  const positiveLhDates = lhTests
    .filter((t) => t.result === 'positive' && isIsoDate(t.date))
    .map((t) => t.date)
    .sort()

  // 2 / 3. BBT shift detection.
  const shift = detectBbtShift(bbt)
  if (shift) {
    const lhWithin = positiveLhDates.find((d) => withinDays(d, shift.dayOfShift, -3, 0))
    if (lhWithin) {
      return {
        ovulationDate: shift.dayOfShift,
        confidence: 'high',
        source: 'bbt+lh',
        bbtShiftDetected: true,
        lhPositiveDetected: true,
        rationale: `Sustained BBT rise on ${shift.dayOfShift} after a positive LH test on ${lhWithin}.`,
      }
    }
    return {
      ovulationDate: shift.dayOfShift,
      confidence: shift.shiftMagnitude >= 0.25 ? 'high' : 'medium',
      source: 'bbt',
      bbtShiftDetected: true,
      lhPositiveDetected: positiveLhDates.length > 0,
      rationale: `Sustained BBT rise of ${shift.shiftMagnitude.toFixed(2)} above baseline on ${shift.dayOfShift}.`,
    }
  }

  // 4. LH-alone fallback. NC's published guidance: positive LH narrows the
  // window but cannot confirm. We assign the next-day-after-positive as a
  // tentative ovulation point with low confidence.
  if (positiveLhDates.length > 0) {
    const last = positiveLhDates[positiveLhDates.length - 1]
    return {
      ovulationDate: addDaysIso(last, 1),
      confidence: 'low',
      source: 'lh',
      bbtShiftDetected: false,
      lhPositiveDetected: true,
      rationale: `Positive LH on ${last}. Ovulation is likely 24-48 hours later; awaiting BBT confirmation.`,
    }
  }

  // 5. Calendar fallback.
  if (input.cycleStartIso && meanCycleLength != null && Number.isFinite(meanCycleLength)) {
    const offset = Math.max(7, Math.round(meanCycleLength - lutealLength))
    return {
      ovulationDate: addDaysIso(input.cycleStartIso, offset),
      confidence: 'low',
      source: 'calendar',
      bbtShiftDetected: false,
      lhPositiveDetected: false,
      rationale: `Calendar estimate from mean cycle length (${meanCycleLength.toFixed(1)} days minus ${lutealLength}-day luteal).`,
    }
  }

  return {
    ovulationDate: null,
    confidence: 'low',
    source: 'none',
    bbtShiftDetected: false,
    lhPositiveDetected: false,
    rationale: 'No BBT shift, no positive LH test, and not enough cycle history for a calendar estimate.',
  }
}

interface BbtShift {
  dayOfShift: string
  shiftMagnitude: number
}

/**
 * Detect a sustained BBT shift inside the supplied readings. Approximates
 * NC's "2-4 higher values before ovulation can be confirmed" rule.
 *
 * Strategy:
 *   - Walk the series. For each candidate position with at least 3 prior
 *     same-kind readings, compute a trailing-baseline (mean of the prior
 *     window of up to 6 readings). If the next 3 same-kind readings all
 *     sit at least +0.15 C above that trailing baseline, the FIRST of
 *     the three is the shift point. NC's docs use "2-4 higher values" as
 *     the bar; we use 3 to keep a single threshold but the magnitude
 *     check makes it self-tuning.
 *
 * Why trailing-window baseline rather than a global cover line for shift
 * detection: a global cover-line includes the post-ovulation readings,
 * which inflates the baseline and hides the shift. NC's published
 * methodology distinguishes the cover-line (population statistic for
 * display) from the per-shift rolling comparison (algorithmic input).
 *
 * Honors mixed kinds: deviation series is read directly; absolute series
 * uses C readings (~36-37 range).
 */
export function detectBbtShift(readings: ReadonlyArray<BbtReading>): BbtShift | null {
  if (readings.length < 6) return null
  const ordered = [...readings].sort((a, b) => a.date.localeCompare(b.date))

  // Pick the dominant kind so we never compare absolute against deviation.
  const absolute = ordered.filter((r) => r.kind === 'absolute')
  const deviation = ordered.filter((r) => r.kind === 'deviation')
  const same = deviation.length >= absolute.length ? deviation : absolute
  if (same.length < 6) return null

  const SHIFT_OFFSET = 0.15
  const PRIOR_MIN = 3
  const PRIOR_MAX = 6
  const RISE_LEN = 3

  for (let i = PRIOR_MIN; i + RISE_LEN <= same.length; i++) {
    const priorStart = Math.max(0, i - PRIOR_MAX)
    const prior = same.slice(priorStart, i)
    if (prior.length < PRIOR_MIN) continue
    const baseline = prior.reduce((a, b) => a + b.value, 0) / prior.length

    const rise = same.slice(i, i + RISE_LEN)
    const allAbove = rise.every((r) => r.value - baseline >= SHIFT_OFFSET)
    if (!allAbove) continue
    const magnitude = rise.reduce((a, b) => a + (b.value - baseline), 0) / rise.length
    return {
      dayOfShift: rise[0].date,
      shiftMagnitude: magnitude,
    }
  }
  return null
}

function withinDays(candidate: string, anchor: string, lo: number, hi: number): boolean {
  const cMs = Date.parse(candidate + 'T00:00:00Z')
  const aMs = Date.parse(anchor + 'T00:00:00Z')
  if (!Number.isFinite(cMs) || !Number.isFinite(aMs)) return false
  const diffDays = (cMs - aMs) / (24 * 60 * 60 * 1000)
  return diffDays >= lo && diffDays <= hi
}

function addDaysIso(iso: string, n: number): string {
  const ms = Date.parse(iso + 'T00:00:00Z') + n * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}
