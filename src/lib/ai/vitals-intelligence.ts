/**
 * Positional Vitals Intelligence
 *
 * Persists and analyzes orthostatic vital signs for POTS patients.
 * Calculates HR deltas, detects trends, and produces clinical-grade reports.
 *
 * Key metrics:
 * - Orthostatic HR delta (standing - supine)
 * - BP response to standing
 * - HR recovery pattern over 10 minutes
 * - Trend over time (is POTS improving or worsening?)
 */

import { createServiceClient } from '@/lib/supabase'
import { classifyOrthostatic, classifyBP, detectMultiVitalOutlier } from '../api/vitals-classification'

// ── Types ──────────────────────────────────────────────────────────

export interface OrthostaticResult {
  date: string
  supineHR: number
  standingHR: number
  hrDelta: number
  meetsPOTSThreshold: boolean
  classification: string
  supineBP: { systolic: number; diastolic: number } | null
  standingBP: { systolic: number; diastolic: number } | null
  bpDelta: { systolic: number; diastolic: number } | null
}

export interface VitalsIntelligence {
  latestOrthostatic: OrthostaticResult | null
  thirtyDayTrend: {
    avgDelta: number | null
    deltaDirection: 'improving' | 'stable' | 'worsening' | 'insufficient'
    meetsPOTSCount: number
    totalTests: number
  }
  todayOutlier: {
    isOutlier: boolean
    deviatingMetrics: string[]
    severity: string
  } | null
  recommendations: string[]
}

// ── Core Functions ─────────────────────────────────────────────────

/**
 * Save an orthostatic test result and calculate deltas.
 */
export async function saveOrthostaticResult(
  date: string,
  supineHR: number,
  standingHR: number,
  supineBP?: { systolic: number; diastolic: number },
  standingBP?: { systolic: number; diastolic: number },
): Promise<OrthostaticResult> {
  const sb = createServiceClient()
  const hrDelta = standingHR - supineHR
  const orthoClass = classifyOrthostatic(hrDelta)

  // Save individual readings
  const readings = [
    { testName: 'HR (supine)', value: supineHR, unit: 'bpm', category: 'Orthostatic' },
    { testName: 'HR (standing)', value: standingHR, unit: 'bpm', category: 'Orthostatic' },
    { testName: 'Orthostatic HR Delta', value: hrDelta, unit: 'bpm', category: 'Orthostatic',
      flag: orthoClass.meetsPOTS ? 'high' : 'normal' as string,
      refLow: 0, refHigh: 30 },
  ]

  if (supineBP) {
    readings.push({ testName: 'BP Systolic (supine)', value: supineBP.systolic, unit: 'mmHg', category: 'Orthostatic' })
    readings.push({ testName: 'BP Diastolic (supine)', value: supineBP.diastolic, unit: 'mmHg', category: 'Orthostatic' })
  }
  if (standingBP) {
    readings.push({ testName: 'BP Systolic (standing)', value: standingBP.systolic, unit: 'mmHg', category: 'Orthostatic' })
    readings.push({ testName: 'BP Diastolic (standing)', value: standingBP.diastolic, unit: 'mmHg', category: 'Orthostatic' })
  }

  for (const r of readings) {
    await sb.from('lab_results').upsert({
      date,
      test_name: r.testName,
      value: r.value,
      unit: r.unit,
      category: r.category,
      flag: (r as { flag?: string }).flag ?? 'normal',
      reference_range_low: (r as { refLow?: number }).refLow ?? null,
      reference_range_high: (r as { refHigh?: number }).refHigh ?? null,
      source_document_id: `orthostatic_${date}`,
    }, { onConflict: 'date,test_name' })
  }

  const bpDelta = supineBP && standingBP ? {
    systolic: standingBP.systolic - supineBP.systolic,
    diastolic: standingBP.diastolic - supineBP.diastolic,
  } : null

  return {
    date,
    supineHR,
    standingHR,
    hrDelta,
    meetsPOTSThreshold: orthoClass.meetsPOTS,
    classification: orthoClass.label,
    supineBP: supineBP ?? null,
    standingBP: standingBP ?? null,
    bpDelta,
  }
}

/**
 * Get comprehensive vitals intelligence for the dashboard.
 */
