/**
 * Symptom Radar (NC's signature pattern detection).
 *
 * NC's pattern: scan recent symptom logs and surface non-obvious
 * correlations to cycle phase. The published example: "You logged
 * headaches on day 18 of your last 3 cycles, that's mid-luteal."
 *
 * What this module does (faithful subset of NC's behaviour):
 *   - Aggregates symptom occurrences by cycle phase across the last N
 *     cycles using the SAME calendar-model phase classification used by
 *     phase-symptoms.ts and current-day.ts. This keeps the radar's
 *     verdict consistent with what the rest of the app says about each
 *     day.
 *   - Flags patterns where >= 70% of a symptom's occurrences cluster in
 *     a single phase AND the symptom appears at least 3 times across the
 *     observed window. The thresholds are not arbitrary: NC's published
 *     guidance is that a pattern needs a few observations before it is
 *     called a pattern, and a clear majority before the user is asked to
 *     trust it.
 *   - Returns a structured result with confidence (0-1), instance count,
 *     and a NC-voice suggestion. The suggestion never frames a symptom
 *     as a problem; it frames the timing as something the user might
 *     want to log proactively.
 *
 * What this module deliberately does NOT do:
 *   - Decide WHY the pattern exists. Causal claims need a clinician.
 *   - Mix data across cycles with very different lengths without
 *     scaling. Phase classification adapts to the cycle's actual length
 *     via mean cycle length, which is the same correction current-day
 *     applies.
 *   - Surface a pattern with fewer than 3 instances. Two coincidental
 *     log entries are not a pattern.
 *
 * Pattern matching is purely retrospective. The Radar surface uses these
 * results to seed proactive prompts ("you often log X around CD 18, want
 * to track today?") but the logic itself never assumes the future.
 */
import type { CyclePhase } from '@/lib/types'
import { phaseFromDay } from './current-day'

export interface SymptomLog {
  /** ISO date YYYY-MM-DD when the symptom was logged. */
  date: string
  /** Free-form symptom name; case-insensitive matching. */
  symptom: string
}

export interface CycleData {
  /** ISO date YYYY-MM-DD of the first menstrual day of this cycle. */
  startDate: string
  /**
   * Cycle length in days. Last cycle on the list may be in-progress; the
   * caller passes its provisional length (today minus startDate) so the
   * window classifier still has an end-bound.
   */
  lengthDays: number
}

export interface SymptomPattern {
  /** Lower-cased symptom name; the Radar UI title-cases for display. */
  symptom: string
  /** Phase where >= 70% of occurrences clustered. */
  observed_in_phase: CyclePhase
  /**
   * Confidence as a fraction 0-1. Specifically: occurrences in dominant
   * phase divided by total occurrences across all observed cycles.
   */
  confidence: number
  /** Number of occurrences total across the observed window. */
  instances: number
  /** NC-voice copy: gentle, suggestion-shaped, never alarmist. */
  suggestion: string
}

export interface SymptomRadarInputs {
  symptomLogs: ReadonlyArray<SymptomLog>
  cycles: ReadonlyArray<CycleData>
  /**
   * Optional override for the dominance threshold. Defaults to 0.7
   * (NC's clear-majority rule). Tests can lower this to assert the
   * weak-pattern path without crafting unrealistic fixtures.
   */
  dominanceThreshold?: number
  /**
   * Optional override for minimum instances. Defaults to 3.
   */
  minInstances?: number
}

const DEFAULT_DOMINANCE = 0.7
const DEFAULT_MIN_INSTANCES = 3

/**
 * Detect symptom-to-phase correlations across a set of cycles.
 *
 * Returns one SymptomPattern per symptom whose occurrences satisfy:
 *   1. >= minInstances total occurrences inside the cycle windows.
 *   2. >= dominanceThreshold fraction in a single phase.
 *
 * Returned array is sorted by confidence desc, then instances desc, so
 * the strongest pattern surfaces first in the UI.
 */
