/**
 * Anovulatory cycle detection.
 *
 * Flags cycles that show no evidence of ovulation. A cycle is considered
 * anovulatory when BOTH signals fail to appear:
 *   1. No biphasic BBT shift (sustained >=0.2C rise for >=3 days)
 *   2. No LH surge (no positive LH test result)
 *
 * We gate the flag on sufficient data: require at least 10 of 28 days of
 * temperature readings in the cycle window. Below that we return
 * `insufficient_data` rather than a false negative.
 *
 * Hormonal birth control can mask ovulation signals. Callers should skip
 * this detection for cycles where hormonal contraception is known to be
 * active. This module does not fetch meds itself; it accepts an optional
 * `hormonalBirthControl` flag on the input cycle.
 *
 * Copy is reassuring, not diagnostic. See design-decisions.md Section 5.
 */
import type { NcImported } from '@/lib/types'

export type AnovulatoryStatus =
  | 'likely_anovulatory'
  | 'likely_ovulatory'
  | 'insufficient_data'

export interface AnovulatoryEvaluation {
  cycleStart: string // YYYY-MM-DD
  cycleEnd: string | null // YYYY-MM-DD, null if still open
  status: AnovulatoryStatus
  confidence: number // 0-1
  reason: string // plain-language explanation for UI and doctor report
  signals: {
    tempDaysAvailable: number
    tempDaysRequired: number
    biphasicShiftDetected: boolean
    lhSurgeDetected: boolean
    hormonalBirthControl: boolean
  }
}

export interface CycleTempDay {
  date: string
  temperature: number | null
  lh_test: string | null
}

export interface CycleWindow {
  cycleStart: string // YYYY-MM-DD
  cycleEnd: string | null // YYYY-MM-DD, null if cycle has not completed
  days: CycleTempDay[]
  hormonalBirthControl?: boolean
}

/** Minimum days of temperature data needed to trust a negative ovulation finding. */
export const MIN_TEMP_DAYS = 10

/** Threshold for a biphasic shift, in Celsius. */
export const BIPHASIC_THRESHOLD_C = 0.2

/** Number of consecutive days above baseline + threshold needed. */
export const SUSTAINED_DAYS = 3

/**
 * Evaluate one cycle for anovulatory signals.
 *
 * Returns `insufficient_data` when we do not have enough temperature
 * readings to trust a negative finding. This prevents false positives
 * driven by missing Oura or NC data.
 */
