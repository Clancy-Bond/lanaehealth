// Flare Prediction Engine
// Uses statistical pattern detection + Claude reasoning to predict symptom flares
// No ML libraries needed -- pure statistical analysis

import type { DailyLog, OuraDaily, CycleEntry, Symptom, FlarePrediction, CyclePhase } from '@/lib/types'

// ── Types ───────────────────────────────────────────────────────────

export interface AlignedDay {
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

export interface PrecursorPattern {
  metric: string
  lagDays: number
  correlationStrength: number // -1 to 1
  direction: 'drop' | 'spike' | 'deviation'
  description: string
}

export interface LagCorrelation {
  metric: string
  lag: number // negative = biometric follows pain, positive = biometric precedes pain
  correlation: number
  sampleSize: number
}

export interface OptimalLag {
  metric: string
  bestLag: number
  bestCorrelation: number
  sampleSize: number
  interpretation: string // plain English
}

export interface FlareSignature {
  // For each biometric, the average value at each offset from day -7 to day +3
  metrics: Record<string, { offsets: number[]; values: (number | null)[] }>
  flareCount: number
  baselineAvg: Record<string, number>
}

export interface PhaseStratifiedCorrelations {
  phase: CyclePhase
  patterns: PrecursorPattern[]
  flareRate: number
  dayCount: number
}

export interface FlareRiskAssessment {
  riskPercent: number
  riskLevel: 'low' | 'moderate' | 'high'
  contributingFactors: string[]
  flareSignature: FlareSignature
  phaseAnalysis: PhaseStratifiedCorrelations[]
  optimalLags: OptimalLag[]
  lastAssessed: string
}

// ── Biometric metric definitions ────────────────────────────────────

const BIOMETRIC_METRICS: { key: keyof AlignedDay; label: string }[] = [
  { key: 'hrv', label: 'HRV' },
  { key: 'restingHr', label: 'Resting Heart Rate' },
  { key: 'tempDeviation', label: 'Temperature Deviation' },
  { key: 'sleepScore', label: 'Sleep Score' },
  { key: 'readinessScore', label: 'Readiness Score' },
  { key: 'spo2', label: 'SpO2' },
]

const METRIC_KEY_MAP: Record<string, keyof AlignedDay> = {
  'HRV': 'hrv',
  'Resting Heart Rate': 'restingHr',
  'Temperature Deviation': 'tempDeviation',
  'Sleep Score': 'sleepScore',
  'Readiness Score': 'readinessScore',
  'SpO2': 'spo2',
}

const MIN_SAMPLE_SIZE = 20

// ── Data alignment (preserved from original) ────────────────────────

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

// ── Pearson correlation ─────────────────────────────────────────────

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

// ── Core correlation with configurable lag ──────────────────────────

/**
 * Compute Pearson correlation between a biometric metric (at lag) and pain/flare.
 * Positive lag: biometric at day (i - lag) compared against pain at day i
 *   (biometric precedes pain = potential predictor)
 * Negative lag: pain at day (i + |lag|) compared against biometric at day i
 *   (biometric follows pain = potential consequence)
 */
function computeCorrelationAtLag(
  aligned: AlignedDay[],
  metricKey: keyof AlignedDay,
  lag: number,
  target: 'flare' | 'pain' = 'flare'
): { correlation: number; sampleSize: number } | null {
  const pairs: { x: number; y: number }[] = []

  if (lag >= 0) {
    // Positive lag: biometric at (i - lag) vs target at day i
    for (let i = lag; i < aligned.length; i++) {
      const metricValue = aligned[i - lag][metricKey]
      if (typeof metricValue !== 'number' || metricValue === null) continue

      if (target === 'flare') {
        pairs.push({ x: metricValue, y: aligned[i].isFlare ? 1 : 0 })
      } else {
        if (aligned[i].pain === null) continue
        pairs.push({ x: metricValue, y: aligned[i].pain as number })
      }
    }
  } else {
    // Negative lag: biometric at day i vs target at day (i + |lag|)
    const absLag = Math.abs(lag)
    for (let i = 0; i < aligned.length - absLag; i++) {
      const metricValue = aligned[i][metricKey]
      if (typeof metricValue !== 'number' || metricValue === null) continue

      if (target === 'flare') {
        pairs.push({ x: metricValue, y: aligned[i + absLag].isFlare ? 1 : 0 })
      } else {
        if (aligned[i + absLag].pain === null) continue
        pairs.push({ x: metricValue, y: aligned[i + absLag].pain as number })
      }
    }
  }

  if (pairs.length < MIN_SAMPLE_SIZE) return null

  const r = pearsonCorrelation(pairs.map(p => p.x), pairs.map(p => p.y))
  return { correlation: r, sampleSize: pairs.length }
}

// ── Original precursor patterns (preserved) ─────────────────────────

/**
 * Compute Pearson correlation between a biometric metric (at lag) and flare occurrence.
 * (Preserved for backward compatibility)
 */
function computeFlareCorrelation(
  aligned: AlignedDay[],
  metricKey: keyof AlignedDay,
  lagDays: number
): number | null {
  const result = computeCorrelationAtLag(aligned, metricKey, lagDays, 'flare')
  // Keep original 10-sample threshold for backward compat in findPrecursorPatterns
  if (!result || result.sampleSize < 10) return null
  return result.correlation
}

/**
 * Identify biometric precursors that occur 1-3 days before flares.
 * (Preserved from original)
 */
export function findPrecursorPatterns(aligned: AlignedDay[]): PrecursorPattern[] {
  const patterns: PrecursorPattern[] = []

  for (const { key, label } of BIOMETRIC_METRICS) {
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

  return patterns.sort((a, b) => Math.abs(b.correlationStrength) - Math.abs(a.correlationStrength))
}

// ── Extended lag analysis (-7 to +7) ────────────────────────────────

/**
 * For each biometric, compute correlation with pain at every lag from -7 to +7.
 * Negative lag = biometric follows pain (consequence).
 * Positive lag = biometric precedes pain (predictor).
 */
export function computeExtendedLagAnalysis(aligned: AlignedDay[]): LagCorrelation[] {
  const results: LagCorrelation[] = []

  for (const { key, label } of BIOMETRIC_METRICS) {
    for (let lag = -7; lag <= 7; lag++) {
      const result = computeCorrelationAtLag(aligned, key, lag, 'pain')
      if (result) {
        results.push({
          metric: label,
          lag,
          correlation: result.correlation,
          sampleSize: result.sampleSize,
        })
      }
    }
  }

  return results
}

/**
 * Find the optimal lag for each biometric (highest absolute correlation).
 */
export function findOptimalLags(aligned: AlignedDay[]): OptimalLag[] {
  const allLags = computeExtendedLagAnalysis(aligned)
  const byMetric = new Map<string, LagCorrelation[]>()

  for (const lc of allLags) {
    if (!byMetric.has(lc.metric)) byMetric.set(lc.metric, [])
    byMetric.get(lc.metric)!.push(lc)
  }

  const optimalLags: OptimalLag[] = []

  for (const [metric, lags] of byMetric) {
    if (lags.length === 0) continue

    const best = lags.reduce((a, b) =>
      Math.abs(b.correlation) > Math.abs(a.correlation) ? b : a
    )

    let interpretation: string
    if (best.lag > 0) {
      const dir = best.correlation < 0 ? 'drops in' : 'spikes in'
      interpretation = `${metric} ${dir} tend to precede pain increases by ${best.lag} day${best.lag > 1 ? 's' : ''} (r=${best.correlation.toFixed(2)})`
    } else if (best.lag < 0) {
      const absLag = Math.abs(best.lag)
      const dir = best.correlation < 0 ? 'drop' : 'rise'
      interpretation = `${metric} tends to ${dir} ${absLag} day${absLag > 1 ? 's' : ''} after pain increases (likely a consequence, r=${best.correlation.toFixed(2)})`
    } else {
      const dir = best.correlation < 0 ? 'inversely' : 'directly'
      interpretation = `${metric} is ${dir} correlated with pain on the same day (r=${best.correlation.toFixed(2)})`
    }

    optimalLags.push({
      metric,
      bestLag: best.lag,
      bestCorrelation: best.correlation,
      sampleSize: best.sampleSize,
      interpretation,
    })
  }

  return optimalLags.sort((a, b) => Math.abs(b.bestCorrelation) - Math.abs(a.bestCorrelation))
}

// ── Event-triggered averaging (flare signature) ─────────────────────

/**
 * Build a "flare signature" by averaging biometrics around every flare event.
 * Window: day -7 to day +3 relative to each flare.
 * Flare defined as: pain >= 7 OR severe symptoms count >= 3.
 */
export function computeFlareSignature(aligned: AlignedDay[]): FlareSignature {
  const dateIndex = new Map<string, number>()
  for (let i = 0; i < aligned.length; i++) {
    dateIndex.set(aligned[i].date, i)
  }

  // Build date list in chronological order for offset calculations
  const flareIndices: number[] = []
  for (let i = 0; i < aligned.length; i++) {
    if (aligned[i].isFlare) {
      flareIndices.push(i)
    }
  }

  // Compute baseline averages (all non-flare days)
  const baselineAvg: Record<string, number> = {}
  for (const { key, label } of BIOMETRIC_METRICS) {
    const nonFlareValues = aligned
      .filter(d => !d.isFlare)
      .map(d => d[key])
      .filter((v): v is number => typeof v === 'number' && v !== null)

    if (nonFlareValues.length > 0) {
      baselineAvg[label] = nonFlareValues.reduce((a, b) => a + b, 0) / nonFlareValues.length
    }
  }

  // Offsets: -7, -6, -5, -4, -3, -2, -1, 0, +1, +2, +3
  const offsets = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3]
  const metrics: FlareSignature['metrics'] = {}

  for (const { key, label } of BIOMETRIC_METRICS) {
    const accumulators: (number[])[] = offsets.map(() => [])

    for (const flareIdx of flareIndices) {
      for (let oi = 0; oi < offsets.length; oi++) {
        const targetIdx = flareIdx + offsets[oi]
        if (targetIdx >= 0 && targetIdx < aligned.length) {
          const val = aligned[targetIdx][key]
          if (typeof val === 'number' && val !== null) {
            accumulators[oi].push(val)
          }
        }
      }
    }

    const values: (number | null)[] = accumulators.map(arr => {
      if (arr.length < 3) return null // Need at least 3 observations for a meaningful average
      return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
    })

    metrics[label] = { offsets, values }
  }

  return {
    metrics,
    flareCount: flareIndices.length,
    baselineAvg,
  }
}

// ── Cycle-phase stratification ──────────────────────────────────────

/**
 * Run correlation analyses separately for each cycle phase.
 * Surfaces patterns that only appear in specific phases.
 */
export function computePhaseStratifiedCorrelations(aligned: AlignedDay[]): PhaseStratifiedCorrelations[] {
  const phases: CyclePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal']
  const results: PhaseStratifiedCorrelations[] = []

  for (const phase of phases) {
    const phaseData = aligned.filter(d => d.cyclePhase === phase)
    if (phaseData.length < MIN_SAMPLE_SIZE) continue

    const flareCount = phaseData.filter(d => d.isFlare).length
    const flareRate = flareCount / phaseData.length

    // Run precursor analysis on phase-filtered data
    const patterns = findPrecursorPatterns(phaseData)

    // Also check extended lags (1-5 days only, limited by phase segment lengths)
    const extendedPatterns: PrecursorPattern[] = []
    for (const { key, label } of BIOMETRIC_METRICS) {
      for (const lagDays of [4, 5]) {
        const result = computeCorrelationAtLag(phaseData, key, lagDays, 'flare')
        if (result && result.sampleSize >= MIN_SAMPLE_SIZE && Math.abs(result.correlation) > 0.15) {
          const direction = result.correlation < 0 ? 'drop' : 'spike'
          extendedPatterns.push({
            metric: label,
            lagDays,
            correlationStrength: result.correlation,
            direction: key === 'tempDeviation' ? 'deviation' : direction,
            description: `${label} ${direction}s ${lagDays} days before flares during ${phase} phase (r=${result.correlation.toFixed(2)})`,
          })
        }
      }
    }

    const allPatterns = [...patterns, ...extendedPatterns]
      .sort((a, b) => Math.abs(b.correlationStrength) - Math.abs(a.correlationStrength))

    results.push({
      phase,
      patterns: allPatterns,
      flareRate: Math.round(flareRate * 100) / 100,
      dayCount: phaseData.length,
    })
  }

  return results
}

// ── Flare risk prediction (upgraded) ────────────────────────────────

/**
 * Compare the last 3 days of biometric data against the flare signature
 * and produce a risk probability (0-100%) with contributing factors in plain English.
 */
export function assessFlareRisk(aligned: AlignedDay[]): FlareRiskAssessment | null {
  if (aligned.length < 14) {
    return null
  }

  const signature = computeFlareSignature(aligned)
  const optimalLags = findOptimalLags(aligned)
  const phaseAnalysis = computePhaseStratifiedCorrelations(aligned)

  if (signature.flareCount < 3) {
    // Not enough flare events to build a meaningful signature
    return null
  }

  const recent = aligned.slice(-3) // Last 3 days
  const baseline = aligned.slice(-30, -3) // 30-day baseline (excluding last 3)

  if (baseline.length < 7) return null

  // Compute baseline stats for each metric
  const baselineStats: Record<string, { mean: number; stdDev: number }> = {}
  for (const { key, label } of BIOMETRIC_METRICS) {
    const values = baseline.map(d => d[key]).filter((v): v is number => typeof v === 'number' && v !== null)
    if (values.length >= 5) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length
      baselineStats[label] = { mean, stdDev: Math.sqrt(variance) }
    }
  }

