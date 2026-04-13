// Aggregates data across all tables for a date range
import { getDailyLogs } from '@/lib/api/logs'
import { getOuraData } from '@/lib/api/oura'
import { getCycleEntries } from '@/lib/api/cycle'
import { getLabResults } from '@/lib/api/labs'
import { getAppointments } from '@/lib/api/appointments'
import { supabase } from '@/lib/supabase'
import type { DailyLog, OuraDaily, CycleEntry, LabResult, Appointment, Symptom, PainPoint, FoodEntry } from '@/lib/types'

export interface ReportData {
  startDate: string
  endDate: string
  dailyLogs: DailyLog[]
  symptoms: Symptom[]
  painPoints: PainPoint[]
  ouraData: OuraDaily[]
  cycleEntries: CycleEntry[]
  labResults: LabResult[]
  appointments: Appointment[]
  foodEntries: FoodEntry[]
  summary: ReportSummary
}

export interface ReportSummary {
  totalDaysLogged: number
  avgPain: number | null
  maxPain: number | null
  avgFatigue: number | null
  avgSleepScore: number | null
  avgHrv: number | null
  avgRestingHr: number | null
  avgTempDeviation: number | null
  topSymptoms: { symptom: string; count: number }[]
  topPainRegions: { region: string; count: number; avgIntensity: number }[]
  topTriggers: { trigger: string; count: number }[]
  periodDays: number
  avgCycleLength: number | null
}

/**
 * Aggregate all data for a report date range
 */
export async function getReportData(startDate: string, endDate: string): Promise<ReportData> {
  // Fetch all data in parallel
  const [dailyLogs, ouraData, cycleEntries, labResults, appointments] = await Promise.all([
    getDailyLogs(startDate, endDate),
    getOuraData(startDate, endDate),
    getCycleEntries(startDate, endDate),
    getLabResults(startDate, endDate),
    getAppointments(),
  ])

  // Get symptoms and pain points for all logged days
  const logIds = dailyLogs.map((l) => l.id)
  let symptoms: Symptom[] = []
  let painPoints: PainPoint[] = []
  let foodEntries: FoodEntry[] = []

  if (logIds.length > 0) {
    const [sympRes, painRes, foodRes] = await Promise.all([
      supabase.from('symptoms').select('*').in('log_id', logIds),
      supabase.from('pain_points').select('*').in('log_id', logIds),
      supabase.from('food_entries').select('*').in('log_id', logIds),
    ])
    symptoms = (sympRes.data || []) as Symptom[]
    painPoints = (painRes.data || []) as PainPoint[]
    foodEntries = (foodRes.data || []) as FoodEntry[]
  }

  // Filter appointments to date range
  const filteredAppointments = appointments.filter(
    (a) => a.date >= startDate && a.date <= endDate
  )

  // Compute summary
  const summary = computeSummary(dailyLogs, symptoms, painPoints, ouraData, cycleEntries, foodEntries)

  return {
    startDate,
    endDate,
    dailyLogs,
    symptoms,
    painPoints,
    ouraData,
    cycleEntries,
    labResults,
    appointments: filteredAppointments,
    foodEntries,
    summary,
  }
}

function computeSummary(
  logs: DailyLog[],
  symptoms: Symptom[],
  painPoints: PainPoint[],
  oura: OuraDaily[],
  cycles: CycleEntry[],
  food: FoodEntry[]
): ReportSummary {
  const painValues = logs.map((l) => l.overall_pain).filter((v): v is number => v != null)
  const fatigueValues = logs.map((l) => l.fatigue).filter((v): v is number => v != null)
  const sleepScores = oura.map((o) => o.sleep_score).filter((v): v is number => v != null)
  const hrvValues = oura.map((o) => o.hrv_avg).filter((v): v is number => v != null)
  const hrValues = oura.map((o) => o.resting_hr).filter((v): v is number => v != null)
  const tempValues = oura.map((o) => o.body_temp_deviation).filter((v): v is number => v != null)

  function avg(arr: number[]): number | null {
    if (arr.length === 0) return null
    return +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
  }

  // Top symptoms
  const symptomCounts: Record<string, number> = {}
  for (const s of symptoms) {
    symptomCounts[s.symptom] = (symptomCounts[s.symptom] || 0) + 1
  }
  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([symptom, count]) => ({ symptom, count }))

  // Top pain regions
  const regionMap: Record<string, { count: number; totalIntensity: number }> = {}
  for (const p of painPoints) {
    if (!regionMap[p.body_region]) regionMap[p.body_region] = { count: 0, totalIntensity: 0 }
    regionMap[p.body_region].count++
    regionMap[p.body_region].totalIntensity += p.intensity
  }
  const topPainRegions = Object.entries(regionMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([region, data]) => ({
      region,
      count: data.count,
      avgIntensity: +(data.totalIntensity / data.count).toFixed(1),
    }))

  // Top food triggers
  const triggerCounts: Record<string, number> = {}
  for (const f of food) {
    for (const t of (f.flagged_triggers || [])) {
      triggerCounts[t] = (triggerCounts[t] || 0) + 1
    }
  }
  const topTriggers = Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([trigger, count]) => ({ trigger, count }))

  // Period days
  const periodDays = cycles.filter((c) => c.menstruation).length

  // Avg cycle length (simplified)
  const periodStarts = findPeriodStarts(cycles)
  let avgCycleLength: number | null = null
  if (periodStarts.length >= 2) {
    const lengths: number[] = []
    for (let i = 1; i < periodStarts.length; i++) {
      const diff = Math.round(
        (new Date(periodStarts[i]).getTime() - new Date(periodStarts[i - 1]).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diff >= 21 && diff <= 45) lengths.push(diff)
    }
    avgCycleLength = lengths.length > 0 ? avg(lengths) : null
  }

  return {
    totalDaysLogged: logs.length,
    avgPain: avg(painValues),
    maxPain: painValues.length > 0 ? Math.max(...painValues) : null,
    avgFatigue: avg(fatigueValues),
    avgSleepScore: avg(sleepScores),
    avgHrv: avg(hrvValues),
    avgRestingHr: avg(hrValues),
    avgTempDeviation: avg(tempValues),
    topSymptoms,
    topPainRegions,
    topTriggers,
    periodDays,
    avgCycleLength,
  }
}

function findPeriodStarts(entries: CycleEntry[]): string[] {
  const sorted = entries
    .filter((e) => e.menstruation)
    .sort((a, b) => a.date.localeCompare(b.date))

  const starts: string[] = []
  let prevDate: string | null = null

  for (const entry of sorted) {
    if (!prevDate) {
      starts.push(entry.date)
    } else {
      const diffDays = Math.round(
        (new Date(entry.date).getTime() - new Date(prevDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (diffDays > 2) {
        starts.push(entry.date)
      }
    }
    prevDate = entry.date
  }

  return starts
}