export function evaluateCycleAnovulatory(cycle: CycleWindow): AnovulatoryEvaluation {
  const validTemps = cycle.days.filter(
    (d): d is CycleTempDay & { temperature: number } =>
      typeof d.temperature === 'number' && !Number.isNaN(d.temperature)
  )
  const tempDaysAvailable = validTemps.length

  const hormonalBirthControl = cycle.hormonalBirthControl === true

  // If hormonal birth control is active, decline to flag. The signal is
  // meaningless because ovulation is pharmacologically suppressed.
  if (hormonalBirthControl) {
    return {
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      status: 'insufficient_data',
      confidence: 0,
      reason:
        'Hormonal birth control suppresses ovulation signals, so we are not flagging this cycle. Your logs still track symptoms and flow.',
      signals: {
        tempDaysAvailable,
        tempDaysRequired: MIN_TEMP_DAYS,
        biphasicShiftDetected: false,
        lhSurgeDetected: false,
        hormonalBirthControl,
      },
    }
  }

  if (tempDaysAvailable < MIN_TEMP_DAYS) {
    return {
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      status: 'insufficient_data',
      confidence: 0,
      reason: `We have ${tempDaysAvailable} day${tempDaysAvailable === 1 ? '' : 's'} of temperature data this cycle and need at least ${MIN_TEMP_DAYS} to say anything useful. Consistent morning temps make future readings sharper.`,
      signals: {
        tempDaysAvailable,
        tempDaysRequired: MIN_TEMP_DAYS,
        biphasicShiftDetected: false,
        lhSurgeDetected: false,
        hormonalBirthControl,
      },
    }
  }

  const biphasicShiftDetected = detectBiphasicShift(validTemps.map((d) => d.temperature))
  const lhSurgeDetected = detectLhSurge(cycle.days.map((d) => d.lh_test))

  // If we see either signal, we call it ovulatory.
  if (biphasicShiftDetected || lhSurgeDetected) {
    const confidence = biphasicShiftDetected && lhSurgeDetected ? 0.9 : 0.7
    const reason = buildOvulatoryReason(biphasicShiftDetected, lhSurgeDetected)
    return {
      cycleStart: cycle.cycleStart,
      cycleEnd: cycle.cycleEnd,
      status: 'likely_ovulatory',
      confidence,
      reason,
      signals: {
        tempDaysAvailable,
        tempDaysRequired: MIN_TEMP_DAYS,
        biphasicShiftDetected,
        lhSurgeDetected,
        hormonalBirthControl,
      },
    }
  }

  // Neither signal. Report as likely anovulatory with reassuring copy.
  const confidence = computeAnovulatoryConfidence(tempDaysAvailable)
  return {
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    status: 'likely_anovulatory',
    confidence,
    reason:
      'We did not see a sustained temperature shift or a positive LH test this cycle. Occasional cycles without ovulation can happen with stress, illness, or travel. If this keeps repeating, it is worth bringing up with your provider.',
    signals: {
      tempDaysAvailable,
      tempDaysRequired: MIN_TEMP_DAYS,
      biphasicShiftDetected: false,
      lhSurgeDetected: false,
      hormonalBirthControl,
    },
  }
}

/**
 * Detect a biphasic BBT shift within a cycle.
 *
 * We take the first 6 valid readings as the follicular baseline, then
 * look for any window of `SUSTAINED_DAYS` consecutive readings that all
 * sit above baseline + `BIPHASIC_THRESHOLD_C`.
 *
 * Exported for unit testing.
 */
export function detectBiphasicShift(temps: number[]): boolean {
  if (temps.length < 6 + SUSTAINED_DAYS) return false

  const baselineSlice = temps.slice(0, 6)
  const baselineAvg =
    baselineSlice.reduce((sum, v) => sum + v, 0) / baselineSlice.length
  const threshold = baselineAvg + BIPHASIC_THRESHOLD_C

  for (let i = 6; i <= temps.length - SUSTAINED_DAYS; i++) {
    let allAbove = true
    for (let j = 0; j < SUSTAINED_DAYS; j++) {
      if (temps[i + j] <= threshold) {
        allAbove = false
        break
      }
    }
    if (allAbove) return true
  }
  return false
}

/**
 * Detect an LH surge from a list of LH test results.
 *
 * Any row containing 'positive' or 'peak' counts. We do a
 * case-insensitive check to match both Natural Cycles exports
 * and manual cycle_entries values.
 */
export function detectLhSurge(results: Array<string | null | undefined>): boolean {
  for (const r of results) {
    if (!r) continue
    const normalized = String(r).toLowerCase().trim()
    if (normalized.includes('positive') || normalized.includes('peak')) {
      return true
    }
  }
  return false
}

/**
 * Build a cycle window from a list of NC imported rows.
 * Returns null when there are not enough menstruation-anchored rows to
 * identify a cycle start.
 */