export async function getVitalsIntelligence(): Promise<VitalsIntelligence> {
  const sb = createServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  // Get orthostatic delta history
  const { data: deltaHistory } = await sb
    .from('lab_results')
    .select('date, value')
    .eq('test_name', 'Orthostatic HR Delta')
    .gte('date', thirtyDaysAgo)
    .order('date')

  const deltas = (deltaHistory ?? []).map(d => ({
    date: d.date as string,
    value: d.value as number,
  }))

  // Latest result
  let latestOrthostatic: OrthostaticResult | null = null
  if (deltas.length > 0) {
    const latest = deltas[deltas.length - 1]
    const { data: supineHR } = await sb.from('lab_results')
      .select('value').eq('date', latest.date).eq('test_name', 'HR (supine)').maybeSingle()
    const { data: standingHR } = await sb.from('lab_results')
      .select('value').eq('date', latest.date).eq('test_name', 'HR (standing)').maybeSingle()

    if (supineHR?.value && standingHR?.value) {
      const orthoClass = classifyOrthostatic(latest.value)
      latestOrthostatic = {
        date: latest.date,
        supineHR: supineHR.value as number,
        standingHR: standingHR.value as number,
        hrDelta: latest.value,
        meetsPOTSThreshold: orthoClass.meetsPOTS,
        classification: orthoClass.label,
        supineBP: null,
        standingBP: null,
        bpDelta: null,
      }
    }
  }

  // 30-day trend
  const avgDelta = deltas.length > 0
    ? Math.round(deltas.reduce((s, d) => s + d.value, 0) / deltas.length * 10) / 10
    : null

  let deltaDirection: 'improving' | 'stable' | 'worsening' | 'insufficient' = 'insufficient'
  if (deltas.length >= 6) {
    const firstHalf = deltas.slice(0, Math.floor(deltas.length / 2))
    const secondHalf = deltas.slice(Math.floor(deltas.length / 2))
    const avgFirst = firstHalf.reduce((s, d) => s + d.value, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, d) => s + d.value, 0) / secondHalf.length
    const change = avgSecond - avgFirst
    if (change <= -3) deltaDirection = 'improving'
    else if (change >= 3) deltaDirection = 'worsening'
    else deltaDirection = 'stable'
  }

  // Today's outlier check
  const { data: todayOura } = await sb.from('oura_daily')
    .select('resting_hr, hrv_avg, body_temp_deviation, spo2_avg')
    .eq('date', today).maybeSingle()

  // Get 30-day baselines
  const { data: baselineData } = await sb.from('oura_daily')
    .select('resting_hr, hrv_avg, body_temp_deviation, spo2_avg')
    .gte('date', thirtyDaysAgo).order('date')

  let todayOutlier = null
  if (todayOura && baselineData && baselineData.length >= 7) {
    const computeStats = (values: (number | null)[]) => {
      const valid = values.filter((v): v is number => v !== null)
      if (valid.length < 3) return undefined
      const mean = valid.reduce((a, b) => a + b, 0) / valid.length
      const std = Math.sqrt(valid.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / valid.length)
      return { mean, std }
    }

    const outlier = detectMultiVitalOutlier(
      {
        hr: todayOura.resting_hr as number | null,
        hrv: todayOura.hrv_avg as number | null,
        temp: todayOura.body_temp_deviation as number | null,
        spo2: todayOura.spo2_avg as number | null,
      },
      {
        hr: computeStats(baselineData.map(d => d.resting_hr as number | null)),
        hrv: computeStats(baselineData.map(d => d.hrv_avg as number | null)),
        temp: computeStats(baselineData.map(d => d.body_temp_deviation as number | null)),
        spo2: computeStats(baselineData.map(d => d.spo2_avg as number | null)),
      },
    )

    todayOutlier = outlier
  }

  // Recommendations
  const recommendations: string[] = []
  if (deltas.length < 3) {
    recommendations.push('Log orthostatic vitals (supine then standing HR) at least 3 times per week for trend analysis.')
  }
  if (deltaDirection === 'worsening') {
    recommendations.push('Your orthostatic HR delta is trending upward. Consider discussing with your cardiologist.')
  }
  if (deltaDirection === 'improving') {
    recommendations.push('Your orthostatic response is improving. Keep up your current management strategy.')
  }
  if (todayOutlier?.isOutlier) {
    recommendations.push(`Multiple vitals are outside your typical range today (${todayOutlier.deviatingMetrics.join(', ')}). Take it easy and monitor symptoms.`)
  }

  return {
    latestOrthostatic,
    thirtyDayTrend: {
      avgDelta,
      deltaDirection,
      meetsPOTSCount: deltas.filter(d => d.value >= 30).length,
      totalTests: deltas.length,
    },
    todayOutlier,
    recommendations,
  }
}
