/**
 * PRN Medication Intelligence
 *
 * First-class tracking for as-needed medications.
 * Most medication apps treat PRN as an afterthought -- we make it a key feature.
 *
 * Features:
 * - Time-since-last-dose (always visible)
 * - Max daily dose warnings with countdown
 * - Frequency trend analysis (escalation detection)
 * - PRN-to-symptom correlation (which symptoms trigger PRN use)
 * - Cycle phase PRN patterns
 */

import { createServiceClient } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────

export interface PrnDoseStatus {
  medicationName: string
  lastDoseAt: string | null        // ISO datetime
  timeSinceLastDose: string | null // Human-readable: "2h 15m ago"
  timeSinceMinutes: number | null
  dosesToday: number
  maxDailyDoses: number | null
  remainingDoses: number | null
  isAtLimit: boolean
  canTakeNext: boolean
  nextSafeTime: string | null      // When they can take the next dose
  minTimeBetweenDoses: number      // Minutes
}

export interface PrnFrequencyAnalysis {
  medicationName: string
  period: string
  dailyAverage: number
  weeklyTrend: number[]            // Last 4 weeks
  isEscalating: boolean
  escalationRate: number | null    // % increase per week
  peakDayOfWeek: string | null     // "Monday", "Friday", etc.
  peakTimeOfDay: string | null     // "morning", "afternoon", "evening"
  correlatedSymptoms: Array<{
    symptom: string
    correlation: number            // 0-1
  }>
  cyclePhasePattern: Record<string, number> | null  // avg doses per phase
}

// ── Configuration ──────────────────────────────────────────────────

interface PrnConfig {
  maxDailyDosesMg: number
  doseAmountMg: number
  minHoursBetween: number
}

const PRN_CONFIGS: Record<string, PrnConfig> = {
  'tylenol': { maxDailyDosesMg: 4000, doseAmountMg: 500, minHoursBetween: 4 },
  'acetaminophen': { maxDailyDosesMg: 4000, doseAmountMg: 500, minHoursBetween: 4 },
  'ibuprofen': { maxDailyDosesMg: 1200, doseAmountMg: 400, minHoursBetween: 6 },
  'advil': { maxDailyDosesMg: 1200, doseAmountMg: 200, minHoursBetween: 6 },
  'naproxen': { maxDailyDosesMg: 1000, doseAmountMg: 250, minHoursBetween: 8 },
  'aleve': { maxDailyDosesMg: 1000, doseAmountMg: 220, minHoursBetween: 12 },
  'tums': { maxDailyDosesMg: 7500, doseAmountMg: 750, minHoursBetween: 1 },
  'benadryl': { maxDailyDosesMg: 300, doseAmountMg: 25, minHoursBetween: 4 },
  'melatonin': { maxDailyDosesMg: 10, doseAmountMg: 3, minHoursBetween: 24 },
}

// ── Helper Functions ───────────────────────────────────────────────