  // Score contributions from multiple signal sources
  const contributingFactors: string[] = []
  let weightedRiskScore = 0
  let totalWeight = 0

  // Signal 1: Compare recent values against flare signature pre-flare window
  // The flare signature at offsets -3, -2, -1 tells us what biometrics look like
  // 1-3 days before a typical flare.
  for (const { key, label } of BIOMETRIC_METRICS) {
    const recentValues = recent.map(d => d[key]).filter((v): v is number => typeof v === 'number' && v !== null)
    if (recentValues.length === 0) continue

    const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length
    const stats = baselineStats[label]
    if (!stats || stats.stdDev === 0) continue

    // Get flare signature values at days -3, -2, -1 (indices 4, 5, 6 in offsets array)
    const sigData = signature.metrics[label]
    if (!sigData) continue

    const preFlareValues = [sigData.values[4], sigData.values[5], sigData.values[6]]
      .filter((v): v is number => v !== null)

    if (preFlareValues.length === 0) continue

    const preFlareAvg = preFlareValues.reduce((a, b) => a + b, 0) / preFlareValues.length
    const baselineVal = signature.baselineAvg[label]
    if (baselineVal === undefined) continue

    // How far is the pre-flare signature from baseline?
    const signatureDeviation = (preFlareAvg - baselineVal) / (stats.stdDev || 1)
    // How far is current from baseline?
    const currentDeviation = (recentAvg - baselineVal) / (stats.stdDev || 1)

    // If current deviation is in the same direction as the flare signature deviation,
    // and the magnitude is similar or greater, that's a risk signal
    if (Math.abs(signatureDeviation) > 0.3) {
      const signatureDirection = signatureDeviation > 0 ? 1 : -1
      const currentDirection = currentDeviation > 0 ? 1 : -1

      if (signatureDirection === currentDirection && Math.abs(currentDeviation) >= Math.abs(signatureDeviation) * 0.5) {
        const similarity = Math.min(1, Math.abs(currentDeviation) / Math.abs(signatureDeviation))
        const weight = 0.4 // Signature match is weighted heavily
        weightedRiskScore += similarity * weight
        totalWeight += weight

        const pctFromBaseline = Math.round(((recentAvg - baselineVal) / Math.abs(baselineVal || 1)) * 100)
        const dirWord = pctFromBaseline < 0 ? 'dropped' : 'increased'
        const absPercent = Math.abs(pctFromBaseline)

        contributingFactors.push(
          `${label} ${dirWord} ${absPercent}% from your baseline (historically this pattern appears 1-3 days before flares)`
        )
      }
    }
  }

