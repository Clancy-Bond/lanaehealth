/**
 * Layer 3: Sync Pipeline
 *
 * Builds per-day narrative chunks from all health data sources
 * and upserts them into the health_embeddings table (vector store).
 *
 * Each day produces one narrative that summarizes everything logged:
 *   - Daily log (pain, fatigue, notes)
 *   - Oura Ring biometrics (sleep, HRV, HR)
 *   - Symptoms (category, severity)
 *   - Food entries (meals, triggers)
 *   - Cycle data (flow, phase)
 *   - Natural Cycles data (temperature, fertility)
 *   - Pain points (body regions, intensity)
 *
 * Lab results and imaging studies are indexed as separate chunks
 * keyed by their test/study date.
 */

import { createServiceClient } from '@/lib/supabase'
import { upsertNarrative, type EmbeddingMetadata } from './vector-store'
import type {
  DailyLog,
  OuraDaily,
  Symptom,
  FoodEntry,
  CycleEntry,
  NcImported,
  PainPoint,
  LabResult,
} from '@/lib/types'

// ── Interfaces for joined query results ───────────────────────────

interface FoodEntryWithDate extends FoodEntry {
  date: string
}

interface SymptomWithDate extends Symptom {
  date: string
}

interface PainPointWithDate extends PainPoint {
  date: string
}

interface ImagingRow {
  study_date: string
  modality: string
  body_part: string
  indication: string | null
  findings_summary: string | null
}

// ── Narrative Builders ────────────────────────────────────────────

/**
 * Builds a comprehensive daily narrative from all available data sources.
 * Returns null if a day has NO meaningful data (all sources empty/null).
 */
