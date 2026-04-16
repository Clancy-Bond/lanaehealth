import { supabase } from '@/lib/supabase'
import type { MoodEntry, MoodScore, EmotionTag } from '@/lib/types'

/**
 * Get mood entry for a daily log
 */
export async function getMood(logId: string): Promise<MoodEntry | null> {
  const { data, error } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('log_id', logId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch mood: ${error.message}`)
  return data as MoodEntry | null
}

/**
 * Save or update mood entry (upsert by log_id)
 */
export async function saveMood(
  logId: string,
  moodScore: MoodScore,
  emotions: EmotionTag[]
): Promise<MoodEntry> {
  // Check if entry exists
  const { data: existing } = await supabase
    .from('mood_entries')
    .select('id')
    .eq('log_id', logId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('mood_entries')
      .update({ mood_score: moodScore, emotions })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update mood: ${error.message}`)
    return data as MoodEntry
  }

  const { data, error } = await supabase
    .from('mood_entries')
    .insert({ log_id: logId, mood_score: moodScore, emotions })
    .select()
    .single()
  if (error) throw new Error(`Failed to save mood: ${error.message}`)
  return data as MoodEntry
}

/**
 * Delete mood entry for a log
 */
export async function deleteMood(logId: string): Promise<void> {
  const { error } = await supabase
    .from('mood_entries')
    .delete()
    .eq('log_id', logId)
  if (error) throw new Error(`Failed to delete mood: ${error.message}`)
}