  // Signal 2: Optimal lag alignment
  // Check if current biometric values match what we'd expect given the best predictive lags
  for (const lag of optimalLags) {
    if (lag.bestLag <= 0) continue // Only consider predictive lags (positive = biometric precedes pain)
    if (Math.abs(lag.bestCorrelation) < 0.15) continue

    const metricKey = METRIC_KEY_MAP[lag.metric]
    if (!metricKey) continue

    // The biometric value lag.bestLag days ago should be checked
    const lookbackIdx = aligned.length - lag.bestLag
    if (lookbackIdx < 0 || lookbackIdx >= aligned.length) continue

    const lagValue = aligned[lookbackIdx][metricKey]
    if (typeof lagValue !== 'number') continue

    const stats = baselineStats[lag.metric]
    if (!stats || stats.stdDev === 0) continue

    const zScore = (lagValue - stats.mean) / stats.stdDev
    // A z-score in the direction matching the correlation sign = risk signal
    const expectedDirection = lag.bestCorrelation < 0 ? -1 : 1
    const actualDirection = zScore > 0 ? 1 : -1

    if (actualDirection === expectedDirection && Math.abs(zScore) > 0.5) {
      const weight = 0.3 * Math.abs(lag.bestCorrelation)
      const risk = Math.min(1, Math.abs(zScore) / 2)
      weightedRiskScore += risk * weight
      totalWeight += weight

      if (Math.abs(zScore) > 1.0) {
        const pctDev = Math.round(((lagValue - stats.mean) / Math.abs(stats.mean || 1)) * 100)
        const dirWord = pctDev < 0 ? 'dropped' : 'rose'
        contributingFactors.push(
          `${lag.metric} ${dirWord} ${Math.abs(pctDev)}% below your baseline ${lag.bestLag} day${lag.bestLag > 1 ? 's' : ''} ago (historically precedes flares by ${lag.bestLag} day${lag.bestLag > 1 ? 's' : ''})`
        )
      }
    }
  }