function formatTimeSince(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return `${hours}h ${mins}m ago`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h ago`
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ── Core Functions ─────────────────────────────────────────────────

/**
 * Get real-time PRN dose status for a medication.
 */
export async function getPrnDoseStatus(medicationName: string): Promise<PrnDoseStatus> {
  const sb = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const nameLower = medicationName.toLowerCase()
  const config = PRN_CONFIGS[nameLower]

  // Get today's doses
  const { data: todayDoses } = await sb
    .from('medical_timeline')
    .select('date, title, description')
    .eq('date', today)
    .ilike('title', `%${medicationName}%taken%`)
    .order('date', { ascending: false })

  const dosesToday = todayDoses?.length ?? 0
  const maxDailyDoses = config
    ? Math.floor(config.maxDailyDosesMg / config.doseAmountMg)
    : null

  // Get last dose time (from description which includes time)
  let lastDoseAt: string | null = null
  let timeSinceMinutes: number | null = null

  if (todayDoses && todayDoses.length > 0) {
    const lastDesc = todayDoses[0].description as string
    const timeMatch = lastDesc?.match(/Logged at (\d{1,2}:\d{2}:\d{2} [AP]M)/)
    if (timeMatch) {
      lastDoseAt = `${today}T${timeMatch[1]}`
    }
  }

  if (!lastDoseAt) {
    // Check yesterday too
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: yesterdayDoses } = await sb
      .from('medical_timeline')
      .select('date, description')
      .eq('date', yesterday)
      .ilike('title', `%${medicationName}%taken%`)
      .order('date', { ascending: false })
      .limit(1)

    if (yesterdayDoses && yesterdayDoses.length > 0) {
      lastDoseAt = yesterday
    }
  }

  if (lastDoseAt) {
    timeSinceMinutes = Math.floor((Date.now() - new Date(lastDoseAt).getTime()) / (60 * 1000))
  }

  const minTimeBetween = config ? config.minHoursBetween * 60 : 240 // Default 4 hours
  const canTakeNext = timeSinceMinutes === null || timeSinceMinutes >= minTimeBetween
  const isAtLimit = maxDailyDoses !== null && dosesToday >= maxDailyDoses

  let nextSafeTime: string | null = null
  if (!canTakeNext && lastDoseAt) {
    const nextTime = new Date(new Date(lastDoseAt).getTime() + minTimeBetween * 60 * 1000)
    nextSafeTime = nextTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return {
    medicationName,
    lastDoseAt,
    timeSinceLastDose: timeSinceMinutes !== null ? formatTimeSince(timeSinceMinutes) : null,
    timeSinceMinutes,
    dosesToday,
    maxDailyDoses,
    remainingDoses: maxDailyDoses !== null ? Math.max(0, maxDailyDoses - dosesToday) : null,
    isAtLimit,
    canTakeNext: canTakeNext && !isAtLimit,
    nextSafeTime: isAtLimit ? 'Daily limit reached' : nextSafeTime,
    minTimeBetweenDoses: minTimeBetween,
  }
}

/**
 * Analyze PRN usage frequency and patterns over 30 days.
 */
export async function analyzePrnFrequency(medicationName: string): Promise<PrnFrequencyAnalysis> {
  const sb = createServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: doses } = await sb
    .from('medical_timeline')
    .select('date, description')
    .ilike('title', `%${medicationName}%taken%`)
    .gte('date', thirtyDaysAgo)
    .order('date')

  const { data: dailyLogs } = await sb
    .from('daily_logs')
    .select('date, overall_pain, fatigue, bloating, stress, cycle_phase')
    .gte('date', thirtyDaysAgo)

  // Count doses per day
  const dosesPerDay = new Map<string, number>()
  for (const dose of doses ?? []) {
    const date = dose.date as string
    dosesPerDay.set(date, (dosesPerDay.get(date) ?? 0) + 1)
  }

  const totalDoses = doses?.length ?? 0
  const dailyAverage = Math.round(totalDoses / 30 * 10) / 10

  // Weekly trend
  const weeklyTrend: number[] = []
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(Date.now() - (w + 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000)
    let count = 0
    for (const [date, n] of dosesPerDay) {
      const d = new Date(date)
      if (d >= weekStart && d < weekEnd) count += n
    }
    weeklyTrend.push(count)
  }

  const firstTwo = weeklyTrend.slice(0, 2).reduce((a, b) => a + b, 0)
  const lastTwo = weeklyTrend.slice(2).reduce((a, b) => a + b, 0)
  const isEscalating = lastTwo > firstTwo * 1.3
  const escalationRate = firstTwo > 0
    ? Math.round((lastTwo - firstTwo) / firstTwo * 100)
    : null

  // Peak day of week
  const dayOfWeekCounts = new Array(7).fill(0)
  for (const [date, count] of dosesPerDay) {
    const day = new Date(date).getDay()
    dayOfWeekCounts[day] += count
  }
  const peakDay = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts))
  const peakDayOfWeek = totalDoses > 5 ? DAY_NAMES[peakDay] : null

  // Symptom correlation
  const correlatedSymptoms: Array<{ symptom: string; correlation: number }> = []
  if (dailyLogs && dailyLogs.length > 0) {
    const symptoms = ['overall_pain', 'fatigue', 'bloating', 'stress'] as const
    for (const symptom of symptoms) {
      const daysWithPrn = (dailyLogs ?? []).filter(l => dosesPerDay.has(l.date))
      const daysWithoutPrn = (dailyLogs ?? []).filter(l => !dosesPerDay.has(l.date))

      const avgWithPrn = daysWithPrn.length > 0
        ? daysWithPrn.reduce((s, l) => s + ((l[symptom] as number) ?? 0), 0) / daysWithPrn.length
        : 0
      const avgWithout = daysWithoutPrn.length > 0
        ? daysWithoutPrn.reduce((s, l) => s + ((l[symptom] as number) ?? 0), 0) / daysWithoutPrn.length
        : 0

      const diff = avgWithPrn - avgWithout
      if (diff > 1) {
        correlatedSymptoms.push({
          symptom: symptom.replace('overall_', ''),
          correlation: Math.min(1, Math.round(diff / 5 * 100) / 100),
        })
      }
    }
  }

  // Cycle phase pattern
  let cyclePhasePattern: Record<string, number> | null = null
  if (dailyLogs && dailyLogs.some(l => l.cycle_phase)) {
    const phaseCounts: Record<string, { doses: number; days: number }> = {}
    for (const log of dailyLogs ?? []) {
      if (!log.cycle_phase) continue
      if (!phaseCounts[log.cycle_phase]) phaseCounts[log.cycle_phase] = { doses: 0, days: 0 }
      phaseCounts[log.cycle_phase].days++
      phaseCounts[log.cycle_phase].doses += dosesPerDay.get(log.date) ?? 0
    }
    cyclePhasePattern = {}
    for (const [phase, counts] of Object.entries(phaseCounts)) {
      cyclePhasePattern[phase] = counts.days > 0
        ? Math.round(counts.doses / counts.days * 10) / 10
        : 0
    }
  }

  return {
    medicationName,
    period: '30 days',
    dailyAverage,
    weeklyTrend,
    isEscalating,
    escalationRate,
    peakDayOfWeek,
    peakTimeOfDay: null, // Would need time-of-day tracking
    correlatedSymptoms: correlatedSymptoms.sort((a, b) => b.correlation - a.correlation),
    cyclePhasePattern,
  }
}
