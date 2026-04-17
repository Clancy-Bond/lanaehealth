// ---------------------------------------------------------------------------
// symptom-conditions api helpers
//
// Thin wrapper around the `symptom_conditions` junction table (migration 018).
// Ties rows in `symptoms` to rows in `active_problems` so doctor-prep views
// can filter symptom lists by condition for the relevant specialist.
//
// Design rules:
//   - `symptoms` and `active_problems` are READ-ONLY from this module.
//     We never UPDATE or DELETE rows on the parent tables here.
//   - `tagSymptomWithConditions` is idempotent: re-tagging the same
//     (symptom_id, condition_id) pair never errors; the UNIQUE constraint
//     on the junction is treated as a "no-op" by the replace-set behavior.
//   - A symptom tagged to zero conditions is intentional - see the
//     migration comment for the "catch-all" display rule.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'

export type SymptomConditionConfidence = 'explicit' | 'inferred'

export interface SymptomCondition {
  id: string
  symptom_id: string
  condition_id: string
  confidence: SymptomConditionConfidence
  tagged_at: string
}

export interface SymptomConditionInput {
  symptomId: string
  conditionId: string
  confidence?: SymptomConditionConfidence
}

/**
 * Clamp an untrusted string to the allowed confidence enum. Anything that
 * is not exactly 'inferred' collapses back to the safe default 'explicit'.
 */
export function normalizeConfidence(
  value: string | null | undefined
): SymptomConditionConfidence {
  return value === 'inferred' ? 'inferred' : 'explicit'
}

/**
 * Return all condition tags for a given symptom, ordered by tagged_at desc
 * so the most recent manual tag wins in UI display. Returns [] when the
 * symptom has never been tagged (legacy symptoms from before 2026-04-17).
 */
export async function getConditionsForSymptom(
  symptomId: string
): Promise<SymptomCondition[]> {
  const { data, error } = await supabase
    .from('symptom_conditions')
    .select('*')
    .eq('symptom_id', symptomId)
    .order('tagged_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch conditions for symptom: ${error.message}`)
  }
  return (data ?? []) as SymptomCondition[]
}

/**
 * Replace the full set of condition tags on a symptom with the given list.
 * Deletes all existing tags on the symptom, then inserts the new set.
 * Idempotent: calling with the same IDs twice leaves the same final rows.
 *
 * This "replace-set" shape matches saveSymptomsBatch() in ../api/symptoms.ts
 * so the UI stays consistent with how symptoms themselves are persisted.
 *
 * Passing an empty array untags the symptom entirely - legal and expected
 * when the user deselects every condition chip.
 */
export async function tagSymptomWithConditions(
  symptomId: string,
  conditionIds: string[],
  confidence: SymptomConditionConfidence = 'explicit'
): Promise<SymptomCondition[]> {
  // De-duplicate client input so we never hit the UNIQUE constraint.
  const uniqueIds = Array.from(new Set(conditionIds.filter(Boolean)))

  const { error: deleteError } = await supabase
    .from('symptom_conditions')
    .delete()
    .eq('symptom_id', symptomId)

  if (deleteError) {
    throw new Error(`Failed to clear symptom tags: ${deleteError.message}`)
  }

  if (uniqueIds.length === 0) return []

  const rows = uniqueIds.map((conditionId) => ({
    symptom_id: symptomId,
    condition_id: conditionId,
    confidence,
  }))

  const { data, error } = await supabase
    .from('symptom_conditions')
    .insert(rows)
    .select()

  if (error) {
    throw new Error(`Failed to tag symptom with conditions: ${error.message}`)
  }
  return (data ?? []) as SymptomCondition[]
}

/**
 * Return all symptoms that have been tagged to a given condition. Used by
 * the doctor-prep Specialist filter on DataFindings to scope the list.
 *
 * `dateRange` is optional; when omitted we return every tagged symptom.
 * When provided we filter on the junction's tagged_at, not on the parent
 * symptom's logged_at, because the user may back-tag older symptoms and
 * we want the filter to reflect the tagging decision.
 */
export async function getSymptomsForCondition(
  conditionId: string,
  dateRange?: { fromISO: string; toISO: string }
): Promise<SymptomCondition[]> {
  let query = supabase
    .from('symptom_conditions')
    .select('*')
    .eq('condition_id', conditionId)
    .order('tagged_at', { ascending: false })

  if (dateRange) {
    query = query.gte('tagged_at', dateRange.fromISO).lte('tagged_at', dateRange.toISO)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to fetch symptoms for condition: ${error.message}`)
  }
  return (data ?? []) as SymptomCondition[]
}

/**
 * Insert a single tag row with a specific confidence. Useful for future
 * rule-based inference code paths that set confidence='inferred' without
 * wiping an existing explicit tag set.
 *
 * Safe to call twice with the same inputs: the UNIQUE (symptom_id,
 * condition_id) constraint rejects duplicates at the DB, and we surface
 * that as a clear error message the caller can choose to ignore.
 */
export async function addSymptomConditionTag(
  input: SymptomConditionInput
): Promise<SymptomCondition> {
  const { data, error } = await supabase
    .from('symptom_conditions')
    .insert({
      symptom_id: input.symptomId,
      condition_id: input.conditionId,
      confidence: normalizeConfidence(input.confidence ?? 'explicit'),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to add symptom-condition tag: ${error.message}`)
  }
  return data as SymptomCondition
}
