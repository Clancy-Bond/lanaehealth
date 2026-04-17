import { supabase } from '@/lib/supabase'
import type { DailyLog, EnergyMode, PainPoint, PainPointInput } from '@/lib/types'
import { format } from 'date-fns'

/**
 * Get or create today's daily log entry.
 * Uses upsert to avoid duplicates on the unique date column.
 */
export async function getOrCreateTodayLog(): Promise<DailyLog> {
  const today = format(new Date(), 'yyyy-MM-dd')

  // Try to get existing log
  const { data: existing, error: fetchError } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('date', today)
    .maybeSingle()

  if (fetchError) {
    throw new Error(`Failed to fetch today's log: ${fetchError.message}`)
  }

  if (existing) return existing as DailyLog

  // Create new log for today
  const { data: created, error: createError } = await supabase
    .from('daily_logs')
    .insert({ date: today })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create today's log: ${createError.message}`)
  }

  return created as DailyLog
}

/**
 * Get a daily log by date string (YYYY-MM-DD)
 */
export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch log: ${error.message}`)
  return data as DailyLog | null
}

/**
 * Get daily logs for a date range (inclusive)
 */
export async function getDailyLogs(startDate: string, endDate: string): Promise<DailyLog[]> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) throw new Error(`Failed to fetch logs: ${error.message}`)
  return (data || []) as DailyLog[]
}

/**
 * Update fields on a daily log (partial update)
 */
export async function updateDailyLog(
  logId: string,
  fields: Partial<Omit<DailyLog, 'id' | 'date' | 'created_at' | 'updated_at'>>
): Promise<DailyLog> {
  const { data, error } = await supabase
    .from('daily_logs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', logId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update log: ${error.message}`)
  return data as DailyLog
}

/**
 * Add a pain point to a daily log
 */
export async function addPainPoint(input: PainPointInput): Promise<PainPoint> {
  const { data, error } = await supabase
    .from('pain_points')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`Failed to add pain point: ${error.message}`)
  return data as PainPoint
}

/**
 * Get all pain points for a daily log
 */
export async function getPainPoints(logId: string): Promise<PainPoint[]> {
  const { data, error } = await supabase
    .from('pain_points')
    .select('*')
    .eq('log_id', logId)
    .order('logged_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch pain points: ${error.message}`)
  return (data || []) as PainPoint[]
}

/**
 * Delete a pain point
 */
export async function deletePainPoint(id: string): Promise<void> {
  const { error } = await supabase
    .from('pain_points')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete pain point: ${error.message}`)
}

/**
 * Update a pain point
 */
export async function updatePainPoint(
  id: string,
  fields: Partial<Omit<PainPoint, 'id' | 'log_id' | 'logged_at'>>
): Promise<PainPoint> {
  const { data, error } = await supabase
    .from('pain_points')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update pain point: ${error.message}`)
  return data as PainPoint
}

// ── Energy mode + Rest day (migration 020) ───────────────────────────
// These functions persist the user's chosen energy mode and rest-day flag
// for a daily_log. Both are additive and never mutate other fields.
// Voice rules: docs/plans/2026-04-16-non-shaming-voice-rule.md.

/**
 * Set the user's energy mode for a daily_log. Pass null to clear.
 * Idempotent. Only touches the energy_mode column.
 */
export async function setEnergyMode(
  logId: string,
  mode: EnergyMode | null
): Promise<DailyLog> {
  const { data, error } = await supabase
    .from('daily_logs')
    .update({ energy_mode: mode, updated_at: new Date().toISOString() })
    .eq('id', logId)
    .select()
    .single()

  if (error) throw new Error(`Failed to set energy mode: ${error.message}`)
  return data as DailyLog
}

/**
 * Set the rest_day flag on a daily_log. Passing true marks the day as a
 * deliberate rest day (a positive log, not a null log). Passing false
 * clears the flag. Idempotent. Only touches rest_day and updated_at.
 */
export async function setRestDay(
  logId: string,
  isRestDay: boolean
): Promise<DailyLog> {
  const { data, error } = await supabase
    .from('daily_logs')
    .update({ rest_day: isRestDay, updated_at: new Date().toISOString() })
    .eq('id', logId)
    .select()
    .single()

  if (error) throw new Error(`Failed to set rest day: ${error.message}`)
  return data as DailyLog
}