export function buildCyclesFromNc(rows: NcImported[]): CycleWindow[] {
  // Sort ascending by date for cycle boundary detection.
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))

  // Period start = first day where menstruation === 'menstruation' after a
  // gap of >=2 days with no menstruation. Mirrors the cycle-calculator
  // convention so callers see consistent boundaries.
  const starts: string[] = []
  let prev: string | null = null
  let prevMenstruating = false

  for (const row of sorted) {
    const menstruating = (row.menstruation ?? '').toLowerCase() === 'menstruation'
    if (menstruating && (!prevMenstruating || prev === null || daysBetween(prev, row.date) >= 2)) {
      starts.push(row.date)
    }
    prev = row.date
    prevMenstruating = menstruating
  }

  if (starts.length === 0) return []

  // Build each cycle window: from a period start up to (but not including)
  // the next period start. The last cycle stays open-ended.
  const cycles: CycleWindow[] = []
  for (let i = 0; i < starts.length; i++) {
    const cycleStart = starts[i]
    const nextStart = starts[i + 1] ?? null
    const days: CycleTempDay[] = sorted
      .filter((row) => row.date >= cycleStart && (nextStart === null || row.date < nextStart))
      .map((row) => ({
        date: row.date,
        temperature: row.temperature,
        lh_test: row.lh_test ?? null,
      }))

    cycles.push({
      cycleStart,
      cycleEnd: nextStart
        ? new Date(new Date(nextStart).getTime() - 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10)
        : null,
      days,
    })
  }

  return cycles
}

/**
 * Evaluate every complete cycle in the provided NC data.
 *
 * A cycle is treated as "open" and skipped when any of the following hold:
 *   - `cycleEnd` is null (no subsequent period start recorded)
 *   - the cycle window contains only the period-start row with no body
 *     data after it (nothing to evaluate; the cycle never ran its course
 *     in our data)
 *
 * This avoids producing insufficient_data rows for near-empty markers that
 * only exist to close the previous cycle.
 */
export function evaluateNcCycles(rows: NcImported[]): AnovulatoryEvaluation[] {
  const cycles = buildCyclesFromNc(rows).filter(
    (c) => c.cycleEnd !== null && c.days.length > 1
  )
  return cycles.map((c) => evaluateCycleAnovulatory(c))
}

// ── internals ────────────────────────────────────────────────────────

function computeAnovulatoryConfidence(tempDaysAvailable: number): number {
  if (tempDaysAvailable >= 20) return 0.75
  if (tempDaysAvailable >= 15) return 0.65
  return 0.55
}

function buildOvulatoryReason(biphasic: boolean, lh: boolean): string {
  if (biphasic && lh) {
    return 'Temperature shift and LH surge both showed up, so this cycle looks ovulatory.'
  }
  if (biphasic) {
    return 'We saw a sustained temperature rise after the follicular baseline, which points to ovulation.'
  }
  return 'A positive LH test this cycle suggests ovulation happened.'
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

// ── Persistence helpers ──────────────────────────────────────────────

/**
 * Shape of the row we insert into correlation_results for a flagged cycle.
 *
 * The existing correlation_results table does not have a `pattern_type`
 * column. We use:
 *   - factor_a = 'anovulatory_cycle' (marker the UI filters on)
 *   - factor_b = cycle_start ISO date (uniqueness key, easy to display)
 *   - correlation_type = 'event_triggered' (fits the CHECK constraint)
 *   - effect_description = human-readable reason
 *   - confidence_level mapped from numeric confidence
 */
export interface AnovulatoryRow {
  factor_a: 'anovulatory_cycle'
  factor_b: string
  correlation_type: 'event_triggered'
  effect_description: string
  confidence_level: 'suggestive' | 'moderate' | 'strong'
  sample_size: number
  cycle_phase: null
  passed_fdr: false
  computed_at: string
}

export function toCorrelationRow(
  evaluation: AnovulatoryEvaluation,
  now: Date = new Date()
): AnovulatoryRow | null {
  if (evaluation.status !== 'likely_anovulatory') return null

  const confidence_level: AnovulatoryRow['confidence_level'] =
    evaluation.confidence >= 0.7
      ? 'strong'
      : evaluation.confidence >= 0.6
        ? 'moderate'
        : 'suggestive'

  return {
    factor_a: 'anovulatory_cycle',
    factor_b: evaluation.cycleStart,
    correlation_type: 'event_triggered',
    effect_description: evaluation.reason,
    confidence_level,
    sample_size: evaluation.signals.tempDaysAvailable,
    cycle_phase: null,
    passed_fdr: false,
    computed_at: now.toISOString(),
  }
}