export function buildDayNarrative(
  date: string,
  data: {
    log?: DailyLog | null
    oura?: OuraDaily | null
    symptoms?: Symptom[]
    food?: FoodEntry[]
    cycle?: CycleEntry | null
    nc?: NcImported | null
    painPoints?: PainPoint[]
  },
): { narrative: string; metadata: EmbeddingMetadata } | null {
  const parts: string[] = []
  const metadata: EmbeddingMetadata = {
    symptomCategories: [],
  }

  const log = data.log
  const oura = data.oura
  const symptoms = data.symptoms ?? []
  const food = data.food ?? []
  const cycle = data.cycle
  const nc = data.nc
  const painPoints = data.painPoints ?? []

  // Check if we have any real data for this day
  const hasLogData = log && (
    log.overall_pain !== null ||
    log.fatigue !== null ||
    log.notes !== null ||
    log.daily_impact !== null
  )
  const hasOura = oura && (oura.sleep_score !== null || oura.hrv_avg !== null)
  const hasSymptoms = symptoms.length > 0
  const hasFood = food.length > 0
  const hasCycle = cycle && (cycle.menstruation || cycle.flow_level !== 'none')
  const hasNc = nc && (nc.temperature !== null || nc.menstruation !== null)
  const hasPain = painPoints.length > 0

  if (!hasLogData && !hasOura && !hasSymptoms && !hasFood && !hasCycle && !hasNc && !hasPain) {
    return null
  }

  // Header
  parts.push(`Health data for ${date}:`)

  // Daily log scores
  if (hasLogData && log) {
    const scores: string[] = []
    if (log.overall_pain !== null) {
      scores.push(`Pain ${log.overall_pain}/10`)
      metadata.painLevel = log.overall_pain
    }
    if (log.fatigue !== null) scores.push(`Fatigue ${log.fatigue}/10`)
    if (log.bloating !== null) scores.push(`Bloating ${log.bloating}/10`)
    if (log.stress !== null) scores.push(`Stress ${log.stress}/10`)
    if (log.sleep_quality !== null) scores.push(`Sleep quality ${log.sleep_quality}/10`)
    if (scores.length > 0) parts.push(scores.join(', ') + '.')

    if (log.cycle_phase) {
      metadata.cyclePhase = log.cycle_phase
      parts.push(`Cycle phase: ${log.cycle_phase}.`)
    }
  }

  // Symptoms
  if (hasSymptoms) {
    const categories = new Set<string>()
    const symptomDescriptions = symptoms.map((s) => {
      categories.add(s.category)
      return s.severity ? `${s.symptom} (${s.severity})` : s.symptom
    })
    parts.push(`Symptoms: ${symptomDescriptions.join(', ')}.`)
    metadata.symptomCategories = Array.from(categories)
  }

  // Pain points
  if (hasPain) {
    const painDescriptions = painPoints.map((p) => {
      const desc = `${p.body_region} ${p.intensity}/10`
      return p.pain_type ? `${desc} (${p.pain_type})` : desc
    })
    parts.push(`Pain points: ${painDescriptions.join(', ')}.`)

    // If no overall pain from log, use max pain point intensity
    if (metadata.painLevel === undefined || metadata.painLevel === null) {
      metadata.painLevel = Math.max(...painPoints.map((p) => p.intensity))
    }
  }

  // Oura biometrics
  if (hasOura && oura) {
    const bioMetrics: string[] = []
    if (oura.sleep_score !== null) bioMetrics.push(`Sleep score ${oura.sleep_score}`)
    if (oura.sleep_duration !== null) {
      const hrs = Math.round((oura.sleep_duration / 3600) * 10) / 10
      bioMetrics.push(`${hrs}h sleep`)
    }
    if (oura.deep_sleep_min !== null) bioMetrics.push(`${oura.deep_sleep_min}min deep`)
    if (oura.rem_sleep_min !== null) bioMetrics.push(`${oura.rem_sleep_min}min REM`)
    if (oura.hrv_avg !== null) bioMetrics.push(`HRV ${oura.hrv_avg}ms`)
    if (oura.resting_hr !== null) bioMetrics.push(`Resting HR ${oura.resting_hr}`)
    if (oura.body_temp_deviation !== null) {
      const sign = oura.body_temp_deviation >= 0 ? '+' : ''
      bioMetrics.push(`Temp ${sign}${oura.body_temp_deviation}C`)
    }
    if (oura.readiness_score !== null) bioMetrics.push(`Readiness ${oura.readiness_score}`)
    if (oura.stress_score !== null) bioMetrics.push(`Stress score ${oura.stress_score}`)
    if (oura.spo2_avg !== null) bioMetrics.push(`SpO2 ${oura.spo2_avg}%`)

    if (bioMetrics.length > 0) {
      parts.push(`Oura: ${bioMetrics.join(', ')}.`)
    }
  }

  // Cycle/period data
  if (hasCycle && cycle) {
    const cycleInfo: string[] = []
    if (cycle.menstruation) {
      cycleInfo.push('Period day')
      metadata.hasPeriod = true
    }
    if (cycle.flow_level && cycle.flow_level !== 'none') {
      cycleInfo.push(`${cycle.flow_level} flow`)
    }
    if (cycle.ovulation_signs) cycleInfo.push(`Ovulation signs: ${cycle.ovulation_signs}`)
    if (cycle.lh_test_result) cycleInfo.push(`LH: ${cycle.lh_test_result}`)
    if (cycleInfo.length > 0) parts.push(cycleInfo.join(', ') + '.')
  }

  // Natural Cycles data
  if (hasNc && nc) {
    const ncInfo: string[] = []
    if (nc.temperature !== null) ncInfo.push(`BBT ${nc.temperature}C`)
    if (nc.menstruation) ncInfo.push(`NC menstruation: ${nc.menstruation}`)
    if (nc.flow_quantity) ncInfo.push(`Flow: ${nc.flow_quantity}`)
    if (nc.fertility_color) ncInfo.push(`Fertility: ${nc.fertility_color}`)
    if (nc.ovulation_status) ncInfo.push(`Ovulation: ${nc.ovulation_status}`)
    if (nc.cycle_day !== null) ncInfo.push(`Cycle day ${nc.cycle_day}`)
    if (nc.mood_flags) ncInfo.push(`Mood: ${nc.mood_flags}`)

    if (ncInfo.length > 0) {
      parts.push(`Natural Cycles: ${ncInfo.join(', ')}.`)
    }

    // Set period flag from NC data if not already set
    if (nc.menstruation && nc.menstruation !== 'none' && nc.menstruation !== 'no') {
      metadata.hasPeriod = true
    }
  }

  // Food entries
  if (hasFood) {
    const allTriggers: string[] = []
    const mealDescriptions = food.map((f) => {
      const parts: string[] = []
      if (f.meal_type) parts.push(f.meal_type)
      if (f.food_items) parts.push(f.food_items)
      if (f.flagged_triggers?.length > 0) {
        allTriggers.push(...f.flagged_triggers)
      }
      return parts.join(': ')
    }).filter(Boolean)

    if (mealDescriptions.length > 0) {
      parts.push(`Food: ${mealDescriptions.join('; ')}.`)
    }
    if (allTriggers.length > 0) {
      parts.push(`Triggers flagged: ${[...new Set(allTriggers)].join(', ')}.`)
    }
  }

  // Notes and free text
  if (log?.notes) parts.push(`Notes: ${log.notes}`)
  if (log?.daily_impact) parts.push(`Impact: ${log.daily_impact}`)
  if (log?.what_helped) parts.push(`What helped: ${log.what_helped}`)
  if (log?.triggers) parts.push(`Triggers noted: ${log.triggers}`)

  return {
    narrative: parts.join(' '),
    metadata,
  }
}

