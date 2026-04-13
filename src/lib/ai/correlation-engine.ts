// Statistical Correlation Engine
// Rigorous analysis: Spearman rank correlation, Mann-Whitney U test,
// Benjamini-Hochberg FDR correction, Cohen's d effect size, risk ratios.
// Pure TypeScript - no external ML libraries.

import { createServiceClient } from '@/lib/supabase'

// ── Types ───────────────────────────────────────────────────────────

export interface CorrelationResult {
  factor_a: string
  factor_b: string
  correlation_type: 'spearman' | 'mann_whitney' | 'risk_ratio'
  coefficient: number
  p_value: number
  effect_size: number
  effect_description: string
  confidence_level: 'strong' | 'moderate' | 'suggestive' | 'none'
  sample_size: number
  lag_days: number
  cycle_phase: string | null
  passed_fdr: boolean
}

interface MetricMap {
  name: string
  values: Map<string, number>
}

interface FactorMap {
  name: string
  presentDates: Set<string>
  absentDates: Set<string>
}

// ── Statistical Helper Functions ────────────────────────────────────

/**
 * Normal CDF approximation using the rational approximation
 * (Abramowitz and Stegun 26.2.17). No external library needed.
 */
function normalCDF(x: number): number {
  if (x < -8) return 0
  if (x > 8) return 1

  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x)
  const t = 1.0 / (1.0 + p * absX)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2)

  return 0.5 * (1.0 + sign * y)
}

/**
 * Rank array values for Spearman correlation.
 * Handles ties by averaging ranks (midrank method).
 */
function rankArray(arr: number[]): number[] {
  const n = arr.length
  const indexed = arr.map((val, i) => ({ val, idx: i }))
  indexed.sort((a, b) => a.val - b.val)

  const ranks = new Array<number>(n)
  let i = 0
  while (i < n) {
    let j = i
    // Find all tied values
    while (j < n - 1 && indexed[j + 1].val === indexed[i].val) {
      j++
    }
    // Average rank for tied group (ranks are 1-indexed)
    const avgRank = (i + 1 + j + 1) / 2
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = avgRank
    }
    i = j + 1
  }

  return ranks
}

/**
 * Pearson correlation on pre-ranked data (used internally by Spearman).
 */
function pearsonOnRanks(rx: number[], ry: number[]): number {
  const n = rx.length
  if (n === 0) return 0

  const meanX = rx.reduce((a, b) => a + b, 0) / n
  const meanY = ry.reduce((a, b) => a + b, 0) / n

  let num = 0
  let denomX = 0
  let denomY = 0

  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanX
    const dy = ry[i] - meanY
    num += dx * dy
    denomX += dx * dx
    denomY += dy * dy
  }

  const denom = Math.sqrt(denomX * denomY)
  return denom === 0 ? 0 : num / denom
}

/**
 * Spearman rank correlation coefficient.
 * Better than Pearson for ordinal data like pain scales (0-10).
 * Returns rho and sample size.
 */
function spearmanCorrelation(x: number[], y: number[]): { rho: number; n: number } {
  const n = x.length
  if (n < 3) return { rho: 0, n }

  const ranksX = rankArray(x)
  const ranksY = rankArray(y)
  const rho = pearsonOnRanks(ranksX, ranksY)

  return { rho, n }
}

/**
 * Approximate p-value for Spearman's rho using the t-distribution
 * approximation: t = rho * sqrt((n-2) / (1-rho^2)), df = n-2.
 * Uses normal approximation for large n.
 */
function spearmanPValue(rho: number, n: number): number {
  if (n < 4) return 1
  if (Math.abs(rho) >= 1) return 0

  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho))
  // For n > 30, t-distribution is close enough to normal
  const p = 2 * (1 - normalCDF(Math.abs(t)))
  return Math.max(0, Math.min(1, p))
}

/**
 * Mann-Whitney U test.
 * Tests whether two independent groups have different distributions.
 * Uses normal approximation for n > 20.
 */
