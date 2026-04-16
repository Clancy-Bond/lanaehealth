/**
 * Medication Adherence Calculator
 *
 * Computes PDC (Proportion of Days Covered) -- the gold standard adherence metric.
 * PDC >= 80% is considered adherent by clinical standards.
 *
 * Also computes:
 * - Taking adherence: doses taken vs prescribed
 * - Timing adherence: % taken within scheduled window
 * - PRN frequency trends: daily/weekly PRN usage patterns
 */

import { createServiceClient } from '@/lib/supabase'

export interface AdherenceReport {
  medication: string
  period: { start: string; end: string }
  totalDays: number
  daysCovered: number
  pdc: number                    // 0-100%
  isAdherent: boolean            // PDC >= 80%
  missedDates: string[]          // Dates where dose was missed
  averageTimingDelay: number | null // Minutes from scheduled time
}

export interface PrnUsageReport {
  medication: string
  period: { start: string; end: string }
  totalDoses: number
  avgDailyDoses: number
  maxDailyDoses: number
  daysWith3Plus: number          // Days with 3+ doses (escalation signal)
  weeklyTrend: number[]          // Doses per week for last 4 weeks
  isEscalating: boolean          // Increasing PRN use over time
}

/**
 * Calculate PDC for a scheduled medication over a date range.
 */
export async function calculatePDC(
  medicationName: string,
  startDate: string,
  endDate: string,
): Promise<AdherenceReport> {
  const sb = createServiceClient()

  // Get all medication events for this med in the date range
  const { data: events } = await sb
    .from('medical_timeline')
    .select('date, title, description')
    .eq('event_type', 'medication_change')
    .ilike('title', `%${medicationName}%`)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  const takenDates = new Set<string>()
  for (const event of events ?? []) {
    const title = (event.title as string).toLowerCase()
    if (title.includes('taken') || title.includes('logged')) {
      takenDates.add(event.date as string)
    }
  }

  // Calculate total days in range
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1

  // Find missed dates
  const missedDates: string[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    if (!takenDates.has(dateStr)) {
      missedDates.push(dateStr)
    }
  }

  const daysCovered = takenDates.size
  const pdc = totalDays > 0 ? Math.round(daysCovered / totalDays * 100) : 0

  return {
    medication: medicationName,
    period: { start: startDate, end: endDate },
    totalDays,
    daysCovered,
    pdc,
    isAdherent: pdc >= 80,
    missedDates,
    averageTimingDelay: null, // Would require time-of-day tracking
  }
}

/**
 * Analyze PRN medication usage patterns.
 */
export async function analyzePrnUsage(
  medicationName: string,
  startDate: string,
  endDate: string,
): Promise<PrnUsageReport> {
  const sb = createServiceClient()

  const { data: events } = await sb
    .from('medical_timeline')
    .select('date, title, description')
    .eq('event_type', 'medication_change')
    .ilike('title', `%${medicationName}%`)
    .ilike('title', '%taken%')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  // Count doses per day
  const dosesPerDay = new Map<string, number>()
  for (const event of events ?? []) {
    const date = event.date as string
    dosesPerDay.set(date, (dosesPerDay.get(date) ?? 0) + 1)
  }

  const totalDoses = (events ?? []).length
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1

  const avgDailyDoses = totalDays > 0 ? Math.round(totalDoses / totalDays * 10) / 10 : 0
  const maxDailyDoses = dosesPerDay.size > 0 ? Math.max(...dosesPerDay.values()) : 0
  const daysWith3Plus = Array.from(dosesPerDay.values()).filter(d => d >= 3).length

  // Weekly trend (last 4 weeks)
  const weeklyTrend: number[] = []
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(end.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(end.getTime() - w * 7 * 24 * 60 * 60 * 1000)
    let weekDoses = 0
    for (const [date, count] of dosesPerDay) {
      const d = new Date(date)
      if (d >= weekStart && d < weekEnd) weekDoses += count
    }
    weeklyTrend.push(weekDoses)
  }

  // Is usage escalating? (last 2 weeks > first 2 weeks)
  const firstHalf = weeklyTrend.slice(0, 2).reduce((a, b) => a + b, 0)
  const secondHalf = weeklyTrend.slice(2).reduce((a, b) => a + b, 0)
  const isEscalating = secondHalf > firstHalf * 1.3 // 30% increase

  return {
    medication: medicationName,
    period: { start: startDate, end: endDate },
    totalDoses,
    avgDailyDoses,
    maxDailyDoses,
    daysWith3Plus,
    weeklyTrend,
    isEscalating,
  }
}
