/**
 * Detect which condition-aware smart prompts should fire based on the
 * user's diagnoses and their current pain selections.
 *
 * Server reads the health profile (or active_problems) and passes the
 * relevant boolean flags to the client. The client decides whether to
 * actually show a prompt based on the live form state (selected
 * qualities and region).
 */

import type { PainQuality } from '@/lib/types'
import type { BodyRegion } from './BodyMap'

export interface ConditionFlags {
  hasMigraine: boolean
  hasOrthostatic: boolean
}

/**
 * Inspect a list of diagnosis / problem strings and return which
 * condition-aware prompts the user is eligible for. Case-insensitive
 * substring match, deliberately loose to catch "vestibular migraine",
 * "ocular migraine", "POTS-like", etc.
 */
export function detectConditionFlags(diagnoses: string[]): ConditionFlags {
  const corpus = diagnoses.join(' ').toLowerCase()
  return {
    hasMigraine: /migraine/.test(corpus),
    hasOrthostatic:
      /pots|orthostatic|syncope|presyncope|dysautonomia|autonomic/.test(corpus),
  }
}

/**
 * Decide if the migraine prompt should appear for the current form
 * snapshot. We surface it when:
 *   - the user has any migraine diagnosis on file, AND
 *   - the body region is the head OR they picked at least one
 *     quality that classically maps to migraine (throbbing,
 *     pressure, or shooting through the head).
 */
export function shouldShowMigrainePrompt(
  flags: ConditionFlags,
  region: BodyRegion | null,
  qualities: PainQuality[],
): boolean {
  if (!flags.hasMigraine) return false
  if (region === 'head') return true
  const headLike = new Set<PainQuality>(['throbbing', 'pressure', 'shooting'])
  return qualities.some((q) => headLike.has(q))
}

/**
 * Decide if the orthostatic prompt should appear. We surface it when:
 *   - the user has POTS-like diagnoses, AND
 *   - they picked any quality / region that overlaps with orthostatic
 *     episodes (whole-body pain, head pain, chest, or sensations like
 *     tingling / pressure that often accompany presyncope).
 *
 * Liberal heuristic: false negatives are worse than false positives
 * because the prompt is a single tap to skip.
 */
export function shouldShowOrthostaticPrompt(
  flags: ConditionFlags,
  region: BodyRegion | null,
  qualities: PainQuality[],
): boolean {
  if (!flags.hasOrthostatic) return false
  if (region === 'head' || region === 'whole_body' || region === 'chest') return true
  const orthostaticLike = new Set<PainQuality>(['pressure', 'tingling', 'numb', 'throbbing'])
  return qualities.some((q) => orthostaticLike.has(q))
}
