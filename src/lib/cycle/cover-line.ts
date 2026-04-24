/**
 * BBT cover line (NC's personal moving baseline).
 *
 * Wave 1 of the cycle deep rebuild. Per NC's published methodology
 * (https://help.naturalcycles.com/hc/en-us/articles/4409027575185), the
 * cover line is NOT a fixed clinical threshold like the older Marquette /
 * WHO three-over-six rule. It is a personal, continuously-updated baseline
 * that represents the average of all the user's temperature points across
 * cycles, weighted by phase averages and variance within follicular and
 * luteal phases.
 *
 * What this module computes (faithful subset of NC's behaviour):
 *   - The user's overall mean BBT (the visible horizontal line on NC's
 *     temperature graph) across all available data.
 *   - A confidence rating tied to sample size and homogeneity. NC's docs
 *     explicitly say it can take "a few days up to a full cycle" to appear
 *     for a brand-new user, and that it RESETS when the user changes
 *     measuring devices. We surface that as low confidence on small
 *     samples and as a separate baseline per device kind (we never mix
 *     absolute readings with deviation readings).
 *   - Sample size so callers can render NC-style "still learning" framing.
 *
 * What this module deliberately DOES NOT do:
 *   - Decide that ovulation occurred (signal-fusion's job, after consuming
 *     the cover line plus 2-4 sustained higher temperatures, per NC).
 *   - Apply a fixed +0.2 C / +0.4 F offset. NC explicitly distances itself
 *     from those single-threshold heuristics. The offset is implicit in
 *     the user's own follicular/luteal phase variance.
 *   - Mix kinds. Absolute (C) and deviation (C) values are NOT comparable;
 *     the function treats whichever kind is dominant in the input.
 */

import type { BbtReading } from './bbt-source'

export type CoverLineConfidence = 'low' | 'medium' | 'high'

export interface CoverLineResult {
  /**
   * The personal-baseline value. Units depend on `kind`: degrees Celsius
   * for absolute, deviation in Celsius for Oura-style streams. null when
   * insufficient data to compute (sample size 0).
   */
  baseline: number | null
  /**
   * Sample size used for the baseline. NC requires "a few days up to a
   * full cycle" before the line appears; we use 5 readings as the floor
   * for low confidence (matches NC's "5 of 7 days per week" guidance).
   */
  sampleSize: number
  confidence: CoverLineConfidence
  /** Which units the baseline is in: 'absolute' (Celsius) or 'deviation'. */
  kind: 'absolute' | 'deviation' | null
  /** Standard deviation of the input. Useful for downstream noise gating. */
  sd: number | null
}

const MIN_SAMPLE_FOR_LINE = 5
const MED_SAMPLE_FOR_LINE = 14
const HIGH_SAMPLE_FOR_LINE = 28

/**
 * Compute the personal cover-line baseline for a user.
 *
 * Strategy:
 *   1. Filter the input to the dominant kind (absolute vs deviation). NC's
 *      cover line resets when the user changes devices; mixing kinds is the
 *      same kind of category error.
 *   2. Drop outliers more than 3 SD from a provisional mean to mirror NC's
 *      "temperature-exclusion logic that can drop outliers automatically".
 *   3. Recompute the mean on the cleaned set.
 *   4. Confidence ladder: <5 = none/low, 5-13 = low, 14-27 = medium,
 *      28+ = high.
 */
export function computeCoverLine(readings: ReadonlyArray<BbtReading>): CoverLineResult {
  if (readings.length === 0) {
    return { baseline: null, sampleSize: 0, confidence: 'low', kind: null, sd: null }
  }

  // Pick the dominant kind. If counts tie, prefer 'deviation' (Oura is the
  // source of truth on this account).
  const absolute = readings.filter((r) => r.kind === 'absolute')
  const deviation = readings.filter((r) => r.kind === 'deviation')
  const dominantKind: 'absolute' | 'deviation' =
    deviation.length >= absolute.length ? 'deviation' : 'absolute'
  const same = (dominantKind === 'absolute' ? absolute : deviation).map((r) => r.value)

  if (same.length === 0) {
    return { baseline: null, sampleSize: 0, confidence: 'low', kind: null, sd: null }
  }

  const provMean = mean(same)
  const provSd = sampleSd(same, provMean)
  // Drop outliers > 3 SD. SD of zero (all-equal readings) means we keep
  // the entire set.
  const cleaned =
    provSd > 0 ? same.filter((v) => Math.abs(v - provMean) <= 3 * provSd) : same.slice()

  if (cleaned.length < MIN_SAMPLE_FOR_LINE) {
    return {
      baseline: cleaned.length === 0 ? null : Number(mean(cleaned).toFixed(3)),
      sampleSize: cleaned.length,
      confidence: 'low',
      kind: dominantKind,
      sd: cleaned.length >= 2 ? Number(sampleSd(cleaned, mean(cleaned)).toFixed(3)) : null,
    }
  }

  const finalMean = mean(cleaned)
  const finalSd = sampleSd(cleaned, finalMean)
  const conf: CoverLineConfidence =
    cleaned.length >= HIGH_SAMPLE_FOR_LINE
      ? 'high'
      : cleaned.length >= MED_SAMPLE_FOR_LINE
        ? 'medium'
        : 'low'

  return {
    baseline: Number(finalMean.toFixed(3)),
    sampleSize: cleaned.length,
    confidence: conf,
    kind: dominantKind,
    sd: Number(finalSd.toFixed(3)),
  }
}

function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function sampleSd(xs: readonly number[], m: number): number {
  if (xs.length < 2) return 0
  const sumSq = xs.reduce((acc, x) => acc + (x - m) ** 2, 0)
  return Math.sqrt(sumSq / (xs.length - 1))
}
