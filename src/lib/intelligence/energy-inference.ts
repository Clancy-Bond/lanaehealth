// ---------------------------------------------------------------------------
// Energy Mode Inference (Finch-inspired, Wave 2a / migration 020)
//
// Pure functions. No Supabase calls, no I/O. Callers assemble the inputs
// (readiness, cycle phase, yesterday pain, sleep hours) and receive a
// mode suggestion plus a plain-English rationale built from the real
// numbers driving the decision.
//
// Design voice rule: the result is a SUGGESTION, never a prescription.
// The banner shows "Oura suggests gentle mode today." The user is always
// allowed to override. See docs/plans/2026-04-16-non-shaming-voice-rule.md.
// ---------------------------------------------------------------------------

import type { CyclePhase, EnergyMode } from '@/lib/types'

// ===========================================================================
// Types
// ===========================================================================

export interface EnergyInferenceInput {
  // Today's Oura readiness score (0-100). Null if Oura did not sync or the
  // user has not granted access yet.
  readinessScore: number | null
  // Today's cycle phase, if known. Phase is denormalized into daily_logs
  // nightly; null means unknown.
  cyclePhase: CyclePhase | null
  // Yesterday's overall_pain score (0-10), null if yesterday was not logged
  // or the user did not record pain.
  yesterdayPain: number | null
  // Last night's sleep in hours (from Oura sleep_duration / 3600 typically),
  // null if Oura was offline.
  sleepHours: number | null
  // Optional: user marked yesterday as a flare day. If TRUE this is a strong
  // push toward minimal. Opt-in, never derived from missing data.
  userFlagFlare?: boolean
}

export interface EnergyInferenceResult {
  mode: EnergyMode
  // Non-shaming rationale built from the actual numbers that drove the call.
  // Always phrased as an observation, never a command. Examples:
  //   - "Readiness 48. Gentle mode suggested."
  //   - "Yesterday pain 8 and sleep 4.2h. Minimal mode suggested."
  rationale: string
  // The signals that actually participated in the decision, for debugging
  // and UI display ("based on: readiness, cycle phase").
  signals: string[]
  // TRUE when we had no useful signal and defaulted to 'full'. Callers that
  // want to silently skip the banner can check this.
  usedFallback: boolean
}

// ===========================================================================
// Thresholds (exported so tests can reference them directly)
// ===========================================================================

export const MINIMAL_READINESS_THRESHOLD = 50
export const GENTLE_READINESS_THRESHOLD = 70
export const MINIMAL_PAIN_THRESHOLD = 7
export const GENTLE_PAIN_THRESHOLD = 4
export const MINIMAL_SLEEP_HOURS_THRESHOLD = 5

// ===========================================================================
// Inference
// ===========================================================================

/**
 * Infer an energy mode from the supplied signals.
 *
 * Decision ladder (first match wins):
 *   - userFlagFlare -> minimal
 *   - readiness < 50   OR yesterdayPain >= 7 OR sleepHours < 5 -> minimal
 *   - readiness 50-69  OR cyclePhase in {luteal, menstrual} OR yesterdayPain 4-6 -> gentle
 *   - readiness >= 70 AND phase not luteal/menstrual AND yesterdayPain < 4 -> full
 *   - otherwise (no useful signal) -> full with usedFallback=true
 */
export function inferEnergyMode(input: EnergyInferenceInput): EnergyInferenceResult {
  const {
    readinessScore,
    cyclePhase,
    yesterdayPain,
    sleepHours,
    userFlagFlare,
  } = input

  const signals: string[] = []

  // Explicit user-declared flare always wins.
  if (userFlagFlare) {
    return {
      mode: 'minimal',
      rationale: 'Flare logged yesterday. Minimal mode suggested.',
      signals: ['user flare'],
      usedFallback: false,
    }
  }

  // Collect minimal-triggering signals.
  const minimalReasons: string[] = []
  if (readinessScore !== null && readinessScore < MINIMAL_READINESS_THRESHOLD) {
    minimalReasons.push(`readiness ${readinessScore}`)
    signals.push('readiness')
  }
  if (yesterdayPain !== null && yesterdayPain >= MINIMAL_PAIN_THRESHOLD) {
    minimalReasons.push(`yesterday pain ${yesterdayPain}`)
    signals.push('yesterday pain')
  }
  if (sleepHours !== null && sleepHours < MINIMAL_SLEEP_HOURS_THRESHOLD) {
    // Format sleep to one decimal so "4.2h" reads naturally.
    minimalReasons.push(`sleep ${sleepHours.toFixed(1)}h`)
    signals.push('sleep hours')
  }

  if (minimalReasons.length > 0) {
    return {
      mode: 'minimal',
      rationale: `${minimalReasons.join(', ')}. Minimal mode suggested.`,
      signals,
      usedFallback: false,
    }
  }

  // Collect gentle-triggering signals.
  const gentleReasons: string[] = []
  if (
    readinessScore !== null
    && readinessScore >= MINIMAL_READINESS_THRESHOLD
    && readinessScore < GENTLE_READINESS_THRESHOLD
  ) {
    gentleReasons.push(`readiness ${readinessScore}`)
    signals.push('readiness')
  }
  if (cyclePhase === 'luteal' || cyclePhase === 'menstrual') {
    gentleReasons.push(`${cyclePhase} phase`)
    signals.push('cycle phase')
  }
  if (
    yesterdayPain !== null
    && yesterdayPain >= GENTLE_PAIN_THRESHOLD
    && yesterdayPain < MINIMAL_PAIN_THRESHOLD
  ) {
    gentleReasons.push(`yesterday pain ${yesterdayPain}`)
    signals.push('yesterday pain')
  }

  if (gentleReasons.length > 0) {
    return {
      mode: 'gentle',
      rationale: `${gentleReasons.join(', ')}. Gentle mode suggested.`,
      signals,
      usedFallback: false,
    }
  }

  // Positive-signal path: high readiness + healthy phase + low pain.
  const fullReasons: string[] = []
  if (readinessScore !== null && readinessScore >= GENTLE_READINESS_THRESHOLD) {
    fullReasons.push(`readiness ${readinessScore}`)
    signals.push('readiness')
  }
  if (
    cyclePhase
    && cyclePhase !== 'luteal'
    && cyclePhase !== 'menstrual'
  ) {
    signals.push('cycle phase')
  }
  if (
    yesterdayPain !== null
    && yesterdayPain < GENTLE_PAIN_THRESHOLD
  ) {
    signals.push('yesterday pain')
  }

  if (fullReasons.length > 0) {
    return {
      mode: 'full',
      rationale: `${fullReasons.join(', ')}. Today feels full capacity.`,
      signals,
      usedFallback: false,
    }
  }

  // No useful signal at all. Silent fallback to full; UI can hide the banner.
  return {
    mode: 'full',
    rationale: 'No signal available. Today feels full capacity.',
    signals: [],
    usedFallback: true,
  }
}
