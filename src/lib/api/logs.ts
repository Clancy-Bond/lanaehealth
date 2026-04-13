import { supabase } from '@/lib/supabase'
import type { DailyLog, PainPoint, PainPointInput } from '@/lib/types'
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