function mannWhitneyU(
  group1: number[],
  group2: number[]
): { U: number; z: number; p: number } {
  const n1 = group1.length
  const n2 = group2.length

  if (n1 === 0 || n2 === 0) return { U: 0, z: 0, p: 1 }

  // Combine and rank all values, tracking group membership
  const combined = [
    ...group1.map(v => ({ val: v, group: 1 })),
    ...group2.map(v => ({ val: v, group: 2 })),
  ]
  const allValues = combined.map(c => c.val)
  const ranks = rankArray(allValues)

  // Sum of ranks for group 1
  let R1 = 0
  for (let i = 0; i < combined.length; i++) {
    if (combined[i].group === 1) {
      R1 += ranks[i]
    }
  }

  // U statistic for group 1
  const U1 = R1 - (n1 * (n1 + 1)) / 2
  const U2 = n1 * n2 - U1
  const U = Math.min(U1, U2)

  // Normal approximation (valid for n1, n2 > 20)
  const meanU = (n1 * n2) / 2
  const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12)

  if (stdU === 0) return { U, z: 0, p: 1 }

  const z = (U1 - meanU) / stdU
  const p = 2 * (1 - normalCDF(Math.abs(z)))

  return { U, z, p: Math.max(0, Math.min(1, p)) }
}

/**
 * Benjamini-Hochberg FDR correction.
 * Controls the false discovery rate across multiple hypothesis tests.
 * Returns a boolean array: true = passes FDR at the given alpha.
 */
function benjaminiHochberg(pValues: number[], alpha: number = 0.05): boolean[] {
  const n = pValues.length
  if (n === 0) return []

  // Create indexed array and sort by p-value ascending
  const indexed = pValues.map((p, i) => ({ p, i }))
  indexed.sort((a, b) => a.p - b.p)

  const passed = new Array<boolean>(n).fill(false)

  // Find the largest k where p(k) <= (k/n) * alpha
  let maxK = -1
  for (let k = 0; k < n; k++) {
    const threshold = ((k + 1) / n) * alpha
    if (indexed[k].p <= threshold) {
      maxK = k
    }
  }

  // All tests with rank <= maxK pass
  if (maxK >= 0) {
    for (let k = 0; k <= maxK; k++) {
      passed[indexed[k].i] = true
    }
  }

  return passed
}

/**
 * Cohen's d effect size.
 * Measures the standardized difference between two group means.
 * Uses pooled standard deviation.
 */
function cohensD(group1: number[], group2: number[]): number {
  const n1 = group1.length
  const n2 = group2.length

  if (n1 < 2 || n2 < 2) return 0

  const mean1 = group1.reduce((a, b) => a + b, 0) / n1
  const mean2 = group2.reduce((a, b) => a + b, 0) / n2

  const var1 = group1.reduce((sum, v) => sum + (v - mean1) ** 2, 0) / (n1 - 1)
  const var2 = group2.reduce((sum, v) => sum + (v - mean2) ** 2, 0) / (n2 - 1)

  const pooledSD = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))

  if (pooledSD === 0) return 0
  return (mean1 - mean2) / pooledSD
}

/**
 * Risk ratio: P(outcome | exposed) / P(outcome | unexposed).
 * Values > 1 mean exposure increases risk; < 1 means it reduces risk.
 */
function riskRatio(
  exposedOutcomes: number,
  exposedTotal: number,
  unexposedOutcomes: number,
  unexposedTotal: number
): number {
  if (exposedTotal === 0 || unexposedTotal === 0) return 1
  const pExposed = exposedOutcomes / exposedTotal
  const pUnexposed = unexposedOutcomes / unexposedTotal
  if (pUnexposed === 0) return pExposed > 0 ? Infinity : 1
  return pExposed / pUnexposed
}

/**
 * Generate a plain English description of an effect.
 */
function describeEffect(
  factorA: string,
  factorB: string,
  effectSize: number,
  direction: string,
  lagDays: number,
  corrType: string
): string {
  const absEffect = Math.abs(effectSize)
  const lagText = lagDays === 0
    ? 'on the same day'
    : lagDays === 1
      ? '1 day later'
      : `${lagDays} days later`

  if (corrType === 'mann_whitney') {
    const higherLower = direction === 'positive' ? 'higher' : 'lower'
    return `${factorB} tends to be ${higherLower} on days with ${factorA} (effect size: ${absEffect.toFixed(2)})`
  }

  if (corrType === 'risk_ratio') {
    return `${factorA} is associated with ${absEffect.toFixed(1)}x ${direction === 'positive' ? 'higher' : 'lower'} risk of elevated ${factorB}`
  }

  // Spearman correlation
  const strength = absEffect > 0.6 ? 'strongly' : absEffect > 0.3 ? 'moderately' : 'weakly'
  const assoc = direction === 'positive' ? 'increases with' : 'decreases with'

  if (lagDays === 0) {
    return `${factorB} ${strength} ${assoc} ${factorA} on the same day`
  }
  return `When ${factorA} changes, ${factorB} ${strength} ${assoc.replace('with', '')} ${lagText}`
}