  // Signal 3: Cycle phase risk elevation
  const currentPhase = recent[recent.length - 1]?.cyclePhase || null
  if (currentPhase) {
    const phaseData = phaseAnalysis.find(p => p.phase === currentPhase)
    const overallFlareRate = aligned.filter(d => d.isFlare).length / aligned.length

    if (phaseData && overallFlareRate > 0) {
      const phaseRiskMultiplier = phaseData.flareRate / overallFlareRate
      if (phaseRiskMultiplier > 1.3) {
        const weight = 0.2
        const risk = Math.min(1, (phaseRiskMultiplier - 1) / 2)
        weightedRiskScore += risk * weight
        totalWeight += weight

        const pctHigher = Math.round((phaseRiskMultiplier - 1) * 100)
        contributingFactors.push(
          `You are in your ${currentPhase} phase, which has a ${pctHigher}% higher flare rate than your overall average`
        )
      }
    }
  }

  // Signal 4: Recent symptom trend (rising pain or fatigue over last 3 days)
  const recentPain = recent.map(d => d.pain).filter((v): v is number => v !== null)
  if (recentPain.length >= 2) {
    const painTrend = recentPain[recentPain.length - 1] - recentPain[0]
    if (painTrend >= 2) {
      const weight = 0.15
      const risk = Math.min(1, painTrend / 5)
      weightedRiskScore += risk * weight
      totalWeight += weight

      contributingFactors.push(
        `Pain has increased by ${painTrend} points over the last ${recentPain.length} days`
      )
    }
  }

