// AI Analysis Engine - Data preparation for Claude prompts
// Transforms raw pipeline data into token-efficient context

import type { PipelineInput } from '@/lib/types'
import type { AnalysisContext } from './types'

/**
 * Prepare the full analysis context from pipeline input data.
 * Compresses and prioritizes data to stay within token budget.
 */
export function prepareAnalysisContext(
  input: PipelineInput,
  apiEvidence: Record<string, unknown> = {}
): AnalysisContext {
  return {
    patientSummary: preparePatientSummary(input),
    labSummary: prepareLabSummary(input),
    biometricSummary: prepareBiometricSummary(input),
    cycleSummary: prepareCycleSummary(input),
    apiEvidence,
  }
}

function preparePatientSummary(input: PipelineInput): AnalysisContext['patientSummary'] {
  const profile = input.healthProfile as Record<string, unknown>
  const personalInfo = (profile?.personal_info || {}) as Record<string, unknown>
  const diagnoses = (profile?.diagnoses || {}) as Record<string, unknown>

  // medications can be an object { completed: [...], as_needed: [...] } or an array
  const rawMeds = profile?.medications
  const medications: Record<string, unknown>[] = Array.isArray(rawMeds)
    ? rawMeds
    : rawMeds && typeof rawMeds === 'object'
      ? [
          ...((rawMeds as Record<string, unknown>).completed as Record<string, unknown>[] || []),
          ...((rawMeds as Record<string, unknown>).as_needed as Record<string, unknown>[] || []),
        ]
      : []

  const supplements = Array.isArray(profile?.supplements)
    ? (profile.supplements as Record<string, unknown>[])
    : []

  // Count symptom frequencies
  const symptomCounts: Record<string, { count: number; severities: string[] }> = {}
  for (const s of (input.symptoms || [])) {
    if (!symptomCounts[s.symptom]) {
      symptomCounts[s.symptom] = { count: 0, severities: [] }
    }
    symptomCounts[s.symptom].count++
    if (s.severity) symptomCounts[s.symptom].severities.push(s.severity)
  }

  const keySymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([symptom, data]) => {
      const severityMap = { mild: 1, moderate: 2, severe: 3 }
      const avgSev = data.severities.length > 0
        ? data.severities.reduce((sum, s) => sum + (severityMap[s as keyof typeof severityMap] || 1), 0) / data.severities.length
        : 1
      return {
        symptom,
        frequency: data.count,
        avgSeverity: avgSev <= 1.5 ? 'mild' : avgSev <= 2.5 ? 'moderate' : 'severe',
      }
    })

  const rawConfirmed = Array.isArray(diagnoses?.confirmed) ? diagnoses.confirmed : []
  const rawSuspected = Array.isArray(diagnoses?.suspected) ? diagnoses.suspected : []
  const confirmed = (rawConfirmed as unknown[]).map(d => (typeof d === 'string' ? d : (d as Record<string, unknown>)?.name as string || String(d)))
  const suspected = (rawSuspected as unknown[]).map(d => (typeof d === 'string' ? d : (d as Record<string, unknown>)?.name as string || String(d)))

  return {
    age: calculateAge(personalInfo?.date_of_birth as string),
    sex: 'female',
    confirmedDiagnoses: confirmed,
    suspectedConditions: suspected,
    medications: medications.map(m => (m.name || m) as string),
    supplements: supplements.map(s => (s.name || s) as string),
    keySymptoms,
  }
}

function prepareLabSummary(input: PipelineInput): AnalysisContext['labSummary'] {
  // Group labs by test name
  const labGroups: Record<string, { date: string; value: number; unit: string; flag: string | null }[]> = {}

  for (const lab of (input.labResults || [])) {
    if (lab.value === null) continue
    if (!labGroups[lab.test_name]) labGroups[lab.test_name] = []
    labGroups[lab.test_name].push({
      date: lab.date,
      value: lab.value,
      unit: lab.unit || '',
      flag: lab.flag,
    })
  }

  return Object.entries(labGroups).map(([testName, values]) => {
    const sorted = values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    let trend = 'stable'
    if (sorted.length >= 2) {
      const first = sorted[0].value
      const last = sorted[sorted.length - 1].value
      const change = ((last - first) / Math.abs(first || 1)) * 100
      if (change > 15) trend = 'improving'
      else if (change < -15) trend = 'worsening'
      else trend = 'stable'
    }
    return { testName, values: sorted, trend }
  })
}