/**
 * Classify confidence level based on effect size and FDR status.
 */
function classifyConfidence(
  absRho: number,
  passedFDR: boolean
): 'strong' | 'moderate' | 'suggestive' | 'none' {
  if (absRho > 0.40 && passedFDR) return 'strong'
  if (absRho > 0.25 && passedFDR) return 'moderate'
  if (absRho > 0.15) return 'suggestive'
  return 'none'
}

// ── Date Utility ────────────────────────────────────────────────────

/**
 * Shift a date string (YYYY-MM-DD) by N days.
 */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

// ── Main Analysis Functions ─────────────────────────────────────────

/**
 * Analyze Spearman correlation between two continuous metrics across time.
 * Tests lags from -7 to +7 days and reports the lag with highest |rho|.
 */
function analyzeMetricCorrelation(
  metricA: MetricMap,
  metricB: MetricMap
): CorrelationResult[] {
  const results: CorrelationResult[] = []

  let bestRho = 0
  let bestLag = 0
  let bestN = 0
  let bestP = 1

  for (let lag = -7; lag <= 7; lag++) {
    const xVals: number[] = []
    const yVals: number[] = []

    for (const [date, valA] of metricA.values) {
      const shiftedDate = lag === 0 ? date : shiftDate(date, lag)
      const valB = metricB.values.get(shiftedDate)
      if (valB !== undefined) {
        xVals.push(valA)
        yVals.push(valB)
      }
    }

    if (xVals.length < 20) continue

    const { rho, n } = spearmanCorrelation(xVals, yVals)
    if (Math.abs(rho) > Math.abs(bestRho)) {
      bestRho = rho
      bestLag = lag
      bestN = n
      bestP = spearmanPValue(rho, n)
    }
  }

  if (bestN >= 20) {
    const direction = bestRho > 0 ? 'positive' : 'negative'
    results.push({
      factor_a: metricA.name,
      factor_b: metricB.name,
      correlation_type: 'spearman',
      coefficient: Math.round(bestRho * 1000) / 1000,
      p_value: bestP,
      effect_size: Math.abs(bestRho),
      effect_description: describeEffect(
        metricA.name, metricB.name, bestRho, direction, Math.abs(bestLag), 'spearman'
      ),
      confidence_level: 'none', // Will be set after FDR
      sample_size: bestN,
      lag_days: bestLag,
      cycle_phase: null,
      passed_fdr: false, // Will be set after FDR
    })
  }

  return results
}

/**
 * Analyze the effect of a binary factor on a continuous outcome.
 * Uses Mann-Whitney U test and Cohen's d.
 * Example: "Does gluten consumption affect pain levels?"
 */
function analyzeFactorEffect(
  factor: FactorMap,
  outcome: MetricMap
): CorrelationResult | null {
  const presentValues: number[] = []
  const absentValues: number[] = []

  for (const date of factor.presentDates) {
    const val = outcome.values.get(date)
    if (val !== undefined) presentValues.push(val)
  }
  for (const date of factor.absentDates) {
    const val = outcome.values.get(date)
    if (val !== undefined) absentValues.push(val)
  }

  if (presentValues.length < 10 || absentValues.length < 10) return null

  const { U, z, p } = mannWhitneyU(presentValues, absentValues)
  const d = cohensD(presentValues, absentValues)

  const meanPresent = presentValues.reduce((a, b) => a + b, 0) / presentValues.length
  const meanAbsent = absentValues.reduce((a, b) => a + b, 0) / absentValues.length
  const direction = meanPresent > meanAbsent ? 'positive' : 'negative'

  // Also compute risk ratio: "flare days" are those where outcome >= 7
  const flareThreshold = 7
  const exposedFlares = presentValues.filter(v => v >= flareThreshold).length
  const unexposedFlares = absentValues.filter(v => v >= flareThreshold).length
  const rr = riskRatio(exposedFlares, presentValues.length, unexposedFlares, absentValues.length)

  const effectDesc = rr !== 1 && isFinite(rr)
    ? describeEffect(factor.name, outcome.name, rr, direction, 0, 'risk_ratio')
    : describeEffect(factor.name, outcome.name, d, direction, 0, 'mann_whitney')

  return {
    factor_a: factor.name,
    factor_b: outcome.name,
    correlation_type: 'mann_whitney',
    coefficient: Math.round(z * 1000) / 1000,
    p_value: p,
    effect_size: Math.round(Math.abs(d) * 1000) / 1000,
    effect_description: effectDesc,
    confidence_level: 'none', // Set after FDR
    sample_size: presentValues.length + absentValues.length,
    lag_days: 0,
    cycle_phase: null,
    passed_fdr: false, // Set after FDR
  }
}

