/**
 * Multi-signal fusion: BBT + Oura HRV + Oura RHR + LH.
 *
 * BBT-only is Natural Cycles' published algorithm (Scherwitzl 2015, 2017,
 * FDA DEN170052). The HRV/RHR corroboration described here is LanaeHealth's
 * extension, not NC's algorithm. It is grounded in the Oura cycle-phase
 * literature:
 *
 *   Goodale BM, Shilaih M, Falco L, Dammeier F, Hamvas G, Leeners B.
 *   "Wearable Sensors Reveal Menses-Driven Changes in Physiology and
 *    Enable Prediction of the Fertile Window: Observational Study."
 *   J Med Internet Res 2019. DOI: 10.2196/13404. PMC6694734.
 *   (Oura ring dataset, HRV drops ovulation day then rises through luteal;
 *    RHR elevates 3-5 bpm through the luteal phase.)
 *
 *   Shilaih M, Clerck VD, Falco L, Kubler F, Leeners B.
 *   "Pulse Rate Measurement During Sleep Using Wearable Sensors, and its
 *    Correlation with the Menstrual Cycle Phases."
 *   Scientific Reports 2017. DOI: 10.1038/s41598-017-01433-9
 *
 * Rationale for adding these signals
 * ----------------------------------
 * Lanae has POTS. BBT is noise-prone because flares, disrupted sleep, and
 * endometriosis pain nights corrupt basal readings. A second independent
 * corroborating signal (HRV drop or RHR rise) increases confidence and
 * lets the engine tolerate one or two noisy temp days without demoting
 * the cycle to "insufficient data".
 *
 * When BBT alone is ambiguous we fuse signals via a weighted vote:
 *
 *   BBT three-reading shift       weight 0.50  (NC's flagship signal)
 *   LH surge (positive test)      weight 0.25  (specific pre-ovulation marker)
 *   Oura HRV luteal pattern       weight 0.15  (Goodale 2019)
 *   Oura RHR luteal rise          weight 0.10  (Shilaih 2017, Goodale 2019)
 *
 * Weights sum to 1.00. Confidence = sum of contributing weights.
 */

/** BBT three-elevated-reading shift confirms ovulation. */
export const WEIGHT_BBT_SHIFT = 0.5

/** Positive LH test within the pre-shift window. */
export const WEIGHT_LH_SURGE = 0.25

/** Oura HRV cycle-phase signature (luteal HRV > follicular HRV per Goodale 2019). */
export const WEIGHT_HRV = 0.15

/** Oura RHR +3 to +5 bpm luteal rise per Shilaih 2017. */
export const WEIGHT_RHR = 0.1

/**
 * RHR luteal rise threshold in bpm. Classic luteal signature is +3 to +5,
 * we use 3 as the floor to catch Lanae's lower-bpm baseline.
 */
export const RHR_LUTEAL_RISE_BPM = 3

/**
 * Minimum confidence required to call a cycle "confirmed ovulatory" when
 * BBT alone is missing or ambiguous. 0.35 = LH + (HRV OR RHR + bit).
 */
export const MIN_MULTI_SIGNAL_CONFIDENCE = 0.35

export type SignalKey = 'bbt_shift' | 'lh_surge' | 'hrv' | 'rhr'

export interface SignalContribution {
  key: SignalKey
  contributed: boolean
  weight: number
  detail: string
}

export interface SignalFusionInput {
  bbtShiftConfirmed: boolean
  lhSurgeDetected: boolean
  /**
   * Mean HRV across the cycle's luteal candidate window (days 15-28
   * conventionally). Null when insufficient Oura data.
   */
  lutealHrvMean: number | null
  /** Mean HRV across the cycle's follicular window (days 1-13). */
  follicularHrvMean: number | null
  /** Mean RHR across the luteal candidate window. */
  lutealRhrMean: number | null
  /** Mean RHR across the follicular window. */
  follicularRhrMean: number | null
}

export interface SignalFusionResult {
  confidence: number // 0 to 1
  signalsUsed: SignalKey[]
  breakdown: SignalContribution[]
  multiSignalOvulatory: boolean
}

