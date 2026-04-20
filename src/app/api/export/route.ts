import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateFullCsv } from '@/lib/reports/csv-export'
import { format, subDays } from 'date-fns'
import { requireAuth } from '@/lib/auth/require-user'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * GET /api/export?format=json|csv&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Comprehensive export of ALL health data. Requires a valid session.
 * Rate-limited to 5 requests per hour per client. Every call is logged
 * to security_audit_log.
 */
export async function GET(req: NextRequest) {
  const audit = auditMetaFromRequest(req)

  const auth = requireAuth(req)
  if (!auth.ok) {
    await recordAuditEvent({
      endpoint: 'GET /api/export',
      actor: audit.ip ?? 'unauthenticated',
      outcome: 'deny',
      status: 401,
      reason: 'auth',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return auth.response
  }

  const limit = checkRateLimit({
    scope: 'export:any',
    max: 5,
    windowMs: 60 * 60 * 1000,
    key: clientIdFromRequest(req),
  })
  if (!limit.ok) {
    await recordAuditEvent({
      endpoint: 'GET /api/export',
      actor: `via:`,
      outcome: 'deny',
      status: 429,
      reason: 'rate-limit',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json(
      { error: 'Too many export requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    )
  }

  const { searchParams } = req.nextUrl
  const fmt = searchParams.get('format') || 'json'

  if (fmt === 'csv') {
    try {
      const endDate = searchParams.get('end') || format(new Date(), 'yyyy-MM-dd')
      const startDate = searchParams.get('start') || format(subDays(new Date(), 90), 'yyyy-MM-dd')
      const csv = await generateFullCsv({ startDate, endDate })
      await recordAuditEvent({
        endpoint: 'GET /api/export',
        actor: `via:`,
        outcome: 'allow',
        status: 200,
        bytes: Buffer.byteLength(csv, 'utf8'),
        ip: audit.ip,
        userAgent: audit.userAgent,
        meta: { format: 'csv', start: startDate, end: endDate },
      })
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="lanaehealth-export-${startDate}-to-${endDate}.csv"`,
        },
      })
    } catch (err) {
      console.error('[export] csv path failed:', err)
      await recordAuditEvent({
        endpoint: 'GET /api/export',
        actor: `via:`,
        outcome: 'error',
        status: 500,
        reason: 'csv-generation',
        ip: audit.ip,
        userAgent: audit.userAgent,
      })
      return NextResponse.json({ error: 'CSV export failed' }, { status: 500 })
    }
  }

  return jsonExport(`via:`, audit)
}

async function jsonExport(
  actor: string,
  audit: { ip: string | null; userAgent: string | null },
) {
  try {
    const supabase = createServiceClient()

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
        // Log internally; don't surface table-level schema info to the
        // client. The error field on the response lists only table names.
        console.error(`[export] ${table} query failed:`, result.error.message)
        errors.push(table)
      }
    }

    let patientName = 'Unknown'
    if (healthProfile.data) {
      const personalSection = healthProfile.data.find(
        (row: { section: string; content: string }) => row.section === 'personal',
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

    const body = JSON.stringify(exportData)
    await recordAuditEvent({
      endpoint: 'GET /api/export',
      actor,
      outcome: 'allow',
      status: 200,
      bytes: Buffer.byteLength(body, 'utf8'),
      ip: audit.ip,
      userAgent: audit.userAgent,
      meta: { format: 'json', total_records: exportData.total_records },
    })
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[export] json path failed:', err)
    await recordAuditEvent({
      endpoint: 'GET /api/export',
      actor,
      outcome: 'error',
      status: 500,
      reason: 'json-generation',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
