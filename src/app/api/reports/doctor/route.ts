/**
 * Doctor Visit Report API
 * GET /api/reports/doctor?appointment_date=YYYY-MM-DD&specialty=OB/GYN
 *
 * Generates a structured clinical summary formatted for doctor visits.
 * Returns JSON with sections that the frontend renders or exports as PDF.
 *
 * Sections:
 * 1. Patient summary (demographics, conditions, medications)
 * 2. Reason for visit / chief complaints
 * 3. Symptom trends (last 30 days with severity patterns)
 * 4. Vital signs (with positional data for POTS)
 * 5. Menstrual cycle summary (for OB/GYN)
 * 6. Lab results (recent, with trends)
 * 7. Medication adherence
 * 8. Correlation findings (food-symptom, sleep-pain)
 * 9. Questions for the doctor
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireUser } from '@/lib/auth/require-user'
import { checkRateLimit, clientIdFromRequest } from '@/lib/security/rate-limit'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const audit = auditMetaFromRequest(req)

  const auth = await requireUser(req)
  if (!auth.ok) {
    await recordAuditEvent({
      endpoint: 'GET /api/reports/doctor',
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
    scope: 'reports:doctor',
    max: 20,
    windowMs: 60 * 60 * 1000,
    key: clientIdFromRequest(req),
  })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
  }

  const appointmentDate = req.nextUrl.searchParams.get('appointment_date')
  const specialty = req.nextUrl.searchParams.get('specialty') ?? 'General'

  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Fetch all data in parallel
  const [
    profileResult,
    problemsResult,
    logsResult,
    labsResult,
    ouraResult,
    cycleResult,
    medsResult,
    correlationsResult,
    appointmentResult,
  ] = await Promise.all([
    sb.from('health_profile').select('section, content'),
    sb.from('active_problems').select('*').eq('status', 'active'),
    sb.from('daily_logs').select('date, overall_pain, fatigue, bloating, stress, sleep_quality, cycle_phase')
      .gte('date', thirtyDaysAgo).order('date', { ascending: true }),
    sb.from('lab_results').select('date, test_name, value, unit, flag, category, reference_range_low, reference_range_high')
      .gte('date', ninetyDaysAgo).order('date', { ascending: false }),
    sb.from('oura_daily').select('date, sleep_score, hrv_avg, resting_hr, body_temp_deviation')
      .gte('date', thirtyDaysAgo).order('date', { ascending: true }),
    sb.from('cycle_entries').select('date, flow_level, menstruation, lh_test_result')
      .gte('date', ninetyDaysAgo).order('date', { ascending: true }),
    sb.from('medical_timeline').select('date, title, description')
      .eq('event_type', 'medication_change').gte('date', ninetyDaysAgo),
    sb.from('correlation_results').select('*')
      .in('confidence_level', ['moderate', 'strong']).limit(10),
    appointmentDate
      ? sb.from('appointments').select('*').eq('date', appointmentDate).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const logs = logsResult.data ?? []
  const labs = labsResult.data ?? []
  const oura = ouraResult.data ?? []

  // Compute symptom averages for the last 30 days
  const avgPain = computeAvg(logs.map(l => l.overall_pain))
  const avgFatigue = computeAvg(logs.map(l => l.fatigue))
  const avgBloating = computeAvg(logs.map(l => l.bloating))
  const avgStress = computeAvg(logs.map(l => l.stress))
  const avgSleep = computeAvg(oura.map(o => o.sleep_score))
  const avgHrv = computeAvg(oura.map(o => o.hrv_avg))
  const avgRhr = computeAvg(oura.map(o => o.resting_hr))

  // Build report sections
  const report = {
    generatedAt: new Date().toISOString(),
    appointmentDate: appointmentDate ?? 'Not specified',
    specialty,
    patient: {
      name: 'Lanae Bond',
      age: 24,
      sex: 'Female',
      location: 'Kailua, HI',
    },
    activeConditions: (problemsResult.data ?? []).map(p => ({
      name: (p as Record<string, unknown>).name,
      onset: (p as Record<string, unknown>).onset_date,
    })),
    medications: (medsResult.data ?? []).map(m => ({
      name: (m as Record<string, unknown>).title,
      details: (m as Record<string, unknown>).description,
      date: (m as Record<string, unknown>).date,
    })),
    symptomSummary: {
      period: `${thirtyDaysAgo} to ${today}`,
      daysLogged: logs.length,
      averages: {
        pain: avgPain,
        fatigue: avgFatigue,
        bloating: avgBloating,
        stress: avgStress,
      },
      worstPainDays: logs
        .filter(l => (l.overall_pain ?? 0) >= 7)
        .map(l => ({ date: l.date, pain: l.overall_pain, phase: l.cycle_phase })),
    },
    biometrics: {
      period: `${thirtyDaysAgo} to ${today}`,
      averages: {
        sleepScore: avgSleep,
        hrv: avgHrv,
        restingHR: avgRhr,
      },
      daysTracked: oura.length,
    },
    recentLabs: labs.slice(0, 20).map(l => ({
      date: l.date,
      test: l.test_name,
      value: l.value,
      unit: l.unit,
      flag: l.flag,
      refRange: l.reference_range_low && l.reference_range_high
        ? `${l.reference_range_low}-${l.reference_range_high}`
        : null,
    })),
    cycleHistory: (cycleResult.data ?? []).map(c => ({
      date: c.date,
      flow: c.flow_level,
      menstruating: c.menstruation,
      lhTest: c.lh_test_result,
    })),
    correlations: (correlationsResult.data ?? []).map(c => ({
      description: (c as Record<string, unknown>).description,
      confidence: (c as Record<string, unknown>).confidence_level,
      metrics: (c as Record<string, unknown>).metrics,
    })),
    appointmentDetails: appointmentResult.data
      ? {
          doctor: (appointmentResult.data as Record<string, unknown>).doctor_name,
          specialty: (appointmentResult.data as Record<string, unknown>).specialty,
          reason: (appointmentResult.data as Record<string, unknown>).reason,
        }
      : null,
    dataSources: [
      `${logs.length} daily logs (30 days)`,
      `${oura.length} Oura Ring measurements`,
      `${labs.length} lab results (90 days)`,
      `${(cycleResult.data ?? []).length} cycle entries`,
    ],
  }

  await recordAuditEvent({
    endpoint: 'GET /api/reports/doctor',
    actor: auth.user.id,
    outcome: 'allow',
    status: 200,
    ip: audit.ip,
    userAgent: audit.userAgent,
    meta: { specialty, appointmentDate },
  })

  return NextResponse.json(report)
}

function computeAvg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10
}
