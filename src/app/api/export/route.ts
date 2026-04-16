import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateFullCsv } from '@/lib/reports/csv-export'
import { format, subDays } from 'date-fns'

export const maxDuration = 120

/**
 * GET /api/export?format=json|csv&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Comprehensive export of ALL health data.
 * - format=json (default): Full backup of all tables
 * - format=csv: Daily spreadsheet with ALL days (even empty) - fixes Bearable's #1 data complaint
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const fmt = searchParams.get('format') || 'json'

  // CSV export path
  if (fmt === 'csv') {
    try {
      const endDate = searchParams.get('end') || format(new Date(), 'yyyy-MM-dd')
      const startDate = searchParams.get('start') || format(subDays(new Date(), 90), 'yyyy-MM-dd')
      const csv = await generateFullCsv({ startDate, endDate })
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="lanaehealth-export-${startDate}-to-${endDate}.csv"`,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CSV export failed'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // JSON export path (original behavior)
  return jsonExport()
}

async function jsonExport() {
  try {
    const supabase = createServiceClient()

    // Fetch from all tables in parallel
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
      healthProfile,
      medicalTimeline,
      activeProblems,
      imagingStudies,
      medicalNarrative,
      correlationResults,
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
      supabase.from('health_profile').select('*').order('section', { ascending: true }),
      supabase.from('medical_timeline').select('*').order('event_date', { ascending: false }),
      supabase.from('active_problems').select('*').order('created_at', { ascending: false }),
      supabase.from('imaging_studies').select('*').order('study_date', { ascending: false }),
      supabase.from('medical_narrative').select('*').order('section_order', { ascending: true }),
      supabase.from('correlation_results').select('*').order('created_at', { ascending: false }),
    ])

    // Check for any table-level errors
    const errors: string[] = []
    const results = {
      daily_logs: dailyLogs,
      oura_daily: ouraDailyData,
      nc_imported: ncImported,
      cycle_entries: cycleEntries,
      food_entries: foodEntries,
      lab_results: labResults,
      appointments: appointments,
      symptoms: symptoms,
      pain_points: painPoints,
      health_profile: healthProfile,
      medical_timeline: medicalTimeline,
      active_problems: activeProblems,
      imaging_studies: imagingStudies,
      medical_narrative: medicalNarrative,
      correlation_results: correlationResults,
    }

    for (const [table, result] of Object.entries(results)) {
      if (result.error) {
        errors.push(`${table}: ${result.error.message}`)
      }
    }

    // Extract patient name from health_profile personal section
    let patientName = 'Unknown'
    if (healthProfile.data) {
      const personalSection = healthProfile.data.find(
        (row: { section: string; content: string }) => row.section === 'personal'
      )
      if (personalSection) {
        try {
          const parsed = typeof personalSection.content === 'string'
            ? JSON.parse(personalSection.content)
            : personalSection.content
          if (parsed?.full_name) {
            patientName = parsed.full_name
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Build tables and record_counts objects
    const tables: Record<string, unknown[]> = {}
    const recordCounts: Record<string, number> = {}

    for (const [table, result] of Object.entries(results)) {
      tables[table] = result.data || []
      recordCounts[table] = result.data?.length || 0
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      app: 'LanaeHealth',
      version: '1.0.0',
      patient_name: patientName,
      total_records: Object.values(recordCounts).reduce((sum, n) => sum + n, 0),
      tables,
      record_counts: recordCounts,
      errors: errors.length > 0 ? errors : undefined,
    }

    return NextResponse.json(exportData)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
