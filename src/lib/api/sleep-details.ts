import { supabase } from '@/lib/supabase'
import type { SleepDetail, SleepWakeEpisode, SleepQualityFactor, SleepNap } from '@/lib/types'

/**
 * Get sleep details for a daily log
 */
export async function getSleepDetails(logId: string): Promise<SleepDetail | null> {
  const { data, error } = await supabase
    .from('sleep_details')
    .select('*')
    .eq('log_id', logId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch sleep details: ${error.message}`)
  return data as SleepDetail | null
}

/**
 * Save or update sleep details (upsert by log_id)
 */
export async function saveSleepDetails(
  logId: string,
  details: {
    bedtime?: string | null
    wake_time?: string | null
    sleep_latency_min?: number | null
    wake_episodes?: SleepWakeEpisode[]
    sleep_quality_factors?: SleepQualityFactor[]
    naps?: SleepNap[]
  }
): Promise<SleepDetail> {
  const { data, error } = await supabase
    .from('sleep_details')
    .upsert(
      {
        log_id: logId,
        bedtime: details.bedtime ?? null,
        wake_time: details.wake_time ?? null,
        sleep_latency_min: details.sleep_latency_min ?? null,
        wake_episodes: details.wake_episodes ?? [],
        sleep_quality_factors: details.sleep_quality_factors ?? [],
        naps: details.naps ?? [],
      },
      { onConflict: 'log_id' }
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to save sleep details: ${error.message}`)
  return data as SleepDetail
}

/**
 * Delete sleep details for a log
 */
export async function deleteSleepDetails(logId: string): Promise<void> {
  const { error } = await supabase
    .from('sleep_details')
    .delete()
    .eq('log_id', logId)

  if (error) throw new Error(`Failed to delete sleep details: ${error.message}`)
}
