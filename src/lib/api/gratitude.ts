import { supabase } from '@/lib/supabase'
import type { GratitudeEntry, GratitudeType } from '@/lib/types'

/**
 * Get all gratitude entries for a daily log
 */
export async function getGratitudes(logId: string): Promise<GratitudeEntry[]> {
  const { data, error } = await supabase
    .from('gratitude_entries')
    .select('*')
    .eq('log_id', logId)
    .order('logged_at', { ascending: true })

  if (error) throw new Error(`Failed to fetch gratitudes: ${error.message}`)
  return (data || []) as GratitudeEntry[]
}

/**
 * Add a gratitude entry
 */
export async function addGratitude(
  logId: string,
  content: string,
  entryType: GratitudeType = 'gratitude'
): Promise<GratitudeEntry> {
  const { data, error } = await supabase
    .from('gratitude_entries')
    .insert({
      log_id: logId,
      content,
      entry_type: entryType,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to add gratitude: ${error.message}`)
  return data as GratitudeEntry
}

/**
 * Delete a gratitude entry
 */
export async function deleteGratitude(id: string): Promise<void> {
  const { error } = await supabase
    .from('gratitude_entries')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete gratitude: ${error.message}`)
}
