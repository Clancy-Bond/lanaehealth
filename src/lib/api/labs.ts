import { supabase } from '@/lib/supabase'
import type { LabResult } from '@/lib/types'

/**
 * Get all lab results, optionally filtered by date range
 */
export async function getLabResults(startDate?: string, endDate?: string): Promise<LabResult[]> {
  let query = supabase
    .from('lab_results')
    .select('*')
    .order('date', { ascending: false })

  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch lab results: ${error.message}`)
  return (data || []) as LabResult[]
}

/**
 * Add a lab result
 */
export async function addLabResult(input: Omit<LabResult, 'id' | 'created_at'>): Promise<LabResult> {
  const { data, error } = await supabase
    .from('lab_results')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`Failed to add lab result: ${error.message}`)
  return data as LabResult
}

/**
 * Delete a lab result
 */
export async function deleteLabResult(id: string): Promise<void> {
  const { error } = await supabase
    .from('lab_results')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete lab result: ${error.message}`)
}

/**
 * Get unique test names for trend chart selector
 */
export async function getUniqueTestNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('lab_results')
    .select('test_name')
    .order('test_name')

  if (error) throw new Error(`Failed to fetch test names: ${error.message}`)
  const unique = [...new Set((data || []).map((r: { test_name: string }) => r.test_name))]
  return unique
}

/**
 * Get trend data for a specific test
 */
export async function getLabTrend(testName: string): Promise<LabResult[]> {
  const { data, error } = await supabase
    .from('lab_results')
    .select('*')
    .eq('test_name', testName)
    .order('date', { ascending: true })

  if (error) throw new Error(`Failed to fetch lab trend: ${error.message}`)
  return (data || []) as LabResult[]
}

/**
 * Batch insert lab results from CSV
 */
export async function batchInsertLabResults(
  results: Omit<LabResult, 'id' | 'created_at'>[]
): Promise<number> {
  if (results.length === 0) return 0

  const { error } = await supabase
    .from('lab_results')
    .insert(results)

  if (error) throw new Error(`Failed to batch insert: ${error.message}`)
  return results.length
}
