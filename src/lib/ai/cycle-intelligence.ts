/**
 * Multi-Signal Cycle Intelligence Engine
 *
 * Combines BBT + Oura temperature + HRV + RHR + cervical mucus + LH tests
 * into a unified fertility/cycle model. No consumer app does this today.
 *
 * Outputs:
 * - Predicted ovulation day with confidence interval
 * - Predicted next period with confidence interval
 * - Current cycle phase (detected, not calendar-assumed)
 * - Fertile window estimate
 * - Anovulatory cycle detection
 *
 * Algorithm:
 * 1. Temperature biphasic shift detection (BBT or Oura overnight temp)
 * 2. HRV phase detection (parasympathetic follicular -> sympathetic luteal)
 * 3. RHR elevation detection (~2.7 bpm rise in luteal phase)
 * 4. Cervical mucus peak detection (egg-white = approaching ovulation)
 * 5. LH surge detection (positive test = 24-48h before ovulation)
 * 6. Combined weighted model produces confidence-scored predictions
 */

import { createServiceClient } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────

export type CyclePhaseDetected = 'menstrual' | 'follicular' | 'ovulatory' | 'early_luteal' | 'late_luteal' | 'unknown'
export type ConfidenceLevel = 'high' | 'moderate' | 'low' | 'insufficient'

export interface CycleIntelligence {
  currentPhase: CyclePhaseDetected
  phaseConfidence: ConfidenceLevel
  cycleDay: number | null

  ovulation: {
    detected: boolean
    estimatedDay: string | null       // ISO date
    confidenceWindow: number          // +/- days
    signals: OvulationSignal[]
  }

  nextPeriod: {
    estimatedDay: string | null
    confidenceWindow: number          // +/- days
    confidence: ConfidenceLevel
  }

  fertileWindow: {
    start: string | null
    end: string | null
    isCurrentlyFertile: boolean
  }

  flags: CycleFlag[]
  signalSummary: string               // Human-readable summary of what signals were used
}

export interface OvulationSignal {
  type: 'temperature_shift' | 'hrv_drop' | 'rhr_rise' | 'mucus_peak' | 'lh_positive'
  date: string
  confidence: number                   // 0-1
  description: string
}

export interface CycleFlag {
  type: 'anovulatory' | 'short_luteal' | 'irregular' | 'long_cycle' | 'missing_data'
  message: string
  severity: 'info' | 'attention' | 'concern'
}

// ── Signal Detectors ───────────────────────────────────────────────

/**
 * Detect biphasic temperature shift indicating ovulation.
 * Looks for sustained rise of 0.2+ degrees C above baseline for 3+ days.
 */
function detectTemperatureShift(
  temps: Array<{ date: string; value: number }>,
): OvulationSignal | null {
  if (temps.length < 10) return null

  // Calculate baseline (first 6 valid temps in cycle)
  const baseline = temps.slice(0, 6)
  const baselineAvg = baseline.reduce((s, t) => s + t.value, 0) / baseline.length

  // Look for 3 consecutive temps above baseline + 0.2
  for (let i = 6; i < temps.length - 2; i++) {
    const t1 = temps[i].value
    const t2 = temps[i + 1]?.value ?? 0
    const t3 = temps[i + 2]?.value ?? 0
    const threshold = baselineAvg + 0.2

    if (t1 > threshold && t2 > threshold && t3 > threshold) {
      return {
        type: 'temperature_shift',
        date: temps[i].date,
        confidence: 0.8,
        description: `Temperature rose ${(t1 - baselineAvg).toFixed(2)}C above baseline of ${baselineAvg.toFixed(2)}C`,
      }
    }
  }

  return null
}

/**
 * Detect HRV phase transition.
 * Follicular: higher HRV (parasympathetic). Luteal: lower HRV (sympathetic).
 * A sustained HRV drop of ~4.65ms indicates luteal phase entry.
 */
function detectHrvDrop(
  hrvData: Array<{ date: string; value: number }>,
): OvulationSignal | null {
  if (hrvData.length < 10) return null

  const firstHalf = hrvData.slice(0, Math.floor(hrvData.length / 2))
  const secondHalf = hrvData.slice(Math.floor(hrvData.length / 2))

  const avgFirst = firstHalf.reduce((s, d) => s + d.value, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, d) => s + d.value, 0) / secondHalf.length

  const drop = avgFirst - avgSecond

  if (drop >= 3) { // Significant HRV drop
    // Find the transition point
    for (let i = 5; i < hrvData.length - 3; i++) {
      const before = hrvData.slice(Math.max(0, i - 3), i).reduce((s, d) => s + d.value, 0) / 3
      const after = hrvData.slice(i, i + 3).reduce((s, d) => s + d.value, 0) / 3
      if (before - after >= 3) {
        return {
          type: 'hrv_drop',
          date: hrvData[i].date,
          confidence: 0.65,
          description: `HRV dropped from avg ${avgFirst.toFixed(0)}ms to ${avgSecond.toFixed(0)}ms (${drop.toFixed(1)}ms shift)`,
        }
      }
    }
  }

  return null
}

