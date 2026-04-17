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
  /**
   * 'direct': delta was stored explicitly as `Orthostatic HR Delta`.
   * 'computed': delta was derived in code by pairing `Supine pulse rate`
   *             and `Standing pulse rate` rows on the same date.
   */
  source: 'direct' | 'computed'
}

export interface VitalsIntelligence {
  latestOrthostatic: OrthostaticResult | null
  thirtyDayTrend: {
    avgDelta: number | null
    deltaDirection: 'improving' | 'stable' | 'worsening' | 'insufficient'
    meetsPOTSCount: number
    totalTests: number
    /**
     * How many of the tests in totalTests came from a direct delta row
     * vs computed from a supine+standing pair.
     */
    directCount: number
    computedCount: number
  }
  todayOutlier: {
    isOutlier: boolean
    deviatingMetrics: string[]
    severity: string
  } | null
  recommendations: string[]
}

// Canonical test names we pair together. Live myAH imports use
// `Supine pulse rate` (lowercase p, r) and `Standing Pulse Rate` (capital
// P, R). The app's own POST flow writes `HR (supine)` / `HR (standing)`.
// We accept either casing via case-insensitive grouping below.
const SUPINE_PULSE_NAMES = ['Supine pulse rate', 'HR (supine)']
const STANDING_PULSE_NAMES = ['Standing pulse rate', 'Standing Pulse Rate', 'HR (standing)']
const DELTA_NAME = 'Orthostatic HR Delta'

type PulseRow = { date: string; value: number; test_name: string }

/**
 * Pair same-day supine + standing pulse rows into synthetic delta rows.
 * If both exist on a date, returns `{ date, delta, supine, standing }`.
 * Dates with only one of the two are dropped (partial data).
 */
export function computePulseDeltasFromRows(rows: PulseRow[]): Array<{
  date: string
  delta: number
  supine: number
  standing: number
}> {
  const byDate = new Map<string, { supine?: number; standing?: number }>()
  for (const r of rows) {
    const name = r.test_name.toLowerCase()
    const entry = byDate.get(r.date) ?? {}
    if (name.includes('supine')) entry.supine = r.value
    else if (name.includes('standing')) entry.standing = r.value
    byDate.set(r.date, entry)
  }
  const pairs: Array<{ date: string; delta: number; supine: number; standing: number }> = []
  for (const [date, entry] of byDate) {
    if (typeof entry.supine === 'number' && typeof entry.standing === 'number') {
      pairs.push({ date, delta: entry.standing - entry.supine, supine: entry.supine, standing: entry.standing })
    }
  }
  return pairs.sort((a, b) => a.date.localeCompare(b.date))
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
    source: 'direct',
  }
}

/**
 * Get comprehensive vitals intelligence for the dashboard.
 *
 * Delta source priority per date:
 *   1. `Orthostatic HR Delta` row (written by the in-app POST flow)
 *   2. Else: pair `Supine pulse rate` + `Standing pulse rate` and compute
 *      `standing - supine` (covers myAH portal imports).
 */
export async function getVitalsIntelligence(): Promise<VitalsIntelligence> {
  const sb = createServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  // Pull any row that could contribute to an orthostatic delta in the window.
  // We union directly-reported deltas with raw supine/standing pulse rows so
  // myAH-style imports (which never write `Orthostatic HR Delta`) are counted.
  const orthoNames = [DELTA_NAME, ...SUPINE_PULSE_NAMES, ...STANDING_PULSE_NAMES]
  const { data: orthoRows } = await sb
    .from('lab_results')
    .select('date, value, test_name')
    .in('test_name', orthoNames)
    .gte('date', thirtyDaysAgo)
    .order('date')

  const rows = (orthoRows ?? []) as Array<{ date: string; value: number; test_name: string }>

  // Direct deltas keyed by date
  const directDeltaByDate = new Map<string, number>()
  const pulseRowsForPairing: PulseRow[] = []
  for (const r of rows) {
    if (r.test_name === DELTA_NAME) {
      directDeltaByDate.set(r.date, r.value)
    } else {
      pulseRowsForPairing.push(r)
    }
  }

  // Computed pairs from supine + standing rows (same-day pairing).
  const computedPairs = computePulseDeltasFromRows(pulseRowsForPairing)
  const computedByDate = new Map(computedPairs.map(p => [p.date, p]))

  // Union: every date that has either a direct delta or a computable pair.
  const allDates = new Set<string>([
    ...directDeltaByDate.keys(),
    ...computedByDate.keys(),
  ])
  const deltas = Array.from(allDates)
    .sort()
    .map(date => {
      if (directDeltaByDate.has(date)) {
        return { date, value: directDeltaByDate.get(date) as number, source: 'direct' as const }
      }
      const pair = computedByDate.get(date) as { date: string; delta: number; supine: number; standing: number }
      return { date, value: pair.delta, source: 'computed' as const }
    })

  // Latest result -- look up supine/standing HR for the most recent date.
  let latestOrthostatic: OrthostaticResult | null = null
  if (deltas.length > 0) {
    const latest = deltas[deltas.length - 1]
    // Prefer in-memory pair when the delta was computed, so we avoid a second round-trip.
    const computedPair = computedByDate.get(latest.date)
    let supineHR: number | null = computedPair?.supine ?? null
    let standingHR: number | null = computedPair?.standing ?? null

    if (supineHR === null || standingHR === null) {
      // Direct-delta path: fetch either app-written or myAH-written rows.
      const { data: supineRow } = await sb.from('lab_results')
        .select('value, test_name').eq('date', latest.date).in('test_name', SUPINE_PULSE_NAMES).limit(1).maybeSingle()
      const { data: standingRow } = await sb.from('lab_results')
        .select('value, test_name').eq('date', latest.date).in('test_name', STANDING_PULSE_NAMES).limit(1).maybeSingle()
      supineHR = (supineRow?.value as number | undefined) ?? null
      standingHR = (standingRow?.value as number | undefined) ?? null
    }

    if (supineHR !== null && standingHR !== null) {
      const orthoClass = classifyOrthostatic(latest.value)
      latestOrthostatic = {
        date: latest.date,
        supineHR,
        standingHR,
        hrDelta: latest.value,
        meetsPOTSThreshold: orthoClass.meetsPOTS,
        classification: orthoClass.label,
        supineBP: null,
        standingBP: null,
        bpDelta: null,
        source: latest.source,
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
      directCount: deltas.filter(d => d.source === 'direct').length,
      computedCount: deltas.filter(d => d.source === 'computed').length,
    },
    todayOutlier,
    recommendations,
  }
}