  // Normalize to 0-100%
  const rawRisk = totalWeight > 0 ? weightedRiskScore / totalWeight : 0
  // Apply a sigmoid-like scaling to avoid extreme probabilities with limited signals
  const riskPercent = Math.round(Math.min(95, Math.max(2, rawRisk * 100)))

  const riskLevel: 'low' | 'moderate' | 'high' =
    riskPercent < 30 ? 'low' : riskPercent < 60 ? 'moderate' : 'high'

  // Deduplicate contributing factors
  const uniqueFactors = [...new Set(contributingFactors)]

  return {
    riskPercent,
    riskLevel,
    contributingFactors: uniqueFactors,
    flareSignature: signature,
    phaseAnalysis,
    optimalLags,
    lastAssessed: new Date().toISOString(),
  }
}

// ── Original prediction function (preserved for backward compat) ────

/**
 * Predict near-term flare risk based on current biometric trends and identified patterns.
 * (Preserved from original implementation)
 */
export function predictFlareRisk(
  aligned: AlignedDay[],
  patterns: PrecursorPattern[]
): FlarePrediction | null {
  if (aligned.length < 7 || patterns.length === 0) return null

  const recent = aligned.slice(-3)
  const baseline = aligned.slice(-30, -3)

  if (baseline.length < 7) return null

  const baselineAvg: Record<string, number> = {}
  const metricKeys = ['hrv', 'restingHr', 'tempDeviation', 'sleepScore', 'readinessScore', 'spo2'] as const
  for (const key of metricKeys) {
    const values = baseline.map(d => d[key]).filter((v): v is number => v !== null)
    if (values.length > 0) {
      baselineAvg[key] = values.reduce((a, b) => a + b, 0) / values.length
    }
  }

  const signals: FlarePrediction['precursorSignals'] = []
  let riskScore = 0

  for (const pattern of patterns.slice(0, 5)) {
    const key = METRIC_KEY_MAP[pattern.metric]
    if (!key || !(key in baselineAvg)) continue

    const lagIndex = Math.max(0, recent.length - pattern.lagDays)
    const recentValue = recent[lagIndex]?.[key as keyof AlignedDay]
    if (typeof recentValue !== 'number') continue

    const baseValue = baselineAvg[key as string]
    const deviation = ((recentValue - baseValue) / Math.abs(baseValue || 1)) * 100

    signals.push({
      metric: pattern.metric,
      currentValue: recentValue,
      baselineValue: Math.round(baseValue * 10) / 10,
      deviationPercent: Math.round(deviation * 10) / 10,
    })

    const isDeviating = (pattern.direction === 'drop' && deviation < -5)
      || (pattern.direction === 'spike' && deviation > 5)
      || (pattern.direction === 'deviation' && Math.abs(deviation) > 5)

    if (isDeviating) {
      riskScore += Math.abs(pattern.correlationStrength) * 0.3
    }
  }

  const probability = Math.min(1, Math.max(0, riskScore))
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

// ── Phase-specific flare statistics (preserved from original) ───────

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
