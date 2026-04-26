/**
 * recovery-time
 *
 * Computes Oura's "recovery time" concept: how long, after the lowest
 * readiness score in a recent window, it takes for readiness to return
 * to a personal baseline. We do not run a generic 70-or-bust threshold,
 * because POTS and luteal-phase physiology routinely shift baselines.
 * Caller passes the personal baseline (median of last 30 days, etc.)
 * and the readiness scores; we return the shape needed for the home
 * tile.
 *
 * Three states are surfaced:
 *   - 'recovered': latest reading is at or above baseline AND we found
 *     a meaningful prior dip (so the card has something to say).
 *   - 'recovering': latest reading is below baseline but trending up
 *     (we look at the slope of the last 3 days vs the prior 3).
 *   - 'flat': below baseline with no upward slope, or the dip is still
 *     at its low point.
 *
 * Edge cases handled explicitly:
 *   - Empty input or all-null scores: returns a zeroed result with
 *     `lastDip = 0` and `daysToRecovery = 0` and trajectory `'flat'`.
 *     The card's renderer should treat lastDip <= 0 as "no dip yet".
 *   - Baseline missing: caller should not invoke; we still degrade to
 *     trajectory 'flat' rather than throw.
 *
 * Data origin: `oura_daily.readiness_score`, last 14 days. Caller
 * passes already-sorted ascending by date.
 */

export interface ReadinessReading {
  date: string
  score: number | null
}

export type RecoveryTrajectory = 'recovering' | 'flat' | 'recovered'

export interface RecoveryTimeInput {
  readinessScores: ReadinessReading[]
  baselineScore: number
}

export interface RecoveryTimeResult {
  /** The lowest readiness score observed in the window. 0 if none. */
  lastDip: number
  /**
   * Days from the dip until readiness returned to baseline. 0 if not
   * yet recovered, or no meaningful dip occurred.
   */
  daysToRecovery: number
  /** Where the user is now relative to baseline. */
  currentTrajectory: RecoveryTrajectory
}

/**
 * Slope-style trend over a window: average of last `windowSize` valid
 * readings minus average of the previous `windowSize` valid readings.
 * Returns 0 when fewer than `windowSize * 2` finite readings exist.
 */
function shortSlope(scores: number[], windowSize = 3): number {
  if (scores.length < windowSize * 2) return 0
  const recent = scores.slice(-windowSize)
  const prior = scores.slice(-windowSize * 2, -windowSize)
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return avg(recent) - avg(prior)
}

export function computeRecoveryTime(
  input: RecoveryTimeInput,
): RecoveryTimeResult {
  const { readinessScores, baselineScore } = input

  if (
    !Array.isArray(readinessScores) ||
    readinessScores.length === 0 ||
    !Number.isFinite(baselineScore)
  ) {
    return { lastDip: 0, daysToRecovery: 0, currentTrajectory: 'flat' }
  }

  // Trim to days with a finite score, preserving order.
  const validIdx: number[] = []
  const validScores: number[] = []
  for (let i = 0; i < readinessScores.length; i += 1) {
    const s = readinessScores[i].score
    if (typeof s === 'number' && Number.isFinite(s)) {
      validIdx.push(i)
      validScores.push(s)
    }
  }

  if (validScores.length === 0) {
    return { lastDip: 0, daysToRecovery: 0, currentTrajectory: 'flat' }
  }

  // Find the day with the lowest readiness score in the window.
  let dipPos = 0
  let dipScore = validScores[0]
  for (let i = 1; i < validScores.length; i += 1) {
    if (validScores[i] < dipScore) {
      dipScore = validScores[i]
      dipPos = i
    }
  }

  // A "meaningful dip" is below baseline. If the lowest reading is
  // already at or above baseline, there is nothing to recover from.
  const meaningfulDip = dipScore < baselineScore
  const lastDip = meaningfulDip ? dipScore : 0

  // Walk forward from the dip looking for the first reading that
  // returns to baseline. We measure days in calendar terms using the
  // index in the original (pre-filter) array, so missing nights count.
  let daysToRecovery = 0
  if (meaningfulDip) {
    const dipOrigIdx = validIdx[dipPos]
    let recoveredOrigIdx: number | null = null
    for (let i = dipPos + 1; i < validScores.length; i += 1) {
      if (validScores[i] >= baselineScore) {
        recoveredOrigIdx = validIdx[i]
        break
      }
    }
    if (recoveredOrigIdx != null) {
      daysToRecovery = recoveredOrigIdx - dipOrigIdx
    }
  }

  // Determine trajectory based on the latest reading vs baseline and
  // a simple post-dip slope.
  const latest = validScores[validScores.length - 1]
  let currentTrajectory: RecoveryTrajectory
  if (!meaningfulDip) {
    currentTrajectory = 'recovered'
  } else if (latest >= baselineScore) {
    currentTrajectory = 'recovered'
  } else {
    const slope = shortSlope(validScores)
    currentTrajectory = slope > 0.5 ? 'recovering' : 'flat'
  }

  return {
    lastDip: Math.round(lastDip),
    daysToRecovery,
    currentTrajectory,
  }
}