/**
 * Builds a narrative for a lab result date (may have multiple tests).
 */
function buildLabNarrative(date: string, labs: LabResult[]): string {
  const parts: string[] = [`Lab results from ${date}:`]

  for (const lab of labs) {
    let desc = lab.test_name
    if (lab.value !== null) {
      desc += ` = ${lab.value}`
      if (lab.unit) desc += ` ${lab.unit}`
    }
    if (lab.flag && lab.flag !== 'normal') {
      desc += ` [${lab.flag.toUpperCase()}]`
    }
    if (lab.reference_range_low !== null && lab.reference_range_high !== null) {
      desc += ` (ref: ${lab.reference_range_low}-${lab.reference_range_high})`
    }
    parts.push(desc)
  }

  return parts.join(' ')
}

/**
 * Builds a narrative for an imaging study.
 */
function buildImagingNarrative(row: ImagingRow): string {
  const parts: string[] = [
    `Imaging study ${row.study_date}: ${row.modality} ${row.body_part}.`,
  ]
  if (row.indication) parts.push(`Indication: ${row.indication}.`)
  if (row.findings_summary) parts.push(`Findings: ${row.findings_summary}`)
  return parts.join(' ')
}

// ── Data Fetching ─────────────────────────────────────────────────

/**
 * Fetches all data sources for a date range and returns them
 * grouped by date.
 */
async function fetchDataForRange(
  startDate: string,
  endDate: string,
): Promise<{
  logsByDate: Map<string, DailyLog>
  ouraByDate: Map<string, OuraDaily>
  symptomsByDate: Map<string, Symptom[]>
  foodByDate: Map<string, FoodEntry[]>
  cycleByDate: Map<string, CycleEntry>
  ncByDate: Map<string, NcImported>
  painByDate: Map<string, PainPoint[]>
  labsByDate: Map<string, LabResult[]>
  imaging: ImagingRow[]
}> {
  const sb = createServiceClient()

  // Run all queries in parallel
  const [
    logsRes,
    ouraRes,
    symptomsRes,
    foodRes,
    cycleRes,
    ncRes,
    painRes,
    labsRes,
    imagingRes,
  ] = await Promise.all([
    // Daily logs
    sb.from('daily_logs')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),

    // Oura daily
    sb.from('oura_daily')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),

    // Symptoms (joined via log_id -> daily_logs)
    sb.from('symptoms')
      .select('*, daily_logs!inner(date)')
      .gte('daily_logs.date', startDate)
      .lte('daily_logs.date', endDate),

    // Food entries (joined via log_id -> daily_logs)
    sb.from('food_entries')
      .select('*, daily_logs!inner(date)')
      .gte('daily_logs.date', startDate)
      .lte('daily_logs.date', endDate),

    // Cycle entries
    sb.from('cycle_entries')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),

    // Natural Cycles imported
    sb.from('nc_imported')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),

    // Pain points (joined via log_id -> daily_logs)
    sb.from('pain_points')
      .select('*, daily_logs!inner(date)')
      .gte('daily_logs.date', startDate)
      .lte('daily_logs.date', endDate),

    // Lab results (all history for trajectory context)
    sb.from('lab_results')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date'),

    // Imaging studies
    sb.from('imaging_studies')
      .select('study_date, modality, body_part, indication, findings_summary')
      .gte('study_date', startDate)
      .lte('study_date', endDate)
      .order('study_date'),
  ])

  // Build date-keyed maps
  const logsByDate = new Map<string, DailyLog>()
  for (const row of (logsRes.data ?? []) as DailyLog[]) {
    logsByDate.set(row.date, row)
  }

  const ouraByDate = new Map<string, OuraDaily>()
  for (const row of (ouraRes.data ?? []) as OuraDaily[]) {
    ouraByDate.set(row.date, row)
  }

  const symptomsByDate = new Map<string, Symptom[]>()
  for (const row of (symptomsRes.data ?? []) as (SymptomWithDate & { daily_logs: { date: string } })[]) {
    const date = row.daily_logs?.date
    if (!date) continue
    if (!symptomsByDate.has(date)) symptomsByDate.set(date, [])
    symptomsByDate.get(date)!.push(row)
  }

  const foodByDate = new Map<string, FoodEntry[]>()
  for (const row of (foodRes.data ?? []) as (FoodEntryWithDate & { daily_logs: { date: string } })[]) {
    const date = row.daily_logs?.date
    if (!date) continue
    if (!foodByDate.has(date)) foodByDate.set(date, [])
    foodByDate.get(date)!.push(row)
  }

  const cycleByDate = new Map<string, CycleEntry>()
  for (const row of (cycleRes.data ?? []) as CycleEntry[]) {
    cycleByDate.set(row.date, row)
  }

  const ncByDate = new Map<string, NcImported>()
  for (const row of (ncRes.data ?? []) as NcImported[]) {
    ncByDate.set(row.date, row)
  }

  const painByDate = new Map<string, PainPoint[]>()
  for (const row of (painRes.data ?? []) as (PainPointWithDate & { daily_logs: { date: string } })[]) {
    const date = row.daily_logs?.date
    if (!date) continue
    if (!painByDate.has(date)) painByDate.set(date, [])
    painByDate.get(date)!.push(row)
  }

  const labsByDate = new Map<string, LabResult[]>()
  for (const row of (labsRes.data ?? []) as LabResult[]) {
    if (!labsByDate.has(row.date)) labsByDate.set(row.date, [])
    labsByDate.get(row.date)!.push(row)
  }

  const imaging = (imagingRes.data ?? []) as ImagingRow[]

  return {
    logsByDate,
    ouraByDate,
    symptomsByDate,
    foodByDate,
    cycleByDate,
    ncByDate,
    painByDate,
    labsByDate,
    imaging,
  }
}

