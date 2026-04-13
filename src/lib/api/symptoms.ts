import { supabase } from '@/lib/supabase'
import type { Symptom, SymptomInput, SymptomCategory, Severity } from '@/lib/types'

/**
 * Get all symptoms for a daily log
 */
export async function getSymptoms(logId: string): Promise<Symptom[]> {
  const { data, error } = await supabase
    .from('symptoms')
    .select('*')
    .eq('log_id', logId)
    .order('logged_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch symptoms: ${error.message}`)
  return (data || []) as Symptom[]
}

/**
 * Add a symptom entry
 */
export async function addSymptom(input: SymptomInput): Promise<Symptom> {
  const { data, error } = await supabase
    .from('symptoms')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`Failed to add symptom: ${error.message}`)
  return data as Symptom
}

/**
 * Update a symptom's severity
 */
export async function updateSymptomSeverity(id: string, severity: Severity): Promise<Symptom> {
  const { data, error } = await supabase
    .from('symptoms')
    .update({ severity })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update symptom: ${error.message}`)
  return data as Symptom
}

/**
 * Delete a symptom
 */
export async function deleteSymptom(id: string): Promise<void> {
  const { error } = await supabase
    .from('symptoms')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete symptom: ${error.message}`)
}

/**
 * Batch save symptoms for a log. Deletes all existing symptoms for the log
 * and re-inserts the provided list. This keeps things in sync with toggle state.
 */
export async function saveSymptomsBatch(
  logId: string,
  symptoms: { category: SymptomCategory; symptom: string; severity: Severity }[]
): Promise<Symptom[]> {
  // Delete existing symptoms for this log
  const { error: deleteError } = await supabase
    .from('symptoms')
    .delete()
    .eq('log_id', logId)

  if (deleteError) throw new Error(`Failed to clear symptoms: ${deleteError.message}`)

  if (symptoms.length === 0) return []

  // Insert new batch
  const rows = symptoms.map((s) => ({
    log_id: logId,
    category: s.category,
    symptom: s.symptom,
    severity: s.severity,
  }))

  const { data, error } = await supabase
    .from('symptoms')
    .insert(rows)
    .select()

  if (error) throw new Error(`Failed to save symptoms: ${error.message}`)
  return (data || []) as Symptom[]
}