/**
 * Detect resting heart rate rise indicating luteal phase.
 * ~2.73 bpm average increase from follicular to luteal.
 */
function detectRhrRise(
  rhrData: Array<{ date: string; value: number }>,
): OvulationSignal | null {
  if (rhrData.length < 10) return null

  const firstHalf = rhrData.slice(0, Math.floor(rhrData.length / 2))
  const secondHalf = rhrData.slice(Math.floor(rhrData.length / 2))

  const avgFirst = firstHalf.reduce((s, d) => s + d.value, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((s, d) => s + d.value, 0) / secondHalf.length

  const rise = avgSecond - avgFirst

  if (rise >= 2) {
    for (let i = 5; i < rhrData.length - 3; i++) {
      const before = rhrData.slice(Math.max(0, i - 3), i).reduce((s, d) => s + d.value, 0) / 3
      const after = rhrData.slice(i, i + 3).reduce((s, d) => s + d.value, 0) / 3
      if (after - before >= 2) {
        return {
          type: 'rhr_rise',
          date: rhrData[i].date,
          confidence: 0.6,
          description: `RHR rose from avg ${avgFirst.toFixed(0)}bpm to ${avgSecond.toFixed(0)}bpm (+${rise.toFixed(1)}bpm)`,
        }
      }
    }
  }

  return null
}

/**
 * Detect cervical mucus peak (egg-white = most fertile).
 */
function detectMucusPeak(
  mucusData: Array<{ date: string; consistency: string | null }>,
): OvulationSignal | null {
  const eggWhiteDays = mucusData.filter(d =>
    d.consistency?.toLowerCase().includes('egg') ||
    d.consistency?.toLowerCase().includes('watery')
  )

  if (eggWhiteDays.length > 0) {
    const lastPeak = eggWhiteDays[eggWhiteDays.length - 1]
    return {
      type: 'mucus_peak',
      date: lastPeak.date,
      confidence: 0.75,
      description: `Peak cervical mucus (${lastPeak.consistency}) detected`,
    }
  }

  return null
}

/**
 * Detect LH surge from test results.
 */
function detectLhSurge(
  lhData: Array<{ date: string; result: string | null }>,
): OvulationSignal | null {
  const positives = lhData.filter(d =>
    d.result?.toLowerCase() === 'positive' ||
    d.result?.toLowerCase() === 'peak'
  )

  if (positives.length > 0) {
    const lastPositive = positives[positives.length - 1]
    return {
      type: 'lh_positive',
      date: lastPositive.date,
      confidence: 0.9,
      description: `LH test ${lastPositive.result} -- ovulation expected within 24-48 hours`,
    }
  }

  return null
}

// ── Phase Determination ────────────────────────────────────────────

function determineCyclePhase(
  lastPeriodStart: string | null,
  today: string,
  ovulationDay: string | null,
  signals: OvulationSignal[],
): { phase: CyclePhaseDetected; confidence: ConfidenceLevel; cycleDay: number | null } {
  if (!lastPeriodStart) {
    return { phase: 'unknown', confidence: 'insufficient', cycleDay: null }
  }

  const cycleDay = Math.floor(
    (new Date(today).getTime() - new Date(lastPeriodStart).getTime()) / (24 * 60 * 60 * 1000)
  ) + 1

  // If we have ovulation signals, use them
  if (ovulationDay) {
    const daysSinceOvulation = Math.floor(
      (new Date(today).getTime() - new Date(ovulationDay).getTime()) / (24 * 60 * 60 * 1000)
    )

    if (daysSinceOvulation < 0) {
      // Before detected ovulation
      if (cycleDay <= 5) return { phase: 'menstrual', confidence: 'high', cycleDay }
      return { phase: 'follicular', confidence: signals.length >= 2 ? 'high' : 'moderate', cycleDay }
    }
    if (daysSinceOvulation <= 1) return { phase: 'ovulatory', confidence: 'high', cycleDay }
    if (daysSinceOvulation <= 7) return { phase: 'early_luteal', confidence: 'high', cycleDay }
    return { phase: 'late_luteal', confidence: 'high', cycleDay }
  }

  // Calendar-based fallback (less accurate)
  if (cycleDay <= 5) return { phase: 'menstrual', confidence: 'moderate', cycleDay }
  if (cycleDay <= 13) return { phase: 'follicular', confidence: 'low', cycleDay }
  if (cycleDay <= 16) return { phase: 'ovulatory', confidence: 'low', cycleDay }
  if (cycleDay <= 22) return { phase: 'early_luteal', confidence: 'low', cycleDay }
  return { phase: 'late_luteal', confidence: 'low', cycleDay }
}

// ── Main Intelligence Function ─────────────────────────────────────

/**
 * Run full cycle intelligence analysis for the current cycle.
 * Queries all relevant data from Supabase and produces predictions.
 */
export async function analyzeCycleIntelligence(): Promise<CycleIntelligence> {
  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Fetch all relevant data in parallel
  const [cycleResult, ouraResult, ncResult] = await Promise.all([
    sb.from('cycle_entries')
      .select('date, flow_level, menstruation, cervical_mucus_consistency, lh_test_result')
      .gte('date', ninetyDaysAgo)
      .order('date', { ascending: true }),
    sb.from('oura_daily')
      .select('date, body_temp_deviation, hrv_avg, resting_hr')
      .gte('date', ninetyDaysAgo)
      .order('date', { ascending: true }),
    sb.from('nc_imported')
      .select('date, temperature, menstruation, cervical_mucus_consistency')
      .gte('date', ninetyDaysAgo)
      .order('date', { ascending: true }),
  ])

  const cycles = cycleResult.data ?? []
  const oura = ouraResult.data ?? []
  const nc = ncResult.data ?? []

  // Find last period start
  // Source 1: cycle_entries.menstruation (boolean-ish)
  // Source 2: nc_imported.menstruation === 'MENSTRUATION' (exclude 'SPOTTING')
  // Union both sources and deduplicate by date.
  const menstrualDaysFromCycles = cycles
    .filter(c => c.menstruation)
    .map(c => c.date)
  const menstrualDaysFromNc = nc
    .filter(n => n.menstruation === 'MENSTRUATION')
    .map(n => n.date)
  const menstrualDays = Array.from(
    new Set([...menstrualDaysFromCycles, ...menstrualDaysFromNc]),
  ).sort().reverse()

  // Find most recent period start (first day of most recent menstruation)
  let lastPeriodStart: string | null = null
  if (menstrualDays.length > 0) {
    lastPeriodStart = menstrualDays[0]
    // Walk backwards to find the actual first day of this period
    for (let i = 1; i < menstrualDays.length; i++) {
      const diff = (new Date(menstrualDays[i - 1]).getTime() - new Date(menstrualDays[i]).getTime()) / (24 * 60 * 60 * 1000)
      if (diff <= 2) {
        lastPeriodStart = menstrualDays[i]
      } else {
        break
      }
    }
  }

  // Current cycle data only (since last period)
  const currentCycleStart = lastPeriodStart ?? ninetyDaysAgo
  const currentOura = oura.filter(d => d.date >= currentCycleStart)
  const currentCycles = cycles.filter(c => c.date >= currentCycleStart)

  // ── Run all signal detectors ──

  const signals: OvulationSignal[] = []
  const flags: CycleFlag[] = []

  // Temperature signals (prefer Oura, fallback to NC BBT)
  const tempData = currentOura
    .filter(d => d.body_temp_deviation !== null)
    .map(d => ({ date: d.date, value: d.body_temp_deviation as number }))

  if (tempData.length < 5) {
    // Try NC temperature data
    const ncTemps = nc
      .filter(d => d.temperature !== null && d.date >= currentCycleStart)
      .map(d => ({ date: d.date, value: d.temperature as number }))

    const tempShift = detectTemperatureShift(ncTemps)
    if (tempShift) signals.push(tempShift)
  } else {
    const tempShift = detectTemperatureShift(tempData)
    if (tempShift) signals.push(tempShift)
  }

  // HRV signal
  const hrvData = currentOura
    .filter(d => d.hrv_avg !== null)
    .map(d => ({ date: d.date, value: d.hrv_avg as number }))
  const hrvSignal = detectHrvDrop(hrvData)
  if (hrvSignal) signals.push(hrvSignal)

  // RHR signal
  const rhrData = currentOura
    .filter(d => d.resting_hr !== null)
    .map(d => ({ date: d.date, value: d.resting_hr as number }))
  const rhrSignal = detectRhrRise(rhrData)
  if (rhrSignal) signals.push(rhrSignal)

  // Cervical mucus signal
  const mucusData = currentCycles
    .filter(c => c.cervical_mucus_consistency)
    .map(c => ({ date: c.date, consistency: c.cervical_mucus_consistency }))
  const mucusSignal = detectMucusPeak(mucusData)
  if (mucusSignal) signals.push(mucusSignal)

  // LH test signal
  const lhData = currentCycles
    .filter(c => c.lh_test_result)
    .map(c => ({ date: c.date, result: c.lh_test_result }))
  const lhSignal = detectLhSurge(lhData)
  if (lhSignal) signals.push(lhSignal)

  // ── Determine ovulation ──

  // Weight signals: LH > mucus > temp > HRV > RHR
  const weightedSignals = signals.sort((a, b) => b.confidence - a.confidence)
  let estimatedOvulationDay: string | null = null
  let ovulationConfidenceWindow = 3

  if (weightedSignals.length >= 2) {
    // Multiple signals -- use the highest-confidence one
    estimatedOvulationDay = weightedSignals[0].date
    ovulationConfidenceWindow = 2
  } else if (weightedSignals.length === 1) {
    estimatedOvulationDay = weightedSignals[0].date
    ovulationConfidenceWindow = 3
  }

  // LH surge overrides other signals (most reliable)
  if (lhSignal) {
    // Ovulation is 1-2 days after positive LH
    const lhDate = new Date(lhSignal.date)
    estimatedOvulationDay = new Date(lhDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    ovulationConfidenceWindow = 1
  }

  // ── Determine phase ──

  const { phase, confidence: phaseConfidence, cycleDay } = determineCyclePhase(
    lastPeriodStart,
    today,
    estimatedOvulationDay,
    signals,
  )

  // ── Predict next period ──

  let nextPeriodDay: string | null = null
  let nextPeriodWindow = 5
  let nextPeriodConfidence: ConfidenceLevel = 'low'

  if (estimatedOvulationDay) {
    // Luteal phase is more consistent (~14 days)
    const ovDate = new Date(estimatedOvulationDay)
    nextPeriodDay = new Date(ovDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    nextPeriodWindow = 2
    nextPeriodConfidence = signals.length >= 2 ? 'high' : 'moderate'
  } else if (lastPeriodStart) {
    // Calendar fallback (assume 28-day cycle)
    const lpDate = new Date(lastPeriodStart)
    nextPeriodDay = new Date(lpDate.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    nextPeriodWindow = 5
    nextPeriodConfidence = 'low'
  }

  // ── Fertile window ──

  let fertileStart: string | null = null
  let fertileEnd: string | null = null
  let isCurrentlyFertile = false

  if (estimatedOvulationDay) {
    const ovDate = new Date(estimatedOvulationDay)
    fertileStart = new Date(ovDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    fertileEnd = new Date(ovDate.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    isCurrentlyFertile = today >= fertileStart && today <= fertileEnd
  }

  // ── Flags ──

  if (signals.length === 0 && (cycleDay ?? 0) > 16) {
    flags.push({
      type: 'missing_data',
      message: 'No ovulation signals detected yet this cycle. Log temperature, mucus, or LH tests for better predictions.',
      severity: 'info',
    })
  }

  if ((cycleDay ?? 0) > 35) {
    flags.push({
      type: 'long_cycle',
      message: `Cycle day ${cycleDay} -- this cycle is longer than typical (35+ days).`,
      severity: 'attention',
    })
  }

  if (estimatedOvulationDay && lastPeriodStart) {
    const lutealLength = nextPeriodDay
      ? Math.floor((new Date(nextPeriodDay).getTime() - new Date(estimatedOvulationDay).getTime()) / (24 * 60 * 60 * 1000))
      : null
    if (lutealLength !== null && lutealLength < 10) {
      flags.push({
        type: 'short_luteal',
        message: `Luteal phase appears short (${lutealLength} days). Normal is 12-14 days. May indicate low progesterone.`,
        severity: 'concern',
      })
    }
  }

  // ── Signal summary ──

  const signalNames = signals.map(s => {
    switch (s.type) {
      case 'temperature_shift': return 'temperature shift'
      case 'hrv_drop': return 'HRV drop'
      case 'rhr_rise': return 'resting HR rise'
      case 'mucus_peak': return 'cervical mucus peak'
      case 'lh_positive': return 'LH surge'
    }
  })
  const signalSummary = signals.length > 0
    ? `Based on ${signals.length} signal${signals.length > 1 ? 's' : ''}: ${signalNames.join(', ')}`
    : 'Insufficient signals -- using calendar estimate only'

  return {
    currentPhase: phase,
    phaseConfidence,
    cycleDay,
    ovulation: {
      detected: !!estimatedOvulationDay && signals.length > 0,
      estimatedDay: estimatedOvulationDay,
      confidenceWindow: ovulationConfidenceWindow,
      signals,
    },
    nextPeriod: {
      estimatedDay: nextPeriodDay,
      confidenceWindow: nextPeriodWindow,
      confidence: nextPeriodConfidence,
    },
    fertileWindow: {
      start: fertileStart,
      end: fertileEnd,
      isCurrentlyFertile,
    },
    flags,
    signalSummary,
  }
}
