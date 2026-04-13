// Flare Prediction Engine
// Uses statistical pattern detection + Claude reasoning to predict symptom flares
// No ML libraries needed -- pure statistical analysis

import type { DailyLog, OuraDaily, CycleEntry, Symptom, FlarePrediction, CyclePhase } from '@/lib/types'

interface AlignedDay {
  date: string
  pain: number | null
  fatigue: number | null
  cyclePhase: CyclePhase | null
  symptomCount: number
  severeSymptomsCount: number
  isFlare: boolean
  hrv: number | null
  restingHr: number | null
  tempDeviation: number | null
  sleepScore: number | null
  spo2: number | null
  readinessScore: number | null
}

interface PrecursorPattern {
  metric: string
  lagDays: number
  correlationStrength: number // -1 to 1
  direction: 'drop' | 'spike' | 'deviation'
  description: string
}

/**
 * Align daily logs with biometric data and identify flare patterns.
 */
export function alignData(
  dailyLogs: DailyLog[],
  ouraData: OuraDaily[],
  symptoms: Symptom[],
  cycleEntries: CycleEntry[]
): AlignedDay[] {
  const ouraMap = new Map((ouraData || []).map(o => [o.date, o]))
  const cycleMap = new Map((cycleEntries || []).map(c => [c.date, c]))

  return (dailyLogs || []).map(log => {
    const oura = ouraMap.get(log.date)
    const logSymptoms = symptoms.filter(s => s.log_id === log.id)
    const severeCount = logSymptoms.filter(s => s.severity === 'severe').length

    return {
      date: log.date,
      pain: log.overall_pain,
      fatigue: log.fatigue,
      cyclePhase: (log.cycle_phase || (cycleMap.get(log.date)?.flow_level ? 'menstrual' : null)) as CyclePhase | null,
      symptomCount: logSymptoms.length,
      severeSymptomsCount: severeCount,
      isFlare: (log.overall_pain !== null && log.overall_pain >= 7) || severeCount >= 3,
      hrv: oura?.hrv_avg ?? null,
      restingHr: oura?.resting_hr ?? null,
      tempDeviation: oura?.body_temp_deviation ?? null,
      sleepScore: oura?.sleep_score ?? null,
      spo2: oura?.spo2_avg ?? null,
      readinessScore: oura?.readiness_score ?? null,
    }
  }).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Identify biometric precursors that occur 1-3 days before flares.
 */
export function findPrecursorPatterns(aligned: AlignedDay[]): PrecursorPattern[] {
  const patterns: PrecursorPattern[] = []
  const metrics: { key: keyof AlignedDay; label: string }[] = [
    { key: 'hrv', label: 'HRV' },
    { key: 'restingHr', label: 'Resting Heart Rate' },
    { key: 'tempDeviation', label: 'Temperature Deviation' },
    { key: 'sleepScore', label: 'Sleep Score' },
    { key: 'readinessScore', label: 'Readiness Score' },
    { key: 'spo2', label: 'SpO2' },
  ]

  for (const { key, label } of metrics) {
    for (const lagDays of [1, 2, 3]) {
      const correlation = computeFlareCorrelation(aligned, key, lagDays)
      if (correlation !== null && Math.abs(correlation) > 0.15) {
        const direction = correlation < 0 ? 'drop' : 'spike'
        patterns.push({
          metric: label,
          lagDays,
          correlationStrength: correlation,
          direction: key === 'tempDeviation' ? 'deviation' : direction,
          description: `${label} ${direction}s ${lagDays} day${lagDays > 1 ? 's' : ''} before flares (r=${correlation.toFixed(2)})`,
        })
      }
    }
  }

  // Sort by absolute correlation strength
  return patterns.sort((a, b) => Math.abs(b.correlationStrength) - Math.abs(a.correlationStrength))
}

/**
 * Compute Pearson correlation between a biometric metric (at lag) and flare occurrence.
 */
function computeFlareCorrelation(
  aligned: AlignedDay[],
  metricKey: keyof AlignedDay,
  lagDays: number
): number | null {
  const pairs: { x: number; y: number }[] = []

  for (let i = lagDays; i < aligned.length; i++) {
    const metricValue = aligned[i - lagDays][metricKey]
    if (typeof metricValue !== 'number' || metricValue === null) continue

    pairs.push({
      x: metricValue,
      y: aligned[i].isFlare ? 1 : 0,
    })
  }

  if (pairs.length < 10) return null

  return pearsonCorrelation(pairs.map(p => p.x), pairs.map(p => p.y))
}

/**
 * Pearson correlation coefficient.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0) return 0

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let numerator = 0
  let denomX = 0
  let denomY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    numerator += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denom = Math.sqrt(denomX * denomY)
  return denom === 0 ? 0 : Math.round((numerator / denom) * 100) / 100
}

/**
 * Predict near-term flare risk based on current biometric trends and identified patterns.
 */
export function predictFlareRisk(
  aligned: AlignedDay[],
  patterns: PrecursorPattern[]
): FlarePrediction | null {
  if (aligned.length < 7 || patterns.length === 0) return null

  const recent = aligned.slice(-3) // Last 3 days
  const baseline = aligned.slice(-30, -3) // 30-day baseline (excluding last 3)

  if (baseline.length < 7) return null

  // Calculate baseline averages
  const baselineAvg: Record<string, number> = {}
  const metricKeys = ['hrv', 'restingHr', 'tempDeviation', 'sleepScore', 'readinessScore', 'spo2'] as const
  for (const key of metricKeys) {
    const values = baseline.map(d => d[key]).filter((v): v is number => v !== null)
    if (values.length > 0) {
      baselineAvg[key] = values.reduce((a, b) => a + b, 0) / values.length
    }
  }

  // Check each precursor signal against recent data
  const signals: FlarePrediction['precursorSignals'] = []
  let riskScore = 0

  for (const pattern of patterns.slice(0, 5)) { // Top 5 patterns
    const metricKeyMap: Record<string, string> = {
      'HRV': 'hrv',
      'Resting Heart Rate': 'restingHr',
      'Temperature Deviation': 'tempDeviation',
      'Sleep Score': 'sleepScore',
      'Readiness Score': 'readinessScore',
      'SpO2': 'spo2',
    }

    const key = metricKeyMap[pattern.metric]
    if (!key || !(key in baselineAvg)) continue

    // Get the value at the matching lag
    const lagIndex = Math.max(0, recent.length - pattern.lagDays)
    const recentValue = recent[lagIndex]?.[key as keyof AlignedDay]
    if (typeof recentValue !== 'number') continue

    const baseValue = baselineAvg[key]
    const deviation = ((recentValue - baseValue) / Math.abs(baseValue || 1)) * 100

    signals.push({
      metric: pattern.metric,
      currentValue: recentValue,
      baselineValue: Math.round(baseValue * 10) / 10,
      deviationPercent: Math.round(deviation * 10) / 10,
    })

    // Contribute to risk score based on pattern direction matching
    const isDeviating = (pattern.direction === 'drop' && deviation < -5)
      || (pattern.direction === 'spike' && deviation > 5)
      || (pattern.direction === 'deviation' && Math.abs(deviation) > 5)

    if (isDeviating) {
      riskScore += Math.abs(pattern.correlationStrength) * 0.3
    }
  }

  // Normalize risk to 0-1
  const probability = Math.min(1, Math.max(0, riskScore))

  // Determine current cycle phase
  const lastDay = aligned[aligned.length - 1]
  const cyclePhase = lastDay?.cyclePhase || null

  return {
    date: new Date().toISOString().split('T')[0],
    probability,
    precursorSignals: signals,
    cyclePhase,
    riskLevel: probability < 0.3 ? 'low' : probability < 0.6 ? 'moderate' : 'high',
  }
}

/**
 * Get phase-specific flare statistics.
 */
export function getPhaseFlareStats(aligned: AlignedDay[]): Record<string, { flareRate: number; avgPain: number; totalDays: number }> {
  const stats: Record<string, { flares: number; totalPain: number; painDays: number; total: number }> = {}

  for (const day of aligned) {
    const phase = day.cyclePhase || 'unknown'
    if (!stats[phase]) stats[phase] = { flares: 0, totalPain: 0, painDays: 0, total: 0 }
    stats[phase].total++
    if (day.isFlare) stats[phase].flares++
    if (day.pain !== null) {
      stats[phase].totalPain += day.pain
      stats[phase].painDays++
    }
  }

  const result: Record<string, { flareRate: number; avgPain: number; totalDays: number }> = {}
  for (const [phase, data] of Object.entries(stats)) {
    result[phase] = {
      flareRate: data.total > 0 ? Math.round((data.flares / data.total) * 100) / 100 : 0,
      avgPain: data.painDays > 0 ? Math.round((data.totalPain / data.painDays) * 10) / 10 : 0,
      totalDays: data.total,
    }
  }

  return result
}
