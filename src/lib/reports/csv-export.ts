/**
 * Comprehensive CSV export - fixes Bearable's #1 data complaint:
 * includes ALL days including empty/none entries
 */

import { supabase } from '@/lib/supabase'
import { format, eachDayOfInterval, parseISO } from 'date-fns'

interface ExportOptions {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

/**
 * Generate a comprehensive CSV string with ALL health data.
 * Every day in the range gets a row, even if nothing was logged.
 * This directly addresses the Bearable complaint about incomplete exports.
 */
export async function generateFullCsv(options: ExportOptions): Promise<string> {
  const { startDate, endDate } = options

  // Fetch all data in parallel
  const [
    logsResult,
    symptomsResult,
    foodResult,
    cycleResult,
    ouraResult,
    moodResult,
    sleepResult,
    gratitudeResult,
  ] = await Promise.all([
    supabase.from('daily_logs').select('*').gte('date', startDate).lte('date', endDate).order('date'),
    supabase.from('symptoms').select('*, daily_logs!inner(date)').gte('daily_logs.date', startDate).lte('daily_logs.date', endDate),
    supabase.from('food_entries').select('*, daily_logs!inner(date)').gte('daily_logs.date', startDate).lte('daily_logs.date', endDate),
    supabase.from('cycle_entries').select('*').gte('date', startDate).lte('date', endDate),
    supabase.from('oura_daily').select('*').gte('date', startDate).lte('date', endDate),
    supabase.from('mood_entries').select('*, daily_logs!inner(date)').gte('daily_logs.date', startDate).lte('daily_logs.date', endDate),
    supabase.from('sleep_details').select('*, daily_logs!inner(date)').gte('daily_logs.date', startDate).lte('daily_logs.date', endDate),
    supabase.from('gratitude_entries').select('*, daily_logs!inner(date)').gte('daily_logs.date', startDate).lte('daily_logs.date', endDate),
  ])

  // Index data by date for fast lookup
  const logsByDate = new Map<string, Record<string, unknown>>()
  for (const log of (logsResult.data || [])) {
    logsByDate.set(log.date, log)
  }

  const symptomsByDate = new Map<string, string[]>()
  for (const s of (symptomsResult.data || [])) {
    const date = (s as Record<string, unknown>).daily_logs
      ? ((s as Record<string, { date: string }>).daily_logs as { date: string }).date
      : ''
    if (!symptomsByDate.has(date)) symptomsByDate.set(date, [])
    symptomsByDate.get(date)!.push(`${(s as Record<string, unknown>).symptom} (${(s as Record<string, unknown>).severity || 'unrated'})`)
  }

  const foodByDate = new Map<string, string[]>()
  for (const f of (foodResult.data || [])) {
    const date = (f as Record<string, { date: string }>).daily_logs?.date ?? ''
    if (!foodByDate.has(date)) foodByDate.set(date, [])
    foodByDate.get(date)!.push(`${(f as Record<string, unknown>).meal_type}: ${(f as Record<string, unknown>).food_items}`)
  }

  const cycleByDate = new Map<string, Record<string, unknown>>()
  for (const c of (cycleResult.data || [])) {
    cycleByDate.set((c as Record<string, string>).date, c as Record<string, unknown>)
  }

  const ouraByDate = new Map<string, Record<string, unknown>>()
  for (const o of (ouraResult.data || [])) {
    ouraByDate.set((o as Record<string, string>).date, o as Record<string, unknown>)
  }

  const moodByDate = new Map<string, Record<string, unknown>>()
  for (const m of (moodResult.data || [])) {
    const date = (m as Record<string, { date: string }>).daily_logs?.date ?? ''
    moodByDate.set(date, m as Record<string, unknown>)
  }

  // Build CSV
  const headers = [
    'Date', 'Day',
    'Pain (0-10)', 'Fatigue (0-10)', 'Bloating (0-10)', 'Stress (0-10)', 'Sleep Quality (0-10)',
    'Mood (1-5)', 'Emotions',
    'Symptoms',
    'Food',
    'Menstruation', 'Flow Level', 'Cycle Phase',
    'Oura Sleep Score', 'Oura HRV', 'Oura Resting HR', 'Oura Readiness',
    'Triggers', 'What Helped', 'Daily Impact',
    'Notes',
  ]

  const allDays = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  })

  const rows: string[][] = [headers]

  for (const day of allDays) {
    const dateStr = format(day, 'yyyy-MM-dd')
    const dayName = format(day, 'EEEE')
    const log = logsByDate.get(dateStr)
    const cycle = cycleByDate.get(dateStr)
    const oura = ouraByDate.get(dateStr)
    const mood = moodByDate.get(dateStr)

    const row = [
      dateStr,
      dayName,
      log?.overall_pain != null ? String(log.overall_pain) : '',
      log?.fatigue != null ? String(log.fatigue) : '',
      log?.bloating != null ? String(log.bloating) : '',
      log?.stress != null ? String(log.stress) : '',
      log?.sleep_quality != null ? String(log.sleep_quality) : '',
      mood?.mood_score != null ? String(mood.mood_score) : '',
      mood?.emotions ? (mood.emotions as string[]).join(', ') : '',
      symptomsByDate.get(dateStr)?.join('; ') ?? '',
      foodByDate.get(dateStr)?.join('; ') ?? '',
      cycle?.menstruation ? 'Yes' : 'No',
      (cycle?.flow_level as string) ?? '',
      (log?.cycle_phase as string) ?? '',
      oura?.sleep_score != null ? String(oura.sleep_score) : '',
      oura?.hrv_avg != null ? String(oura.hrv_avg) : '',
      oura?.resting_hr != null ? String(oura.resting_hr) : '',
      oura?.readiness_score != null ? String(oura.readiness_score) : '',
      (log?.triggers as string) ?? '',
      (log?.what_helped as string) ?? '',
      (log?.daily_impact as string) ?? '',
      (log?.notes as string) ?? '',
    ]

    rows.push(row)
  }

  // Convert to CSV string (escape commas and quotes)
  return rows
    .map((row) =>
      row.map((cell) => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }).join(',')
    )
    .join('\n')
}