export function detectSymptomCyclePatterns(
  input: SymptomRadarInputs,
): SymptomPattern[] {
  const dominance = input.dominanceThreshold ?? DEFAULT_DOMINANCE
  const minInstances = input.minInstances ?? DEFAULT_MIN_INSTANCES

  if (input.symptomLogs.length === 0 || input.cycles.length === 0) return []

  // Sort cycles ascending so binary-style lookup walks chronologically.
  const cyclesAsc = [...input.cycles]
    .filter((c) => isIsoDate(c.startDate) && Number.isFinite(c.lengthDays) && c.lengthDays > 0)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  if (cyclesAsc.length === 0) return []

  // Mean cycle length feeds phaseFromDay so a 32-day cycler's CD17 is
  // still classified as ovulatory rather than as luteal under the
  // textbook 28-day boundaries.
  const meanCycleLength =
    cyclesAsc.reduce((a, c) => a + c.lengthDays, 0) / cyclesAsc.length

  // counts[symptom][phase] = occurrences
  const counts = new Map<string, Record<CyclePhase, number>>()

  for (const log of input.symptomLogs) {
    if (!isIsoDate(log.date)) continue
    const symptom = (log.symptom ?? '').trim().toLowerCase()
    if (!symptom) continue

    const cycleHit = findCycleForDate(log.date, cyclesAsc)
    if (!cycleHit) continue

    const cycleDay =
      Math.floor(
        (Date.parse(log.date + 'T00:00:00Z') -
          Date.parse(cycleHit.startDate + 'T00:00:00Z')) /
          (24 * 60 * 60 * 1000),
      ) + 1
    if (cycleDay < 1) continue

    const phase = phaseFromDay(cycleDay, meanCycleLength)

    let bucket = counts.get(symptom)
    if (!bucket) {
      bucket = { menstrual: 0, follicular: 0, ovulatory: 0, luteal: 0 }
      counts.set(symptom, bucket)
    }
    bucket[phase] += 1
  }

  const patterns: SymptomPattern[] = []
  for (const [symptom, bucket] of counts) {
    const total = bucket.menstrual + bucket.follicular + bucket.ovulatory + bucket.luteal
    if (total < minInstances) continue

    const phases: CyclePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal']
    let dominantPhase: CyclePhase = 'menstrual'
    let dominantCount = bucket.menstrual
    for (const p of phases) {
      if (bucket[p] > dominantCount) {
        dominantCount = bucket[p]
        dominantPhase = p
      }
    }
    const ratio = dominantCount / total
    if (ratio < dominance) continue

    patterns.push({
      symptom,
      observed_in_phase: dominantPhase,
      confidence: Number(ratio.toFixed(2)),
      instances: total,
      suggestion: buildSuggestion(symptom, dominantPhase, total),
    })
  }

  patterns.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return b.instances - a.instances
  })

  return patterns
}

/**
 * Build the NC-voice suggestion. The wording is deliberately gentle: the
 * Radar surfaces a pattern, not a diagnosis. Tone: "you often notice X
 * around this phase, you might want to log it" rather than "X is caused
 * by your luteal phase".
 */
function buildSuggestion(symptom: string, phase: CyclePhase, instances: number): string {
  const phaseCopy: Record<CyclePhase, string> = {
    menstrual: 'during your period',
    follicular: 'in the follicular phase, the first half of your cycle',
    ovulatory: 'around ovulation, mid-cycle',
    luteal: 'in the luteal phase, the week before your period',
  }
  const display = symptom
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
  return `You logged ${display} ${instances} times, mostly ${phaseCopy[phase]}. Logging it again next time this phase comes around makes the pattern easier to spot.`
}

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/**
 * Locate the cycle whose window contains the given date. Cycles are
 * passed in ascending order. A date is in cycle i when it falls between
 * startDate[i] (inclusive) and startDate[i] + lengthDays (exclusive).
 *
 * Returns null when the date predates the earliest cycle or sits past
 * the last cycle's window (we do not extrapolate forward, the caller is
 * responsible for closing the most recent cycle by passing today's date
 * minus startDate as its length).
 */
function findCycleForDate(
  dateIso: string,
  cyclesAsc: ReadonlyArray<CycleData>,
): CycleData | null {
  const ms = Date.parse(dateIso + 'T00:00:00Z')
  if (!Number.isFinite(ms)) return null
  for (const c of cyclesAsc) {
    const startMs = Date.parse(c.startDate + 'T00:00:00Z')
    const endMs = startMs + c.lengthDays * 24 * 60 * 60 * 1000
    if (ms >= startMs && ms < endMs) return c
  }
  return null
}