// ── Full Pipeline ───────────────────────────────────────────────────

/**
 * Run the full correlation pipeline across all patient data.
 * 1. Fetch all data from Supabase
 * 2. Build metric and factor maps
 * 3. Run metric-vs-metric correlations (with lag analysis)
 * 4. Run factor-effect analyses
 * 5. Apply Benjamini-Hochberg FDR correction
 * 6. Compute effect sizes and descriptions
 * 7. Store results in correlation_results
 */
export async function runCorrelationPipeline(): Promise<{
  correlations: CorrelationResult[]
  totalTests: number
  passingFDR: number
}> {
  const supabase = createServiceClient()

  // ── 1. Fetch all data ──────────────────────────────────────────

  const [
    { data: ouraData },
    { data: dailyLogs },
    { data: foodEntries },
    { data: cycleEntries },
    { data: ncImported },
  ] = await Promise.all([
    supabase.from('oura_daily').select('date, sleep_score, hrv_avg, resting_hr, body_temp_deviation, readiness_score').order('date'),
    supabase.from('daily_logs').select('date, overall_pain, fatigue, bloating, stress, sleep_quality, cycle_phase').order('date'),
    supabase.from('food_entries').select('logged_at, flagged_triggers').order('logged_at'),
    supabase.from('cycle_entries').select('date, flow_level, menstruation').order('date'),
    supabase.from('nc_imported').select('date, temperature, cycle_day, fertility_color, menstruation').order('date'),
  ])

  // ── 2. Build metric maps (date -> value) ───────────────────────

  const metricMaps: MetricMap[] = []

  // From daily_logs
  const painMap = new Map<string, number>()
  const fatigueMap = new Map<string, number>()
  const bloatingMap = new Map<string, number>()
  const stressMap = new Map<string, number>()
  const sleepQualityMap = new Map<string, number>()

  for (const log of dailyLogs || []) {
    if (log.overall_pain !== null) painMap.set(log.date, log.overall_pain)
    if (log.fatigue !== null) fatigueMap.set(log.date, log.fatigue)
    if (log.bloating !== null) bloatingMap.set(log.date, log.bloating)
    if (log.stress !== null) stressMap.set(log.date, log.stress)
    if (log.sleep_quality !== null) sleepQualityMap.set(log.date, log.sleep_quality)
  }

  metricMaps.push(
    { name: 'Pain', values: painMap },
    { name: 'Fatigue', values: fatigueMap },
    { name: 'Bloating', values: bloatingMap },
    { name: 'Stress', values: stressMap },
    { name: 'Sleep Quality (self-reported)', values: sleepQualityMap },
  )

  // From oura_daily
  const hrvMap = new Map<string, number>()
  const restingHrMap = new Map<string, number>()
  const sleepScoreMap = new Map<string, number>()
  const tempDeviationMap = new Map<string, number>()
  const readinessMap = new Map<string, number>()

  for (const oura of ouraData || []) {
    if (oura.hrv_avg !== null) hrvMap.set(oura.date, oura.hrv_avg)
    if (oura.resting_hr !== null) restingHrMap.set(oura.date, oura.resting_hr)
    if (oura.sleep_score !== null) sleepScoreMap.set(oura.date, oura.sleep_score)
    if (oura.body_temp_deviation !== null) tempDeviationMap.set(oura.date, oura.body_temp_deviation)
    if (oura.readiness_score !== null) readinessMap.set(oura.date, oura.readiness_score)
  }

  metricMaps.push(
    { name: 'HRV', values: hrvMap },
    { name: 'Resting Heart Rate', values: restingHrMap },
    { name: 'Sleep Score (Oura)', values: sleepScoreMap },
    { name: 'Temperature Deviation', values: tempDeviationMap },
    { name: 'Readiness Score', values: readinessMap },
  )

  // From nc_imported (temperature)
  const ncTempMap = new Map<string, number>()
  for (const nc of ncImported || []) {
    if (nc.temperature !== null) ncTempMap.set(nc.date, nc.temperature)
  }
  metricMaps.push({ name: 'Basal Body Temperature', values: ncTempMap })

  // ── 3. Build factor maps (binary: present vs absent) ───────────

  const factorMaps: FactorMap[] = []

  // Food triggers from food_entries
  // Collect all unique triggers and track which dates they appeared
  const triggerDatesMap = new Map<string, Set<string>>()
  const allFoodDates = new Set<string>()

  for (const entry of foodEntries || []) {
    // Extract date from logged_at timestamp
    const date = typeof entry.logged_at === 'string'
      ? entry.logged_at.split('T')[0]
      : ''
    if (!date) continue
    allFoodDates.add(date)

    const triggers = entry.flagged_triggers
    if (triggers && Array.isArray(triggers)) {
      for (const trigger of triggers) {
        const t = trigger.toLowerCase().trim()
        if (!t) continue
        if (!triggerDatesMap.has(t)) triggerDatesMap.set(t, new Set())
        triggerDatesMap.get(t)!.add(date)
      }
    }
  }

  for (const [trigger, presentDates] of triggerDatesMap) {
    const absentDates = new Set<string>()
    for (const date of allFoodDates) {
      if (!presentDates.has(date)) absentDates.add(date)
    }
    // Only include triggers with enough data points on both sides
    if (presentDates.size >= 5 && absentDates.size >= 5) {
      factorMaps.push({ name: trigger, presentDates, absentDates })
    }
  }

  // Menstruation factor from cycle_entries + nc_imported
  const mensDates = new Set<string>()
  const nonMensDates = new Set<string>()

  for (const entry of cycleEntries || []) {
    if (entry.menstruation || (entry.flow_level && entry.flow_level !== 'none')) {
      mensDates.add(entry.date)
    } else {
      nonMensDates.add(entry.date)
    }
  }
  for (const nc of ncImported || []) {
    if (nc.menstruation && nc.menstruation.toLowerCase() !== 'no' && nc.menstruation.toLowerCase() !== 'none') {
      mensDates.add(nc.date)
    } else if (nc.date) {
      nonMensDates.add(nc.date)
    }
  }
  // Remove overlap (menstruation takes priority)
  for (const d of mensDates) {
    nonMensDates.delete(d)
  }

  if (mensDates.size >= 5 && nonMensDates.size >= 5) {
    factorMaps.push({ name: 'Menstruation', presentDates: mensDates, absentDates: nonMensDates })
  }

  // Cycle phase factors from daily_logs
  const phaseGroups = new Map<string, Set<string>>()
  const allLogDates = new Set<string>()
  for (const log of dailyLogs || []) {
    allLogDates.add(log.date)
    if (log.cycle_phase) {
      if (!phaseGroups.has(log.cycle_phase)) phaseGroups.set(log.cycle_phase, new Set())
      phaseGroups.get(log.cycle_phase)!.add(log.date)
    }
  }
  for (const [phase, phaseDates] of phaseGroups) {
    const otherDates = new Set<string>()
    for (const d of allLogDates) {
      if (!phaseDates.has(d)) otherDates.add(d)
    }
    if (phaseDates.size >= 5 && otherDates.size >= 5) {
      factorMaps.push({ name: `Cycle Phase: ${phase}`, presentDates: phaseDates, absentDates: otherDates })
    }
  }

  // ── 4. Run metric-vs-metric correlations (meaningful pairs) ────

  const allCorrelations: CorrelationResult[] = []

  // Define meaningful metric pairs to analyze (not exhaustive combinatorial)
  const metricPairs: [string, string][] = [
    // Pain correlations
    ['Pain', 'HRV'],
    ['Pain', 'Resting Heart Rate'],
    ['Pain', 'Sleep Score (Oura)'],
    ['Pain', 'Temperature Deviation'],
    ['Pain', 'Readiness Score'],
    ['Pain', 'Fatigue'],
    ['Pain', 'Stress'],
    ['Pain', 'Bloating'],
    ['Pain', 'Sleep Quality (self-reported)'],
    ['Pain', 'Basal Body Temperature'],
    // Fatigue correlations
    ['Fatigue', 'HRV'],
    ['Fatigue', 'Sleep Score (Oura)'],
    ['Fatigue', 'Readiness Score'],
    ['Fatigue', 'Resting Heart Rate'],
    ['Fatigue', 'Stress'],
    ['Fatigue', 'Bloating'],
    ['Fatigue', 'Sleep Quality (self-reported)'],
    // Bloating correlations
    ['Bloating', 'HRV'],
    ['Bloating', 'Stress'],
    ['Bloating', 'Resting Heart Rate'],
    ['Bloating', 'Temperature Deviation'],
    // Biometric cross-correlations
    ['HRV', 'Resting Heart Rate'],
    ['HRV', 'Sleep Score (Oura)'],
    ['HRV', 'Readiness Score'],
    ['HRV', 'Temperature Deviation'],
    ['Sleep Score (Oura)', 'Readiness Score'],
    ['Sleep Score (Oura)', 'Resting Heart Rate'],
    // Stress biometric links
    ['Stress', 'HRV'],
    ['Stress', 'Resting Heart Rate'],
    ['Stress', 'Sleep Score (Oura)'],
  ]

  const metricByName = new Map(metricMaps.map(m => [m.name, m]))

  for (const [nameA, nameB] of metricPairs) {
    const mapA = metricByName.get(nameA)
    const mapB = metricByName.get(nameB)
    if (!mapA || !mapB) continue

    const results = analyzeMetricCorrelation(mapA, mapB)
    allCorrelations.push(...results)
  }

  // ── 5. Run factor-effect analyses ──────────────────────────────

  // Each food trigger vs Pain, Fatigue, Bloating
  const symptomOutcomes = [
    { name: 'Pain', values: painMap },
    { name: 'Fatigue', values: fatigueMap },
    { name: 'Bloating', values: bloatingMap },
  ]

  for (const factor of factorMaps) {
    for (const outcome of symptomOutcomes) {
      const result = analyzeFactorEffect(factor, outcome)
      if (result) allCorrelations.push(result)
    }

    // Also test factor vs biometrics for menstruation and cycle phases
    if (factor.name === 'Menstruation' || factor.name.startsWith('Cycle Phase:')) {
      for (const biometric of [
        { name: 'HRV', values: hrvMap },
        { name: 'Sleep Score (Oura)', values: sleepScoreMap },
        { name: 'Resting Heart Rate', values: restingHrMap },
      ]) {
        const result = analyzeFactorEffect(factor, biometric)
        if (result) allCorrelations.push(result)
      }
    }
  }

  // ── 6. Apply Benjamini-Hochberg FDR correction ─────────────────

  const pValues = allCorrelations.map(c => c.p_value)
  const fdrResults = benjaminiHochberg(pValues, 0.05)

  let passingFDR = 0
  for (let i = 0; i < allCorrelations.length; i++) {
    allCorrelations[i].passed_fdr = fdrResults[i]
    if (fdrResults[i]) passingFDR++

    // Set confidence level based on effect size and FDR
    const absEffect = allCorrelations[i].correlation_type === 'spearman'
      ? Math.abs(allCorrelations[i].coefficient)
      : allCorrelations[i].effect_size
    allCorrelations[i].confidence_level = classifyConfidence(absEffect, fdrResults[i])
  }

  // ── 7. Store results in correlation_results ────────────────────

  // Clear old results
  await supabase.from('correlation_results').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Insert new batch (chunk to avoid payload limits)
  const chunkSize = 50
  for (let i = 0; i < allCorrelations.length; i += chunkSize) {
    const chunk = allCorrelations.slice(i, i + chunkSize).map(c => ({
      factor_a: c.factor_a,
      factor_b: c.factor_b,
      correlation_type: c.correlation_type,
      coefficient: c.coefficient,
      p_value: c.p_value,
      effect_size: c.effect_size,
      effect_description: c.effect_description,
      confidence_level: c.confidence_level,
      sample_size: c.sample_size,
      lag_days: c.lag_days,
      cycle_phase: c.cycle_phase,
      passed_fdr: c.passed_fdr,
      computed_at: new Date().toISOString(),
    }))

    await supabase.from('correlation_results').insert(chunk)
  }

  // Sort by significance: passed FDR first, then by effect size
  allCorrelations.sort((a, b) => {
    if (a.passed_fdr !== b.passed_fdr) return a.passed_fdr ? -1 : 1
    return b.effect_size - a.effect_size
  })

  return {
    correlations: allCorrelations,
    totalTests: allCorrelations.length,
    passingFDR,
  }
}