// ── Sync Operations ───────────────────────────────────────────────

/**
 * Syncs narratives for a date range.
 * Returns the number of records upserted.
 */
export async function syncDateRange(
  startDate: string,
  endDate: string,
): Promise<number> {
  const data = await fetchDataForRange(startDate, endDate)
  let synced = 0

  // Collect all unique dates across all sources
  const allDates = new Set<string>()
  for (const d of data.logsByDate.keys()) allDates.add(d)
  for (const d of data.ouraByDate.keys()) allDates.add(d)
  for (const d of data.symptomsByDate.keys()) allDates.add(d)
  for (const d of data.foodByDate.keys()) allDates.add(d)
  for (const d of data.cycleByDate.keys()) allDates.add(d)
  for (const d of data.ncByDate.keys()) allDates.add(d)
  for (const d of data.painByDate.keys()) allDates.add(d)

  // Build and upsert daily narratives
  const sortedDates = Array.from(allDates).sort()

  for (const date of sortedDates) {
    const result = buildDayNarrative(date, {
      log: data.logsByDate.get(date) ?? null,
      oura: data.ouraByDate.get(date) ?? null,
      symptoms: data.symptomsByDate.get(date) ?? [],
      food: data.foodByDate.get(date) ?? [],
      cycle: data.cycleByDate.get(date) ?? null,
      nc: data.ncByDate.get(date) ?? null,
      painPoints: data.painByDate.get(date) ?? [],
    })

    if (!result) continue // Skip days with no data

    await upsertNarrative(
      `day_${date}`,
      'daily_log',
      date,
      result.narrative,
      result.metadata,
    )
    synced++
  }

  // Index lab results as separate chunks (one per test date)
  for (const [date, labs] of data.labsByDate) {
    const narrative = buildLabNarrative(date, labs)
    await upsertNarrative(
      `lab_${date}`,
      'lab_result',
      date,
      narrative,
      {},
    )
    synced++
  }

  // Index imaging studies as separate chunks
  for (const img of data.imaging) {
    const narrative = buildImagingNarrative(img)
    await upsertNarrative(
      `img_${img.study_date}_${img.modality}_${img.body_part}`.toLowerCase().replace(/\s+/g, '_'),
      'imaging',
      img.study_date,
      narrative,
      {},
    )
    synced++
  }

  return synced
}

/**
 * Syncs all historical data from 2022-01-01 to today.
 * Processes in 90-day chunks to avoid memory issues.
 */
export async function syncAllHistory(): Promise<number> {
  const start = new Date('2022-01-01')
  const end = new Date()
  let totalSynced = 0

  // Process in 90-day windows
  const chunkDays = 90
  let current = new Date(start)

  while (current < end) {
    const chunkEnd = new Date(current)
    chunkEnd.setDate(chunkEnd.getDate() + chunkDays - 1)
    if (chunkEnd > end) chunkEnd.setTime(end.getTime())

    const startStr = current.toISOString().split('T')[0]
    const endStr = chunkEnd.toISOString().split('T')[0]

    console.log(`Syncing ${startStr} to ${endStr}...`)
    const count = await syncDateRange(startStr, endStr)
    totalSynced += count
    console.log(`  Synced ${count} records (total: ${totalSynced})`)

    // Move to next chunk
    current = new Date(chunkEnd)
    current.setDate(current.getDate() + 1)
  }

  return totalSynced
}
