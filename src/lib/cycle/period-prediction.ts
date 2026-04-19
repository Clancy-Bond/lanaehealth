/**
 * Period + fertile-window prediction.
 *
 * Natural Cycles pattern 3 (individualized uncertainty buffer) + pattern
 * 15 (period prediction with forward-looking window). We NEVER emit a
 * single-date estimate when uncertainty is non-zero. Always a range.
 *
 * Non-contraceptive: this is for cycle awareness. We do not suppress the
 * fertile window even when the SD is large; we widen it.
 *
 * Voice rules applied:
 *   - "Cycle unknown" when no data (not "No data").
 *   - No "safe day" or "lucky day" framing.
 *   - Blush stripe for overdue; never red/alarm.
 */
import { addDays, differenceInDays, format, parseISO } from 'date-fns'
import type { CycleStats } from './cycle-stats'

export interface PredictionInputs {
  /** Local ISO date (YYYY-MM-DD) to predict against. */
  today: string
  stats: CycleStats
}

export interface PeriodPrediction {
  status: 'unknown' | 'projected' | 'overdue'
  /** Point estimate of next period start, when computable. */
  predictedDate: string | null
  /** Predicted range start (early) / end (late). Always >= predictedDate. */
  rangeStart: string | null
  rangeEnd: string | null
  /** Days until predicted date (negative when overdue). */
  daysUntil: number | null
  /** Days overdue relative to mean. 0 when on-time or early. */
  daysOverdue: number
  /** Bytesized confidence label. "low" | "medium" | "high". */
  confidence: 'low' | 'medium' | 'high'
  /** User-facing subtitle for the prediction. */
  caveat: string
}

export interface FertileWindowPrediction {
  status: 'unknown' | 'in_window' | 'out_window' | 'post_ovulation'
  /** 6-day window: ovulation day + 5 prior. */
  rangeStart: string | null
  rangeEnd: string | null
  /** Days until the window opens; 0 while in window; null when unknown. */
  daysUntilWindow: number | null
  /** Days until the window closes when in_window, else null. */
  daysUntilCloses: number | null
  confidence: 'low' | 'medium' | 'high'
  caveat: string
}

/**
 * Predict the next period with an honest uncertainty range.
 *
 * Mean +/- SD gives a one-sigma range. We expand to +/- max(SD, 2) so the
 * range is never less than four days wide. When SD is missing (fewer than
 * 2 completed cycles), we fall back to +/- 5 days and label the result
 * with a "limited history" caveat.
 */
export function predictNextPeriod({ today, stats }: PredictionInputs): PeriodPrediction {
  const current = stats.currentCycle
  const meanLen = stats.meanCycleLength
  if (!current || meanLen == null) {
    return {
      status: 'unknown',
      predictedDate: null,
      rangeStart: null,
      rangeEnd: null,
      daysUntil: null,
      daysOverdue: 0,
      confidence: 'low',
      caveat: 'Log a period start to begin predictions. Cycles usually take 1-3 cycles to calibrate.',
    }
  }

  const sdLen = stats.sdCycleLength
  const startISO = current.startDate
  const predicted = addDays(parseISO(startISO), Math.round(meanLen))
  const buffer = sdLen != null && Number.isFinite(sdLen) ? Math.max(sdLen, 2) : 5
  const rangeStart = addDays(predicted, -Math.round(buffer))
  const rangeEnd = addDays(predicted, Math.round(buffer))
  const todayD = parseISO(today)
  const daysUntil = differenceInDays(predicted, todayD)

  const confidence = classifyConfidence(stats.sampleSize, sdLen)
  const daysOverdue = daysUntil < 0 ? Math.abs(daysUntil) : 0
  const isOverdue = daysUntil < -Math.round(buffer / 2)

  return {
    status: isOverdue ? 'overdue' : 'projected',
    predictedDate: format(predicted, 'yyyy-MM-dd'),
    rangeStart: format(rangeStart, 'yyyy-MM-dd'),
    rangeEnd: format(rangeEnd, 'yyyy-MM-dd'),
    daysUntil,
    daysOverdue,
    confidence,
    caveat: buildCaveat(stats, confidence, isOverdue),
  }
}

