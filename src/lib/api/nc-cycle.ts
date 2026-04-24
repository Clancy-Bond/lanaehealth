import { supabase } from '@/lib/supabase'
import type { CycleEntry, NcImported, FlowLevel } from '@/lib/types'

/**
 * Map Natural Cycles flow_quantity text to our FlowLevel enum.
 * NC uses descriptive strings; we normalize them to our standard levels.
 */
function mapFlowQuantity(flowQuantity: string | null): FlowLevel | null {
  if (!flowQuantity) return null
  const normalized = flowQuantity.toLowerCase().trim()
  if (normalized === 'spotting') return 'spotting'
  if (normalized === 'light') return 'light'
  if (normalized === 'medium') return 'medium'
  if (normalized === 'heavy') return 'heavy'
  if (normalized === 'none') return 'none'
  // Fallback: if we don't recognize the value, return null
  return null
}

/**
 * Convert an NcImported row to a CycleEntry for backward compatibility
 * with existing cycle page components.
 */
function ncToCycleEntry(nc: NcImported): CycleEntry {
  const isMenstruating = nc.menstruation?.toLowerCase() === 'menstruation'
  return {
    id: nc.id,
    date: nc.date,
    flow_level: mapFlowQuantity(nc.flow_quantity),
    menstruation: isMenstruating,
    ovulation_signs: nc.ovulation_status || null,
    lh_test_result: nc.lh_test || null,
    cervical_mucus_consistency: nc.cervical_mucus_consistency || null,
    cervical_mucus_quantity: nc.cervical_mucus_quantity || null,
    // Endo-mode fields: not captured in NC, so default null
    bowel_symptoms: null,
    bladder_symptoms: null,
    dyspareunia: null,
    dyspareunia_intensity: null,
    clots_present: null,
    clot_size: null,
    clot_count: null,
    endo_notes: null,
    // Granular daily log fields (migration 028): not captured in NC, default null
    symptoms: null,
    sex_activity_type: null,
    skin_state: null,
    mood_emoji: null,
    created_at: nc.imported_at,
  }
}

/**
 * Fetch NC imported data for a date range and return as CycleEntry[]
 * for backward compatibility with existing cycle page components.
 */
export async function getNcCycleEntries(
  startDate: string,
  endDate: string
): Promise<CycleEntry[]> {
  const { data, error } = await supabase
    .from('nc_imported')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) throw new Error(`Failed to fetch NC cycle entries: ${error.message}`)
  return (data || []).map((row: NcImported) => ncToCycleEntry(row))
}

/**
 * Fetch full NC imported rows with all rich data (temperature, fertility_color,
 * ovulation_status, cycle_day, cycle_number, etc.).
 */
export async function getNcRawEntries(
  startDate: string,
  endDate: string
): Promise<NcImported[]> {
  const { data, error } = await supabase
    .from('nc_imported')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) throw new Error(`Failed to fetch NC raw entries: ${error.message}`)
  return (data || []) as NcImported[]
}

/**
 * Get all NC imported entries where menstruation is present,
 * ordered ascending by date (for cycle phase calculations).
 *
 * nc_imported stores both observed history AND Natural Cycles' own forward
 * predictions (flow_quantity / menstruation values keyed to predicted next
 * cycle starts). Period history MUST exclude those predictions, so the
 * date range is capped at today.
 */
export async function getNcPeriodHistory(): Promise<CycleEntry[]> {
  const todayISO = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('nc_imported')
    .select('*')
    .eq('menstruation', 'menstruation')
    .lte('date', todayISO)
    .order('date', { ascending: true })

  if (error) throw new Error(`Failed to fetch NC period history: ${error.message}`)
  return (data || []).map((row: NcImported) => ncToCycleEntry(row))
}

/**
 * Merge nc_imported with cycle_entries for a date range.
 * When both sources have data for the same date, NC data takes priority
 * (it's the authoritative import from Natural Cycles).
 * Returns CycleEntry[] sorted descending by date.
 */
export async function getCombinedCycleEntries(
  startDate: string,
  endDate: string
): Promise<CycleEntry[]> {
  // Fetch both sources in parallel
  const [ncResult, manualResult] = await Promise.all([
    supabase
      .from('nc_imported')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('cycle_entries')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate),
  ])

  if (ncResult.error) throw new Error(`Failed to fetch NC entries: ${ncResult.error.message}`)
  if (manualResult.error) throw new Error(`Failed to fetch cycle entries: ${manualResult.error.message}`)

  // Build a map keyed by date, starting with manual entries
  const entryMap = new Map<string, CycleEntry>()

  for (const row of (manualResult.data || []) as CycleEntry[]) {
    entryMap.set(row.date, row)
  }

  // NC data overwrites manual entries for the same date
  for (const row of (ncResult.data || []) as NcImported[]) {
    entryMap.set(row.date, ncToCycleEntry(row))
  }

  // Sort descending by date
  return Array.from(entryMap.values()).sort(
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
  )
}