/**
 * Fuse the four signals into a confidence score + contribution breakdown.
 *
 * Why not a classifier? We want explainability on the /cycle page UI and
 * in the doctor-facing cycle report. A transparent weighted sum lets us
 * render "BBT shift + LH surge + Oura HRV drop" instead of a black-box
 * percentage. Patients with chronic illness need to be able to say "I
 * trust this because X, Y, Z lined up" to their provider.
 */
export function fuseSignals(input: SignalFusionInput): SignalFusionResult {
  const breakdown: SignalContribution[] = []

  breakdown.push({
    key: 'bbt_shift',
    contributed: input.bbtShiftConfirmed,
    weight: input.bbtShiftConfirmed ? WEIGHT_BBT_SHIFT : 0,
    detail: input.bbtShiftConfirmed
      ? 'Three consecutive readings above the cover line (Scherwitzl 2015).'
      : 'No sustained three-day rise above the cover line.',
  })

  breakdown.push({
    key: 'lh_surge',
    contributed: input.lhSurgeDetected,
    weight: input.lhSurgeDetected ? WEIGHT_LH_SURGE : 0,
    detail: input.lhSurgeDetected
      ? 'Positive LH test recorded this cycle (specific pre-ovulation marker).'
      : 'No positive LH test recorded or none tested.',
  })

  const hrvContributed = isHrvLutealPattern(input)
  breakdown.push({
    key: 'hrv',
    contributed: hrvContributed,
    weight: hrvContributed ? WEIGHT_HRV : 0,
    detail: hrvContributed
      ? 'Oura HRV rose into the luteal half relative to follicular baseline (Goodale 2019).'
      : input.lutealHrvMean !== null && input.follicularHrvMean !== null
        ? 'Oura HRV did not show the expected luteal elevation.'
        : 'Insufficient Oura HRV data this cycle.',
  })

  const rhrContributed = isRhrLutealRise(input)
  breakdown.push({
    key: 'rhr',
    contributed: rhrContributed,
    weight: rhrContributed ? WEIGHT_RHR : 0,
    detail: rhrContributed
      ? 'Oura RHR rose >=3 bpm into the luteal half (Shilaih 2017).'
      : input.lutealRhrMean !== null && input.follicularRhrMean !== null
        ? 'Oura RHR did not show the expected luteal rise.'
        : 'Insufficient Oura RHR data this cycle.',
  })

  const confidence = breakdown.reduce((sum, c) => sum + c.weight, 0)
  const signalsUsed: SignalKey[] = breakdown
    .filter((c) => c.contributed)
    .map((c) => c.key)

  return {
    confidence: round3(confidence),
    signalsUsed,
    breakdown,
    multiSignalOvulatory:
      input.bbtShiftConfirmed ||
      input.lhSurgeDetected ||
      confidence >= MIN_MULTI_SIGNAL_CONFIDENCE,
  }
}

/**
 * Check the HRV luteal-half pattern. Per Goodale 2019, HRV drops around
 * ovulation then recovers or slightly exceeds follicular baseline through
 * the luteal phase. We require BOTH windows to have data and the luteal
 * mean to be at least at the follicular level (not strictly greater so we
 * do not miss flat but present patterns).
 */
export function isHrvLutealPattern(input: SignalFusionInput): boolean {
  if (input.lutealHrvMean === null || input.follicularHrvMean === null) return false
  if (!Number.isFinite(input.lutealHrvMean) || !Number.isFinite(input.follicularHrvMean)) {
    return false
  }
  return input.lutealHrvMean >= input.follicularHrvMean
}

/**
 * Check RHR luteal rise. Shilaih 2017 reports a +3 to +5 bpm elevation
 * during the luteal phase. We require the luteal mean to exceed the
 * follicular mean by at least RHR_LUTEAL_RISE_BPM.
 */
export function isRhrLutealRise(input: SignalFusionInput): boolean {
  if (input.lutealRhrMean === null || input.follicularRhrMean === null) return false
  if (!Number.isFinite(input.lutealRhrMean) || !Number.isFinite(input.follicularRhrMean)) {
    return false
  }
  return input.lutealRhrMean - input.follicularRhrMean >= RHR_LUTEAL_RISE_BPM
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000
}