/**
 * Predict the fertile window (NC pattern 2: 6-day window ending on
 * predicted ovulation day).
 *
 * Ovulation day is estimated as meanCycleLength - luteal where luteal is
 * 14 by default (textbook luteal). We do NOT pretend ovulation is known
 * without signals; the range widens with cycle SD.
 */
export function predictFertileWindow({ today, stats }: PredictionInputs): FertileWindowPrediction {
  const current = stats.currentCycle
  const meanLen = stats.meanCycleLength
  if (!current || meanLen == null) {
    return {
      status: 'unknown',
      rangeStart: null,
      rangeEnd: null,
      daysUntilWindow: null,
      daysUntilCloses: null,
      confidence: 'low',
      caveat: 'Fertile window needs at least one completed cycle of history.',
    }
  }

  const LUTEAL_LENGTH = 14
  const ovulationOffset = Math.round(meanLen - LUTEAL_LENGTH)
  const predictedOvulation = addDays(parseISO(current.startDate), ovulationOffset)
  const sdLen = stats.sdCycleLength ?? 3

  // Window is 6 days ending on ovulation day. Widen by SD on the early end
  // (ovulation could come earlier than mean, which shifts fertile window
  // earlier). Do NOT extend past ovulation; ovulation is a biological
  // upper bound for conception likelihood.
  const windowOpen = addDays(predictedOvulation, -5 - Math.max(0, Math.round(sdLen)))
  const windowClose = predictedOvulation

  const todayD = parseISO(today)
  const daysUntilOpen = differenceInDays(windowOpen, todayD)
  const daysUntilClose = differenceInDays(windowClose, todayD)

  let status: FertileWindowPrediction['status']
  if (daysUntilClose < 0) {
    status = 'post_ovulation'
  } else if (daysUntilOpen <= 0) {
    status = 'in_window'
  } else {
    status = 'out_window'
  }

  const confidence = classifyConfidence(stats.sampleSize, stats.sdCycleLength)

  return {
    status,
    rangeStart: format(windowOpen, 'yyyy-MM-dd'),
    rangeEnd: format(windowClose, 'yyyy-MM-dd'),
    daysUntilWindow: status === 'out_window' ? daysUntilOpen : status === 'in_window' ? 0 : null,
    daysUntilCloses: status === 'in_window' ? daysUntilClose : null,
    confidence,
    caveat: buildFertileCaveat(stats, confidence, status),
  }
}

function classifyConfidence(
  sampleSize: number,
  sdLen: number | null
): 'low' | 'medium' | 'high' {
  if (sampleSize < 3 || sdLen == null) return 'low'
  if (sdLen <= 2 && sampleSize >= 6) return 'high'
  if (sdLen <= 4) return 'medium'
  return 'low'
}

function buildCaveat(
  stats: CycleStats,
  confidence: 'low' | 'medium' | 'high',
  isOverdue: boolean
): string {
  const { sampleSize, sdCycleLength, regularity } = stats
  if (isOverdue) {
    return 'Period is later than the predicted range. Late cycles are common, especially after stress, travel, or illness. Logging a period start refreshes this estimate.'
  }
  if (sampleSize < 3) {
    return 'Based on limited cycle history. Accuracy improves after 2-3 completed cycles.'
  }
  if (regularity === 'irregular') {
    return `Your cycles vary widely (SD ${sdCycleLength}d). Wide range is the honest answer, not a failure of the app.`
  }
  if (confidence === 'high') {
    return 'Consistent cycle history. This window is narrow by design.'
  }
  return `Estimate narrows as more cycles complete (currently ${sampleSize} completed).`
}

function buildFertileCaveat(
  stats: CycleStats,
  confidence: 'low' | 'medium' | 'high',
  status: FertileWindowPrediction['status']
): string {
  if (status === 'unknown') return 'Need more cycle history to estimate.'
  if (status === 'post_ovulation') return 'Estimated ovulation has passed for this cycle.'
  if (confidence === 'low') {
    return 'Fertile window is a wide estimate without cycle SD data. Ovulation tests or BBT will sharpen it.'
  }
  if (status === 'in_window') {
    return 'Estimated window based on prior cycle timing. Confirms with BBT, LH test, or cervical mucus if trying to conceive or avoid.'
  }
  return 'Window opens based on your recent cycle mean. Widens by your cycle-length variability.'
}
