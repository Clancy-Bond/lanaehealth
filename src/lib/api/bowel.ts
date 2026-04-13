import { supabase } from '@/lib/supabase'
import type { Symptom } from '@/lib/types'
import { getOrCreateTodayLog } from './logs'

export interface BowelEntry {
  id: string
  log_id: string
  bristol_type: number // 1-7
  urgency: boolean
  pain_during: boolean
  blood_present: boolean
  color: BowelColor
  notes: string
  logged_at: string
}

export type BowelColor = 'normal' | 'pale' | 'dark' | 'bloody' | 'green' | 'yellow'

export interface BowelEntryInput {
  bristol_type: number
  urgency: boolean
  pain_during: boolean
  blood_present: boolean
  color: BowelColor
  notes: string
}

/**
 * Save a bowel entry as a symptom with category='gi'.
 * The structured data is stored as JSON in the symptom field.
 */
export async function saveBowelEntry(input: BowelEntryInput): Promise<Symptom> {
  const log = await getOrCreateTodayLog()

  const payload = JSON.stringify(input)

  const { data, error } = await supabase
    .from('symptoms')
    .insert({
      log_id: log.id,
      category: 'gi',
      symptom: `bowel:${payload}`,
      severity: input.bristol_type <= 2 || input.bristol_type >= 6 ? 'severe' : input.bristol_type === 3 || input.bristol_type === 5 ? 'mild' : null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to save bowel entry: ${error.message}`)
  return data as Symptom
}

/**
 * Get all bowel entries for today's log.
 * Filters symptoms that start with 'bowel:' prefix.
 */
export async function getTodayBowelEntries(): Promise<{ symptom: Symptom; data: BowelEntryInput }[]> {
  const log = await getOrCreateTodayLog()

  const { data, error } = await supabase
    .from('symptoms')
    .select('*')
    .eq('log_id', log.id)
    .eq('category', 'gi')
    .like('symptom', 'bowel:%')
    .order('logged_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch bowel entries: ${error.message}`)

  return (data || []).map((s: Symptom) => ({
    symptom: s,
    data: JSON.parse(s.symptom.replace('bowel:', '')) as BowelEntryInput,
  }))
}

/**
 * Delete a bowel entry (deletes the underlying symptom row)
 */
export async function deleteBowelEntry(symptomId: string): Promise<void> {
  const { error } = await supabase
    .from('symptoms')
    .delete()
    .eq('id', symptomId)

  if (error) throw new Error(`Failed to delete bowel entry: ${error.message}`)
}