function prepareBiometricSummary(input: PipelineInput): AnalysisContext['biometricSummary'] {
  const oura = input.ouraData || []
  if (!oura.length) {
    return { avgHrv: null, avgRestingHr: null, avgTempDeviation: null, avgSleepScore: null, recentTrend: 'no data' }
  }

  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((v): v is number => v !== null)
    return valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null
  }

  // Last 14 days for trend
  const sorted = [...oura].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const recent14 = sorted.slice(0, 14)
  const prior14 = sorted.slice(14, 28)

  const recentHrv = avg(recent14.map(d => d.hrv_avg))
  const priorHrv = avg(prior14.map(d => d.hrv_avg))

  let recentTrend = 'stable'
  if (recentHrv !== null && priorHrv !== null) {
    const change = ((recentHrv - priorHrv) / priorHrv) * 100
    if (change > 10) recentTrend = 'improving (HRV rising)'
    else if (change < -10) recentTrend = 'declining (HRV dropping)'
  }

  return {
    avgHrv: avg(oura.map(d => d.hrv_avg)),
    avgRestingHr: avg(oura.map(d => d.resting_hr)),
    avgTempDeviation: avg(oura.map(d => d.body_temp_deviation)),
    avgSleepScore: avg(oura.map(d => d.sleep_score)),
    recentTrend,
  }
}

function prepareCycleSummary(input: PipelineInput): AnalysisContext['cycleSummary'] {
  const entries = (input.cycleEntries || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Count heavy flow days
  const heavyFlowDays = entries.filter(e => e.flow_level === 'heavy').length

  // Calculate cycle lengths from menstruation start dates
  const periodStarts: Date[] = []
  let inPeriod = false
  for (const entry of entries) {
    if (entry.menstruation && !inPeriod) {
      periodStarts.push(new Date(entry.date))
      inPeriod = true
    } else if (!entry.menstruation) {
      inPeriod = false
    }
  }

  const cycleLengths: number[] = []
  for (let i = 1; i < periodStarts.length; i++) {
    const diff = Math.round((periodStarts[i].getTime() - periodStarts[i - 1].getTime()) / (1000 * 60 * 60 * 24))
    if (diff >= 20 && diff <= 45) cycleLengths.push(diff)
  }

  const avgCycleLength = cycleLengths.length > 0
    ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
    : null

  // Phase-symptom correlation: group daily logs by cycle phase
  const phaseCorrelation: Record<string, { pains: number[]; symptoms: Record<string, number> }> = {}
  for (const log of input.dailyLogs) {
    const phase = log.cycle_phase
    if (!phase) continue
    if (!phaseCorrelation[phase]) phaseCorrelation[phase] = { pains: [], symptoms: {} }
    if (log.overall_pain !== null) phaseCorrelation[phase].pains.push(log.overall_pain)

    const logSymptoms = input.symptoms.filter(s => s.log_id === log.id)
    for (const s of logSymptoms) {
      phaseCorrelation[phase].symptoms[s.symptom] = (phaseCorrelation[phase].symptoms[s.symptom] || 0) + 1
    }
  }

  const phaseSymptomCorrelation: Record<string, { avgPain: number; topSymptoms: string[] }> = {}
  for (const [phase, data] of Object.entries(phaseCorrelation)) {
    const avgPain = data.pains.length > 0
      ? Math.round((data.pains.reduce((a, b) => a + b, 0) / data.pains.length) * 10) / 10
      : 0
    const topSymptoms = Object.entries(data.symptoms)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s]) => s)
    phaseSymptomCorrelation[phase] = { avgPain, topSymptoms }
  }

  return {
    avgCycleLength,
    avgPeriodLength: null, // Would need more granular period tracking
    heavyFlowDays,
    phaseSymptomCorrelation,
  }
}

function calculateAge(dob?: string): number {
  if (!dob) return 24 // Default from health profile
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/**
 * Compute a SHA-256-like hash of the input data for cache invalidation.
 * Uses a simple deterministic hash of key data points.
 */
export function computeInputHash(input: PipelineInput): string {
  const key = [
    input.dailyLogs.length,
    input.symptoms.length,
    input.labResults.length,
    input.ouraData.length,
    input.foodEntries.length,
    input.dailyLogs[input.dailyLogs.length - 1]?.date || '',
    input.labResults[input.labResults.length - 1]?.date || '',
    input.ouraData[input.ouraData.length - 1]?.date || '',
  ].join('|')

  // Simple hash function (djb2)
  let hash = 5381
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) & 0xffffffff
  }
  return hash.toString(16)
}
