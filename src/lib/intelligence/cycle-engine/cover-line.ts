/**
 * Cover line + biphasic shift detection per Natural Cycles' published
 * algorithm.
 *
 * Algorithm source
 * ----------------
 * Scherwitzl E, Lundberg O, Kopp Kallner H, Rowland K, Ruck A,
 * Schellschmidt I, Scherwitzl R, Gemzell-Danielsson K.
 * "Perfect-use and typical-use Pearl Index of a contraceptive mobile app."
 * Contraception 2017. PMC5669828. DOI: 10.1016/j.contraception.2017.08.014
 *
 * Berglund Scherwitzl E, Gemzell-Danielsson K, Lundberg O, Trussell J,
 * Scherwitzl R.
 * "Identification and prediction of the fertile window using NaturalCycles."
 * Eur J Contracept Reprod Health Care 2015. PubMed 25592280.
 * DOI: 10.3109/13625187.2014.988210
 *
 * FDA De Novo DEN170052 decision memo, August 2018: "post-ovulation,
 * progesterone warms the female body by up to 0.45 C".
 *
 * Method:
 *   1. Per-user follicular baseline = mean of first N valid temperature
 *      readings in the cycle (N = 5 per Scherwitzl 2015, we use first
 *      5 days after period end; fall back to first 5 of cycle if no
 *      end-of-period marker yet).
 *   2. Cover line = max(follicular-window temps) + 0.05 to 0.1 C.
 *      We use 0.05 C as the minimum offset so noisy thermometers still
 *      trigger when progesterone is near the bottom of its published
 *      0.2 to 0.45 C rise range.
 *   3. Biphasic shift confirmed after THREE consecutive daily readings
 *      above the cover line (classic Marshall rule, used by NC).
 *   4. Ovulation day = first of the three elevated days - 1.9 days
 *      (empirical LH-to-BBT delay per Scherwitzl 2015, mean 1.9 d).
 *
 * Do NOT port NC source code. This is an observation-based reimplementation.
 * The named cells (baseline_days_used, min offset 0.05) are documented
 * facts from the published method, not proprietary constants.
 */

/** Minimum offset added to the follicular max to form the cover line. */
export const COVER_LINE_MIN_OFFSET_C = 0.05

/**
 * Maximum offset; NC reports the true value falls between 0.05 and 0.10.
 * We expose both so callers can parameterize for per-user noise profiles.
 */
export const COVER_LINE_MAX_OFFSET_C = 0.1

/** Number of consecutive elevated readings required to confirm a shift. */
export const SUSTAINED_ELEVATED_DAYS = 3

/**
 * Empirical LH-surge to BBT-shift delay (Scherwitzl 2015, mean 1.9 days
 * across 1,501 cycles, 317 women). Used to estimate the actual ovulation
 * day from the first elevated-temp day.
 */
export const LH_TO_BBT_DELAY_DAYS = 1.9

/** Minimum follicular readings to compute a trustworthy baseline. */
export const MIN_BASELINE_READINGS = 3

/** Number of consecutive daily readings NC uses for the baseline window. */
export const TARGET_BASELINE_READINGS = 5

export interface TempReading {
  /** YYYY-MM-DD */
  date: string
  /** Celsius, or null if missing / excluded */
  temperature: number | null
  /** When true, exclude from baseline AND from shift detection. */
  excluded?: boolean
  /** Optional human-readable exclusion reason (logged for audit). */
  excludedReason?: string
}

export interface CoverLineResult {
  /** Mean of the follicular window readings that built the baseline. */
  baselineMeanC: number
  /** Max of the follicular window readings. */
  baselineMaxC: number
  /** baselineMax + offset. Three reads above confirm a shift. */
  coverLineC: number
  /** How many readings were used to build the baseline. */
  baselineDaysUsed: number
  /** Which offset was applied (0.05 to 0.10 inclusive). */
  offsetUsedC: number
}

