import { supabase } from '@/lib/supabase'
import type { FoodEntry, MealType } from '@/lib/types'

/**
 * Get food entries for a log
 */
export async function getFoodEntries(logId: string): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('log_id', logId)
    .order('logged_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch food entries: ${error.message}`)
  return (data || []) as FoodEntry[]
}

/**
 * Get all food entries for a date range (using daily_logs join)
 */
export async function getFoodEntriesByDateRange(startDate: string, endDate: string): Promise<(FoodEntry & { date?: string })[]> {
  const { data, error } = await supabase
    .from('food_entries')
    .select('*, daily_logs!inner(date)')
    .gte('daily_logs.date', startDate)
    .lte('daily_logs.date', endDate)
    .order('logged_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch food entries: ${error.message}`)
  // Flatten the joined data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    ...row,
    date: row.daily_logs?.date,
  })) as (FoodEntry & { date: string })[]
}

/**
 * Add a food entry
 */
export async function addFoodEntry(input: {
  log_id: string
  meal_type: MealType
  food_items: string
  flagged_triggers: string[]
}): Promise<FoodEntry> {
  const { data, error } = await supabase
    .from('food_entries')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`Failed to add food entry: ${error.message}`)
  return data as FoodEntry
}

/**
 * Delete a food entry
 */
export async function deleteFoodEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete food entry: ${error.message}`)
}
