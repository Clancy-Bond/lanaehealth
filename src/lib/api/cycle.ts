import { supabase } from '@/lib/supabase'
import type { CycleEntry, CycleEntryInput } from '@/lib/types'
import { format } from 'date-fns'

/**
 * Get or create a cycle entry for today
 */
export async function getOrCreateTodayCycleEntry(): Promise<CycleEntry> {
  const today = format(new Date(), 'yyyy-MM-dd')
  return getOrCreateCycleEntry(today)
}

/**
 * Get or create a cycle entry for a given date
 */
export async function getOrCreateCycleEntry(date: string): Promise<CycleEntry> {
  const { data: existing, error: fetchError } = await supabase
    .from('cycle_entries')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (fetchError) throw new Error(`Failed to fetch cycle entry: ${fetchError.message}`)
  if (existing) return existing as CycleEntry

  const { data: created, error: createError } = await supabase
    .from('cycle_entries')
    .insert({ date, menstruation: false })
    .select()
    .single()

  if (createError) throw new Error(`Failed to create cycle entry: ${createError.message}`)
  return created as CycleEntry
}

/**
 * Update a cycle entry
 */
export async function updateCycleEntry(
  date: string,
  fields: Partial<Omit<CycleEntry, 'id' | 'date' | 'created_at'>>
): Promise<CycleEntry> {
  // Upsert by date
  const { data, error } = await supabase
    .from('cycle_entries')
    .upsert({ date, ...fields }, { onConflict: 'date' })
    .select()
    .single()

  if (error) throw new Error(`Failed to update cycle entry: ${error.message}`)
  return data as CycleEntry
}

/**
 * Get cycle entries for a date range
 */
export async function getCycleEntries(startDate: string, endDate: string): Promise<CycleEntry[]> {
  const { data, error } = await supabase
    .from('cycle_entries')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) throw new Error(`Failed to fetch cycle entries: ${error.message}`)
  return (data || []) as CycleEntry[]
}

/**
 * Get all cycle entries with menstruation=true (for cycle phase calculation)
 */
export async function getPeriodHistory(): Promise<CycleEntry[]> {
  const { data, error } = await supabase
    .from('cycle_entries')
    .select('*')
    .eq('menstruation', true)
    .order('date', { ascending: true })

  if (error) throw new Error(`Failed to fetch period history: ${error.message}`)
  return (data || []) as CycleEntry[]
}

/**
 * Save a full cycle entry from the form
 */
export async function saveCycleEntry(input: CycleEntryInput): Promise<CycleEntry> {
  const { data, error } = await supabase
    .from('cycle_entries')
    .upsert(input, { onConflict: 'date' })
    .select()
    .single()

  if (error) throw new Error(`Failed to save cycle entry: ${error.message}`)
  return data as CycleEntry
}
