/**
 * Sleep Derived Metrics
 *
 * Calculates advanced sleep metrics that no single wearable provides:
 * - Sleep Debt: accumulated deficit from target
 * - Sleep Consistency: bed/wake time regularity (WHOOP-style)
 * - Unrefreshing Sleep Index: adequate duration + low subjective quality
 * - Sleep Need: dynamic estimate based on activity + debt + cycle phase
 */

export interface SleepDayData {
  date: string
  totalMinutes: number | null
  sleepScore: number | null
  bedtime: string | null          // "HH:MM" format
  wakeTime: string | null         // "HH:MM" format
  deepMinutes: number | null
  remMinutes: number | null
  subjectiveQuality: number | null // 1-5 user rating
}

export interface SleepDerivedMetrics {
  sleepDebt: {
    currentDebtMinutes: number
    debtTrend: 'accumulating' | 'recovering' | 'stable'
    daysToRecover: number | null  // At current recovery rate
  }
  consistency: {
    score: number                  // 0-100
    avgBedtime: string | null
    avgWakeTime: string | null
    bedtimeVarianceMinutes: number
    wakeVarianceMinutes: number
  }
  unrefreshingIndex: {
    score: number                  // 0-10 (10 = very unrefreshing)
    daysWithUnrefreshingSleep: number
    totalDays: number
  }
  sleepNeed: {
    estimatedMinutes: number       // Personalized target
    factors: string[]              // What's increasing/decreasing the need
  }
}

/**
 * Calculate all derived sleep metrics from historical data.
 */
export function calculateSleepMetrics(
  data: SleepDayData[],
  options?: {
    targetMinutes?: number         // Default: 480 (8 hours)
    activityLevel?: 'low' | 'moderate' | 'high'
    cyclePhase?: string | null
    isRecovering?: boolean         // From illness/flare
  },
): SleepDerivedMetrics {
  const target = options?.targetMinutes ?? 480
  const last14 = data.slice(-14)
  const last7 = data.slice(-7)

  // ── Sleep Debt ───────────────────────────────────────────────────
  let debtMinutes = 0
  for (const day of last14) {
    if (day.totalMinutes !== null) {
      debtMinutes += target - day.totalMinutes
    }
  }
  debtMinutes = Math.max(0, debtMinutes) // Can't have negative debt

  // Trend: compare first 7 days debt vs last 7 days
  const firstWeekDebt = last14.slice(0, 7).reduce((sum, d) => {
    return sum + (d.totalMinutes !== null ? Math.max(0, target - d.totalMinutes) : 0)
  }, 0)
  const secondWeekDebt = last7.reduce((sum, d) => {
    return sum + (d.totalMinutes !== null ? Math.max(0, target - d.totalMinutes) : 0)
  }, 0)

  let debtTrend: 'accumulating' | 'recovering' | 'stable' = 'stable'
  if (secondWeekDebt > firstWeekDebt * 1.2) debtTrend = 'accumulating'
  else if (secondWeekDebt < firstWeekDebt * 0.8) debtTrend = 'recovering'

  // Recovery estimate: at current rate, how many days to pay off debt?
  const avgDailyRecovery = firstWeekDebt > secondWeekDebt
    ? (firstWeekDebt - secondWeekDebt) / 7
    : 0
  const daysToRecover = avgDailyRecovery > 0
    ? Math.ceil(debtMinutes / avgDailyRecovery)
    : null

  // ── Sleep Consistency ────────────────────────────────────────────
  const bedtimeMinutes: number[] = []
  const wakeMinutes: number[] = []

  for (const day of last7) {
    if (day.bedtime) {
      const [h, m] = day.bedtime.split(':').map(Number)
      // Normalize: bedtimes after midnight are 24+ hours
      bedtimeMinutes.push(h < 12 ? (h + 24) * 60 + m : h * 60 + m)
    }
    if (day.wakeTime) {
      const [h, m] = day.wakeTime.split(':').map(Number)
      wakeMinutes.push(h * 60 + m)
    }
  }

  const avgBedMin = bedtimeMinutes.length > 0
    ? bedtimeMinutes.reduce((a, b) => a + b, 0) / bedtimeMinutes.length
    : null
  const avgWakeMin = wakeMinutes.length > 0
    ? wakeMinutes.reduce((a, b) => a + b, 0) / wakeMinutes.length
    : null

  const bedVariance = bedtimeMinutes.length > 1
    ? Math.sqrt(bedtimeMinutes.reduce((sum, v) => sum + Math.pow(v - (avgBedMin ?? 0), 2), 0) / bedtimeMinutes.length)
    : 0
  const wakeVariance = wakeMinutes.length > 1
    ? Math.sqrt(wakeMinutes.reduce((sum, v) => sum + Math.pow(v - (avgWakeMin ?? 0), 2), 0) / wakeMinutes.length)
    : 0

  // Consistency score: 100 = perfectly consistent, 0 = wildly variable
  const totalVariance = bedVariance + wakeVariance
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - totalVariance / 2)))

  const formatMinToTime = (min: number | null) => {
    if (min === null) return null
    const normalizedMin = min >= 1440 ? min - 1440 : min
    const h = Math.floor(normalizedMin / 60)
    const m = Math.round(normalizedMin % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  // ── Unrefreshing Sleep Index ─────────────────────────────────────
  // Adequate duration (7+ hours) but low subjective quality or low sleep score
  let unrefreshingDays = 0
  for (const day of last14) {
    const adequate = (day.totalMinutes ?? 0) >= 420 // 7 hours
    const lowQuality = (day.subjectiveQuality !== null && day.subjectiveQuality <= 2) ||
      (day.sleepScore !== null && day.sleepScore < 60)

    if (adequate && lowQuality) unrefreshingDays++
  }

  const unrefreshingScore = last14.length > 0
    ? Math.round(unrefreshingDays / last14.length * 10)
    : 0

  // ── Sleep Need ───────────────────────────────────────────────────
  let needMinutes = target
  const factors: string[] = []

  // Activity level adjustment
  if (options?.activityLevel === 'high') {
    needMinutes += 30
    factors.push('High activity (+30min)')
  }

  // Sleep debt recovery
  if (debtMinutes > 120) {
    needMinutes += 30
    factors.push('Sleep debt recovery (+30min)')
  }

  // Cycle phase (luteal = more sleep needed)
  if (options?.cyclePhase === 'luteal') {
    needMinutes += 15
    factors.push('Luteal phase (+15min)')
  } else if (options?.cyclePhase === 'menstrual') {
    needMinutes += 20
    factors.push('Menstrual phase (+20min)')
  }

  // Recovery from illness/flare
  if (options?.isRecovering) {
    needMinutes += 60
    factors.push('Recovery from flare (+60min)')
  }

  if (factors.length === 0) {
    factors.push('Standard baseline')
  }

  return {
    sleepDebt: {
      currentDebtMinutes: Math.round(debtMinutes),
      debtTrend,
      daysToRecover,
    },
    consistency: {
      score: consistencyScore,
      avgBedtime: formatMinToTime(avgBedMin),
      avgWakeTime: formatMinToTime(avgWakeMin),
      bedtimeVarianceMinutes: Math.round(bedVariance),
      wakeVarianceMinutes: Math.round(wakeVariance),
    },
    unrefreshingIndex: {
      score: unrefreshingScore,
      daysWithUnrefreshingSleep: unrefreshingDays,
      totalDays: last14.length,
    },
    sleepNeed: {
      estimatedMinutes: needMinutes,
      factors,
    },
  }
}
