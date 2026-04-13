import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const maxDuration = 120

/**
 * GET /api/export
 *
 * Fetches all data from major tables and returns as JSON for backup/portability.
 */
export async function GET() {
  try {
    const supabase = createServiceClient()

    // Fetch from all major tables in parallel
    const [
      dailyLogs,
      ouraDailyData,
      ncImported,
      cycleEntries,
      foodEntries,
      labResults,
      appointments,
      symptoms,
      painPoints,
    ] = await Promise.all([
      supabase.from('daily_logs').select('*').order('date', { ascending: false }),
      supabase.from('oura_daily').select('*').order('date', { ascending: false }),
      supabase.from('nc_imported').select('*').order('date', { ascending: false }),
      supabase.from('cycle_entries').select('*').order('date', { ascending: false }),
      supabase.from('food_entries').select('*').order('logged_at', { ascending: false }),
      supabase.from('lab_results').select('*').order('date', { ascending: false }),
      supabase.from('appointments').select('*').order('date', { ascending: false }),
      supabase.from('symptoms').select('*').order('created_at', { ascending: false }),
      supabase.from('pain_points').select('*').order('created_at', { ascending: false }),
    ])

    // Check for any table-level errors
    const errors: string[] = []
    if (dailyLogs.error) errors.push(`daily_logs: ${dailyLogs.error.message}`)
    if (ouraDailyData.error) errors.push(`oura_daily: ${ouraDailyData.error.message}`)
    if (ncImported.error) errors.push(`nc_imported: ${ncImported.error.message}`)
    if (cycleEntries.error) errors.push(`cycle_entries: ${cycleEntries.error.message}`)
    if (foodEntries.error) errors.push(`food_entries: ${foodEntries.error.message}`)
    if (labResults.error) errors.push(`lab_results: ${labResults.error.message}`)
    if (appointments.error) errors.push(`appointments: ${appointments.error.message}`)
    if (symptoms.error) errors.push(`symptoms: ${symptoms.error.message}`)
    if (painPoints.error) errors.push(`pain_points: ${painPoints.error.message}`)

    const exportData = {
      exported_at: new Date().toISOString(),
      app: 'LanaeHealth',
      version: '1.0.0',
      tables: {
        daily_logs: dailyLogs.data || [],
        oura_daily: ouraDailyData.data || [],
        nc_imported: ncImported.data || [],
        cycle_entries: cycleEntries.data || [],
        food_entries: foodEntries.data || [],
        lab_results: labResults.data || [],
        appointments: appointments.data || [],
        symptoms: symptoms.data || [],
        pain_points: painPoints.data || [],
      },
      record_counts: {
        daily_logs: dailyLogs.data?.length || 0,
        oura_daily: ouraDailyData.data?.length || 0,
        nc_imported: ncImported.data?.length || 0,
        cycle_entries: cycleEntries.data?.length || 0,
        food_entries: foodEntries.data?.length || 0,
        lab_results: labResults.data?.length || 0,
        appointments: appointments.data?.length || 0,
        symptoms: symptoms.data?.length || 0,
        pain_points: painPoints.data?.length || 0,
      },
      errors: errors.length > 0 ? errors : undefined,
    }

    return NextResponse.json(exportData)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
