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

// Endo-mode columns added in migration 011. If the user has not yet applied
// the migration, writing these fields causes Postgres to return a
// "column does not exist" error. We strip them and retry so the non-endo
// save still lands.
const ENDO_ONLY_FIELDS: Array<keyof CycleEntry> = [
  'bowel_symptoms',
  'bladder_symptoms',
  'dyspareunia',
  'dyspareunia_intensity',
  'clots_present',
  'clot_size',
  'clot_count',
  'endo_notes',
]

function stripEndoFields<T extends Record<string, unknown>>(fields: T): Partial<T> {
  const next: Partial<T> = {}
  for (const k of Object.keys(fields)) {
    if (!ENDO_ONLY_FIELDS.includes(k as keyof CycleEntry)) {
      (next as Record<string, unknown>)[k] = fields[k]
    }
  }
  return next
}

/**
 * Update a cycle entry
 */
export async function updateCycleEntry(
  date: string,
  fields: Partial<Omit<CycleEntry, 'id' | 'date' | 'created_at'>>
): Promise<CycleEntry> {
  // First attempt: upsert with all fields (including endo fields if provided)
  const first = await supabase
    .from('cycle_entries')
    .upsert({ date, ...fields }, { onConflict: 'date' })
    .select()
    .single()

  if (!first.error) {
    return first.data as CycleEntry
  }

  // Fallback: if Postgres complained about a missing column, retry without
  // endo-only fields. The message looks like: column "bowel_symptoms" of
  // relation "cycle_entries" does not exist
  const isMissingColumn =
    /column\s+"?(bowel_symptoms|bladder_symptoms|dyspareunia|dyspareunia_intensity|clots_present|clot_size|clot_count|endo_notes)"?/i
      .test(first.error.message)

  if (isMissingColumn) {
    const retry = await supabase
      .from('cycle_entries')
      .upsert({ date, ...stripEndoFields(fields) }, { onConflict: 'date' })
      .select()
      .single()

    if (retry.error) {
      throw new Error(`Failed to update cycle entry (endo-stripped retry): ${retry.error.message}`)
    }
    return retry.data as CycleEntry
  }

  throw new Error(`Failed to update cycle entry: ${first.error.message}`)
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
