/**
 * Fertile window + period prediction per Natural Cycles' published method.
 *
 * Algorithm source
 * ----------------
 * Berglund Scherwitzl E et al. "Identification and prediction of the fertile
 * window using NaturalCycles." Eur J Contracept Reprod Health Care 2015.
 * PubMed 25592280. DOI: 10.3109/13625187.2014.988210
 *
 * Favaro C et al. "Advantages of determining the fertile window with the
 * individualised Natural Cycles algorithm over calendar-based methods."
 * Eur J Contracept Reprod Health Care 2019. PubMed 31738859.
 *
 * FDA De Novo DEN170052, August 2018.
 *
 * Method:
 *   1. Fertile window = ovulation day - 5 through ovulation day + 1
 *      (six days, per NC help docs, matching 3-5 day sperm survival plus
 *      12-24 hr ovum viability).
 *   2. Predicted period start = confirmed ovulation + user's mean luteal
 *      length (per-user, since luteal SD is ~1.25 d across 1,501 cycles
 *      per Scherwitzl 2015, so personalized beats population).
 *   3. Period uncertainty = cycle-length SD, scaled by history depth.
 *      Fewer cycles = wider band, Bayesian shrinkage per NC's published
 *      "1-3 cycle learning period" behavior.
 */

/** Fertile window starts this many days BEFORE ovulation. */
export const FERTILE_WINDOW_PRE_OVULATION_DAYS = 5

/** Fertile window ends this many days AFTER ovulation. */
export const FERTILE_WINDOW_POST_OVULATION_DAYS = 1

/**
 * Default luteal length when user has <2 confirmed cycles. Mean luteal
 * length across 1,501 cycles (Scherwitzl 2015) is 13.6 days. We use 14
 * as the classic clinical default; engine swaps to per-user mean once
 * it has two or more confirmed cycles.
 */
export const DEFAULT_LUTEAL_LENGTH_DAYS = 14

/**
 * Minimum +/- days on a period prediction. NC's help docs acknowledge
 * irregular cycles need wider buffers. Never show 0-day precision.
 */
export const MIN_PERIOD_UNCERTAINTY_DAYS = 1

/**
 * Bayesian shrinkage factor: new users get extra buffer on top of their
 * personal SD. Additional days = max(0, SHRINKAGE_ANCHOR - cyclesKnown).
 */
export const SHRINKAGE_ANCHOR_CYCLES = 3

/** Cycle is "short luteal" when luteal phase is below this many days. */
export const SHORT_LUTEAL_THRESHOLD_DAYS = 10

export interface FertileWindow {
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}

export interface CycleHistoryStats {
  meanCycleLength: number
  sdCycleLength: number
  meanLutealLength: number
  sdLutealLength: number
  confirmedOvulatoryCycles: number
}

export interface PeriodPrediction {
  predictedStart: string // YYYY-MM-DD
  uncertaintyDays: number
  basis: 'ovulation_plus_luteal' | 'cycle_mean' | 'calendar_fallback'
}

/**
 * Compute the six-day fertile window centered on ovulation day.
 * NC emits green days outside this window once BBT shift is confirmed.
 */
export function computeFertileWindow(ovulationDateIso: string): FertileWindow {
  return {
    start: addDays(ovulationDateIso, -FERTILE_WINDOW_PRE_OVULATION_DAYS),
    end: addDays(ovulationDateIso, FERTILE_WINDOW_POST_OVULATION_DAYS),
  }
}

/**
 * Predict next period start from the confirmed ovulation day.
 *
 * Preferred path: ovulation + user's mean luteal length.
 * Fallback: cycleStart + user's mean cycle length.
 * Last-resort: 28 day calendar (only when stats are entirely absent).
 *
 * The uncertainty band combines:
 *   - SD of luteal length (or cycle length in the fallback path)
 *   - Bayesian shrinkage buffer: extra days when cycle history is thin
 *
 * Rationale: Scherwitzl 2015 reports per-user luteal SD ~1.25 d, so
 * once a user has 3+ cycles the luteal-based prediction is tighter
 * than a cycle-mean prediction. Favaro 2019 shows the individualized
 * algorithm catches day-of-ovulation variance calendar methods miss.
 */
export function predictPeriodStart(
  cycleStartIso: string,
  ovulationDateIso: string | null,
  history: CycleHistoryStats
): PeriodPrediction {
  const shrinkage = Math.max(
    0,
    SHRINKAGE_ANCHOR_CYCLES - history.confirmedOvulatoryCycles
  )

  if (ovulationDateIso && history.meanLutealLength > 0) {
    const predictedStart = addDays(ovulationDateIso, Math.round(history.meanLutealLength))
    const uncertainty = Math.max(
      MIN_PERIOD_UNCERTAINTY_DAYS,
      Math.round(history.sdLutealLength + shrinkage)
    )
    return {
      predictedStart,
      uncertaintyDays: uncertainty,
      basis: 'ovulation_plus_luteal',
    }
  }

  if (history.meanCycleLength > 0) {
    const predictedStart = addDays(cycleStartIso, Math.round(history.meanCycleLength))
    const uncertainty = Math.max(
      MIN_PERIOD_UNCERTAINTY_DAYS,
      Math.round(history.sdCycleLength + shrinkage)
    )
    return {
      predictedStart,
      uncertaintyDays: uncertainty,
      basis: 'cycle_mean',
    }
  }

  // Last-resort fallback. NC uses population mean 29.3 d; we use 28 for
  // conservativeness with a wide uncertainty to signal "we are guessing".
  return {
    predictedStart: addDays(cycleStartIso, 28),
    uncertaintyDays: 7,
    basis: 'calendar_fallback',
  }
}

/**
 * Compute luteal length in days from ovulation to next period start.
 * Returns null when either end is missing. Values below
 * SHORT_LUTEAL_THRESHOLD_DAYS should trigger a short-luteal flag upstream.
 */
export function computeLutealLength(
  ovulationDateIso: string | null,
  nextPeriodStartIso: string | null
): number | null {
  if (!ovulationDateIso || !nextPeriodStartIso) return null
  return daysBetween(ovulationDateIso, nextPeriodStartIso)
}

// ── internals ────────────────────────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`).getTime()
  const b = new Date(`${bIso}T00:00:00Z`).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}
