import { supabase } from '@/lib/supabase'
import type {
  CustomTrackable,
  CustomTrackableEntry,
  TrackableCategory,
  TrackableInputType,
} from '@/lib/types'

// ── Trackable Definitions ───────────────────────────────────────────

/**
 * Get all active custom trackables, ordered by display_order
 */
export async function getTrackables(): Promise<CustomTrackable[]> {
  const { data, error } = await supabase
    .from('custom_trackables')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw new Error(`Failed to fetch trackables: ${error.message}`)
  return (data || []) as CustomTrackable[]
}

/**
 * Create a new custom trackable
 */
export async function createTrackable(input: {
  name: string
  category: TrackableCategory
  input_type: TrackableInputType
  icon?: string
}): Promise<CustomTrackable> {
  // Get max display_order for positioning
  const { data: maxOrder } = await supabase
    .from('custom_trackables')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxOrder?.display_order ?? -1) + 1

  const { data, error } = await supabase
    .from('custom_trackables')
    .insert({
      name: input.name,
      category: input.category,
      input_type: input.input_type,
      icon: input.icon ?? null,
      display_order: nextOrder,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create trackable: ${error.message}`)
  return data as CustomTrackable
}

/**
 * Update a custom trackable (name, icon, order, active status)
 */
export async function updateTrackable(
  id: string,
  fields: Partial<Pick<CustomTrackable, 'name' | 'icon' | 'display_order' | 'is_active'>>
): Promise<CustomTrackable> {
  const { data, error } = await supabase
    .from('custom_trackables')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update trackable: ${error.message}`)
  return data as CustomTrackable
}

/**
 * Soft-delete a trackable (set is_active=false)
 */
export async function deleteTrackable(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_trackables')
    .update({ is_active: false })
    .eq('id', id)

  if (error) throw new Error(`Failed to delete trackable: ${error.message}`)
}

// ── Trackable Entries (daily values) ────────────────────────────────

/**
 * Get all trackable entries for a daily log
 */
export async function getTrackableEntries(logId: string): Promise<CustomTrackableEntry[]> {
  const { data, error } = await supabase
    .from('custom_trackable_entries')
    .select('*')
    .eq('log_id', logId)

  if (error) throw new Error(`Failed to fetch trackable entries: ${error.message}`)
  return (data || []) as CustomTrackableEntry[]
}

/**
 * Save a trackable entry (upsert on log_id + trackable_id)
 */
export async function saveTrackableEntry(
  logId: string,
  trackableId: string,
  value: { value?: number; text_value?: string; toggled?: boolean }
): Promise<CustomTrackableEntry> {
  const { data, error } = await supabase
    .from('custom_trackable_entries')
    .upsert(
      {
        log_id: logId,
        trackable_id: trackableId,
        value: value.value ?? null,
        text_value: value.text_value ?? null,
        toggled: value.toggled ?? null,
      },
      { onConflict: 'log_id,trackable_id' }
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to save trackable entry: ${error.message}`)
  return data as CustomTrackableEntry
}

/**
 * Delete a trackable entry
 */
export async function deleteTrackableEntry(logId: string, trackableId: string): Promise<void> {
  const { error } = await supabase
    .from('custom_trackable_entries')
    .delete()
    .eq('log_id', logId)
    .eq('trackable_id', trackableId)

  if (error) throw new Error(`Failed to delete trackable entry: ${error.message}`)
}
