// ---------------------------------------------------------------------------
// micro-care api helpers
//
// Thin wrapper around the `micro_care_completions` table (migration 021).
// All operations are additive inserts / reads. We never UPDATE or DELETE
// past completions because doing so would enable accidental streak math.
//
// Voice rule: the functions below return plain counts and timestamps.
// They NEVER compute streaks, adherence percentages, or "goal met"
// booleans. UI code that uses these values must respect the same rule.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'
import { isValidMicroCareSlug } from '@/lib/micro-care/actions'

export interface MicroCareCompletion {
  id: string
  patient_id: string
  action_slug: string
  completed_at: string
  duration_seconds: number | null
  felt_better: boolean | null
  notes: string | null
}

export interface LogMicroCareInput {
  actionSlug: string
  durationSeconds?: number | null
  feltBetter?: boolean | null
  notes?: string | null
}

/**
 * Insert a single completion row. Rejects unknown slugs before reaching
 * the DB so a bad client call fails fast with a clear Error.
 *
 * Returns the inserted row. Never throws on duplicate completions - the
 * same action can be logged many times per day (and often should be,
 * e.g. repeated hydration).
 */
export async function logMicroCareCompletion(
  input: LogMicroCareInput
): Promise<MicroCareCompletion> {
  if (!isValidMicroCareSlug(input.actionSlug)) {
    throw new Error(`Unknown micro-care action slug: ${input.actionSlug}`)
  }

  const { data, error } = await supabase
    .from('micro_care_completions')
    .insert({
      action_slug: input.actionSlug,
      duration_seconds: input.durationSeconds ?? null,
      felt_better: input.feltBetter ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to log micro-care completion: ${error.message}`)
  }
  return data as MicroCareCompletion
}

/**
 * Recent completions, ordered newest-first. Used by the drawer header
 * to show a gentle "you chose care X times this week" count. We expose
 * RAW rows here; the caller is responsible for any windowing.
 */
export async function getRecentMicroCareCompletions(
  limit = 50
): Promise<MicroCareCompletion[]> {
  const { data, error } = await supabase
    .from('micro_care_completions')
    .select('*')
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch micro-care completions: ${error.message}`)
  }
  return (data ?? []) as MicroCareCompletion[]
}

/**
 * Count of completions in the last `days` days across all actions.
 * Returned as a plain integer. Caller chooses how to frame it; the
 * only approved framing in the Lanae-facing UI is a positive
 * presence count, e.g. "You chose care 6 times this week." No ratio,
 * no denominator, no percentage, no streak.
 */
export async function countRecentMicroCareCompletions(
  days = 7
): Promise<number> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { count, error } = await supabase
    .from('micro_care_completions')
    .select('*', { count: 'exact', head: true })
    .gte('completed_at', since.toISOString())

  if (error) {
    throw new Error(`Failed to count micro-care completions: ${error.message}`)
  }
  return count ?? 0
}
