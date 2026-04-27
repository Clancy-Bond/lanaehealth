/**
 * Detect which condition-aware UI cues should fire based on the user's
 * diagnoses on file.
 *
 * Originally lived inside src/app/v2/log/pain/_components/condition-detection.ts.
 * That file was deleted with the pain body-map UI in PR 134; this module
 * preserves the diagnosis-flag helper for the remaining consumer
 * (PainCheckInCard on /v2/today). Other condition-aware logic that
 * tied into the deleted body map (smart prompts keyed off region +
 * quality selection) lives no longer.
 */

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