export interface BiphasicShiftResult {
  confirmed: boolean
  /** First of the THREE consecutive elevated days (ISO date). */
  firstElevatedDate: string | null
  /** Empirical ovulation date: firstElevatedDate - 1.9 days, rounded. */
  estimatedOvulationDate: string | null
  /** Days above cover line at confirmation moment. */
  elevatedRun: number
  /** The three triggering reads so we can display them in the UI. */
  triggeringReads: TempReading[]
}

/**
 * Build the follicular baseline and cover line for a cycle.
 *
 * Returns null when we do not have enough qualifying reads. Callers
 * should propagate this as low confidence rather than guess.
 *
 * Implementation notes:
 *   - `readings` is expected in ascending date order starting on the
 *     first day of the cycle.
 *   - We skip excluded and null readings when building the baseline.
 *   - We take the FIRST N non-excluded reads where N = target if
 *     available, falling back to min.
 *   - We clamp the offset to the published 0.05 to 0.10 C band, picking
 *     the caller-supplied value (default 0.05, the floor).
 */
export function computeCoverLine(
  readings: readonly TempReading[],
  offsetC: number = COVER_LINE_MIN_OFFSET_C
): CoverLineResult | null {
  const usable = readings.filter(
    (r): r is TempReading & { temperature: number } =>
      !r.excluded && typeof r.temperature === 'number' && Number.isFinite(r.temperature)
  )
  if (usable.length < MIN_BASELINE_READINGS) return null

  const offset = clampOffset(offsetC)
  const window = usable.slice(0, Math.min(TARGET_BASELINE_READINGS, usable.length))

  const sum = window.reduce((acc, r) => acc + r.temperature, 0)
  const mean = sum / window.length
  const max = window.reduce((m, r) => Math.max(m, r.temperature), -Infinity)

  return {
    baselineMeanC: round3(mean),
    baselineMaxC: round3(max),
    coverLineC: round3(max + offset),
    baselineDaysUsed: window.length,
    offsetUsedC: offset,
  }
}

/**
 * Detect a biphasic shift: three consecutive non-excluded daily readings
 * above the cover line.
 *
 * Returns the first elevated date + estimated ovulation date (first
 * elevated minus 1.9 days per Scherwitzl 2015). When `temperature` is
 * null or `excluded` is true on a candidate day, that day breaks the
 * streak and the counter resets.
 */
export function detectBiphasicShift(
  readings: readonly TempReading[],
  coverLine: CoverLineResult
): BiphasicShiftResult {
  let runStart = -1
  let run = 0
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i]
    const elevated =
      !r.excluded &&
      typeof r.temperature === 'number' &&
      Number.isFinite(r.temperature) &&
      r.temperature > coverLine.coverLineC
    if (elevated) {
      if (run === 0) runStart = i
      run += 1
      if (run >= SUSTAINED_ELEVATED_DAYS) {
        const firstElevated = readings[runStart]
        const ovulationDate = subtractDaysRounded(firstElevated.date, LH_TO_BBT_DELAY_DAYS)
        return {
          confirmed: true,
          firstElevatedDate: firstElevated.date,
          estimatedOvulationDate: ovulationDate,
          elevatedRun: run,
          triggeringReads: readings.slice(runStart, runStart + SUSTAINED_ELEVATED_DAYS),
        }
      }
    } else {
      run = 0
      runStart = -1
    }
  }
  return {
    confirmed: false,
    firstElevatedDate: null,
    estimatedOvulationDate: null,
    elevatedRun: run,
    triggeringReads: [],
  }
}

// ── internals ────────────────────────────────────────────────────────

function clampOffset(value: number): number {
  if (!Number.isFinite(value)) return COVER_LINE_MIN_OFFSET_C
  if (value < COVER_LINE_MIN_OFFSET_C) return COVER_LINE_MIN_OFFSET_C
  if (value > COVER_LINE_MAX_OFFSET_C) return COVER_LINE_MAX_OFFSET_C
  return value
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000
}

/**
 * Subtract `days` (can be fractional) from an ISO date and return the
 * rounded-to-whole-day ISO string. Used to map first-elevated to
 * estimated ovulation via the LH-BBT delay.
 */
export function subtractDaysRounded(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - Math.round(days))
  return d.toISOString().slice(0, 10)
}
