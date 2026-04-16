/**
 * Tier 2 Specialized Parsers
 *
 * Dedicated parsers for apps that don't have APIs but do have exports:
 * - Flo period tracker (JSON)
 * - Clue period tracker (JSON or CSV)
 * - Bearable symptom tracker (CSV)
 * - Sleep Cycle (CSV)
 * - Strong workout tracker (CSV)
 * - MacroFactor (CSV)
 *
 * These apps together cover the majority of "I want my data in one place"
 * user stories. Each parser understands the specific export format and
 * produces canonical records aligned with our internal schema.
 */

import type {
  DetectedFormat, ParseResult, CanonicalRecord, CanonicalRecordType,
  ImportSource, Parser,
} from '../types'
import { createDedupeKey } from '../dedupe-key'

function makeSource(format: DetectedFormat, appName: string, fileName?: string): ImportSource {
  return {
    format,
    fileName: fileName ?? null,
    appName,
    importedAt: new Date().toISOString(),
    parserVersion: '2.0.0',
  }
}

function normalizeDate(val: string): string | null {
  if (!val) return null
  const iso = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const us = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  const dash = val.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (dash) return `${dash[3]}-${dash[1].padStart(2, '0')}-${dash[2].padStart(2, '0')}`
  return null
}

function parseNumber(val: string): number | null {
  const n = parseFloat(val.replace(/[,$%]/g, ''))
  return isNaN(n) ? null : n
}

// Minimal CSV splitter that handles quoted fields
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++ } else { q = !q }
    } else if (c === ',' && !q) {
      out.push(cur.trim()); cur = ''
    } else cur += c
  }
  out.push(cur.trim())
  return out
}

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  return {
    headers: splitCsvLine(lines[0]).map(h => h.toLowerCase().trim()),
    rows: lines.slice(1).map(splitCsvLine),
  }
}

// ── Flo JSON Parser ────────────────────────────────────────────────

/**
 * Flo export JSON structure (reverse-engineered from exports):
 * {
 *   "periods": [{ "startDate": "...", "endDate": "...", "flowLevel": "..." }],
 *   "symptoms": [{ "date": "...", "types": [...] }],
 *   "notes": [{ "date": "...", "text": "..." }]
 * }
 */
export function parseFloJson(text: string, fileName?: string): ParseResult {
  const source = makeSource('json-flo', 'Flo', fileName)
  const records: CanonicalRecord[] = []
  const warnings: string[] = []
  const errors: string[] = []

  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch (e) {
    return {
      records: [],
      warnings: [],
      errors: [`Invalid Flo JSON: ${e instanceof Error ? e.message : 'parse failed'}`],
      metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Flo' },
    }
  }

  // Periods - each day between startDate and endDate becomes a cycle_entry
  const periods = Array.isArray(data.periods) ? data.periods : []
  for (const p of periods) {
    const period = p as { startDate?: string; endDate?: string; flowLevel?: string }
    const start = normalizeDate(period.startDate ?? '')
    const end = normalizeDate(period.endDate ?? start ?? '')
    if (!start || !end) continue

    const startMs = new Date(start).getTime()
    const endMs = new Date(end).getTime()
    const flowMap: Record<string, string> = {
      light: 'light', medium: 'medium', heavy: 'heavy', spotting: 'spotting',
    }
    const flow = flowMap[period.flowLevel?.toLowerCase() ?? ''] ?? 'medium'

    for (let t = startMs; t <= endMs; t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10)
      records.push({
        type: 'cycle_entry',
        date,
        datetime: null,
        source,
        confidence: 0.92,
        data: {
          menstruation: true,
          flowLevel: flow,
          cervicalMucus: null,
          lhTestResult: null,
          ovulationSigns: null,
        } as unknown as CanonicalRecord['data'],
        rawText: null,
        dedupeKey: createDedupeKey('cycle_entry', date, `flo_period`),
      })
    }
  }

  // Symptoms
  const symptoms = Array.isArray(data.symptoms) ? data.symptoms : []
  for (const s of symptoms) {
    const sym = s as { date?: string; types?: string[] }
    const date = normalizeDate(sym.date ?? '')
    if (!date || !Array.isArray(sym.types)) continue

    for (const type of sym.types) {
      records.push({
        type: 'symptom',
        date,
        datetime: null,
        source,
        confidence: 0.85,
        data: {
          symptom: type,
          severity: null,
          notes: null,
        } as unknown as CanonicalRecord['data'],
        rawText: null,
        dedupeKey: createDedupeKey('symptom', date, `flo_${type}`),
      })
    }
  }

  if (records.length === 0 && periods.length === 0) {
    warnings.push('No recognized Flo data found. Verify this is a Flo JSON export.')
  }

  return buildResult(records, source, warnings, errors, 'Flo')
}

// ── Clue Parser ────────────────────────────────────────────────────

/**
 * Clue export JSON structure:
 * {
 *   "days": [{ "day": "YYYY-MM-DD", "flow": "...", "tags": [...] }]
 * }
 */
export function parseClueJson(text: string, fileName?: string): ParseResult {
  const source = makeSource('json-clue', 'Clue', fileName)
  const records: CanonicalRecord[] = []
  const warnings: string[] = []
  const errors: string[] = []

  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch (e) {
    return {
      records: [],
      warnings: [],
      errors: [`Invalid Clue JSON: ${e instanceof Error ? e.message : 'parse failed'}`],
      metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Clue' },
    }
  }

  const days = Array.isArray(data.days) ? data.days : []
  const flowMap: Record<string, string> = {
    spotting: 'spotting', light: 'light', medium: 'medium', heavy: 'heavy',
  }

  for (const d of days) {
    const day = d as { day?: string; flow?: string; tags?: string[] }
    const date = normalizeDate(day.day ?? '')
    if (!date) continue

    const flow = day.flow ? flowMap[day.flow.toLowerCase()] ?? null : null

    if (flow) {
      records.push({
        type: 'cycle_entry',
        date,
        datetime: null,
        source,
        confidence: 0.92,
        data: {
          menstruation: true,
          flowLevel: flow,
          cervicalMucus: null,
          lhTestResult: null,
          ovulationSigns: null,
        } as unknown as CanonicalRecord['data'],
        rawText: null,
        dedupeKey: createDedupeKey('cycle_entry', date, 'clue'),
      })
    }

    if (Array.isArray(day.tags)) {
      for (const tag of day.tags) {
        records.push({
          type: 'symptom',
          date,
          datetime: null,
          source,
          confidence: 0.82,
          data: {
            symptom: tag,
            severity: null,
            notes: null,
          } as unknown as CanonicalRecord['data'],
          rawText: null,
          dedupeKey: createDedupeKey('symptom', date, `clue_${tag}`),
        })
      }
    }
  }

  return buildResult(records, source, warnings, errors, 'Clue')
}

// ── Bearable CSV Parser ────────────────────────────────────────────

/**
 * Bearable export CSV columns (observed from exports):
 * Date, Time, Category, Label, Rating, Notes
 * Categories: Symptom, Mood, Factor, Medication, Energy, Sleep
 */
export function parseBearableCsv(text: string, fileName?: string): ParseResult {
  const source = makeSource('csv-bearable', 'Bearable', fileName)
  const records: CanonicalRecord[] = []
  const warnings: string[] = []
  const errors: string[] = []

  const { headers, rows } = parseCsvText(text)
  const dateIdx = headers.indexOf('date')
  const timeIdx = headers.indexOf('time')
  const categoryIdx = headers.findIndex(h => h === 'category' || h === 'type')
  const labelIdx = headers.findIndex(h => h === 'label' || h === 'name')
  const ratingIdx = headers.findIndex(h => h === 'rating' || h === 'value' || h === 'amount')
  const notesIdx = headers.indexOf('notes')

  if (dateIdx === -1 || categoryIdx === -1) {
    return {
      records: [],
      warnings: [],
      errors: ['Bearable CSV missing required columns (date, category)'],
      metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Bearable' },
    }
  }

  for (const row of rows) {
    const date = normalizeDate(row[dateIdx] ?? '')
    if (!date) continue

    const time = timeIdx >= 0 ? row[timeIdx] : null
    const category = (row[categoryIdx] ?? '').toLowerCase().trim()
    const label = labelIdx >= 0 ? row[labelIdx] : ''
    const rating = ratingIdx >= 0 ? parseNumber(row[ratingIdx] ?? '') : null
    const notes = notesIdx >= 0 ? row[notesIdx] : null

    const datetime = time ? `${date}T${time}` : null

    // Map Bearable category to our canonical record type
    let recordType: CanonicalRecordType | null = null
    let dataObj: Record<string, unknown> = {}

    switch (category) {
      case 'symptom':
        recordType = 'symptom'
        dataObj = { symptom: label, severity: rating, notes }
        break
      case 'mood':
        recordType = 'mood_entry'
        dataObj = { score: rating, emotions: label ? [label] : [], notes }
        break
      case 'medication':
        recordType = 'medication'
        dataObj = { name: label, dose: null, route: null, notes }
        break
      case 'sleep':
        recordType = 'sleep_entry'
        dataObj = { quality: rating, durationMinutes: null, notes }
        break
      case 'energy':
      case 'factor':
        recordType = 'symptom'
        dataObj = { symptom: `${category}: ${label}`, severity: rating, notes }
        break
      default:
        continue
    }

    if (!recordType) continue

    records.push({
      type: recordType,
      date,
      datetime,
      source,
      confidence: 0.88,
      data: dataObj as unknown as CanonicalRecord['data'],
      rawText: null,
      dedupeKey: createDedupeKey(recordType, date, `bearable_${category}_${label}`),
    })
  }

  return buildResult(records, source, warnings, errors, 'Bearable')
}

// ── Sleep Cycle CSV Parser ─────────────────────────────────────────

/**
 * Sleep Cycle export columns (observed):
 * Start, End, Sleep Quality, Heart rate, Steps, Weather temperature, ...
 */
export function parseSleepCycleCsv(text: string, fileName?: string): ParseResult {
  const source = makeSource('csv-generic', 'Sleep Cycle', fileName)
  const records: CanonicalRecord[] = []
  const warnings: string[] = []
  const errors: string[] = []

  const { headers, rows } = parseCsvText(text)
  const startIdx = headers.findIndex(h => h.includes('start'))
  const endIdx = headers.findIndex(h => h.includes('end'))
  const qualityIdx = headers.findIndex(h => h.includes('quality'))
  const hrIdx = headers.findIndex(h => h.includes('heart'))

  if (startIdx === -1) {
    return {
      records: [],
      warnings: [],
      errors: ['Sleep Cycle CSV missing start column'],
      metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Sleep Cycle' },
    }
  }

  for (const row of rows) {
    const startRaw = row[startIdx] ?? ''
    const date = normalizeDate(startRaw.slice(0, 10))
    if (!date) continue

    const startDate = new Date(startRaw)
    const endDate = endIdx >= 0 ? new Date(row[endIdx] ?? '') : null
    const durationMin = endDate && !isNaN(endDate.getTime())
      ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
      : null

    const quality = qualityIdx >= 0 ? parseNumber(row[qualityIdx] ?? '') : null
    const hr = hrIdx >= 0 ? parseNumber(row[hrIdx] ?? '') : null

    records.push({
      type: 'sleep_entry',
      date,
      datetime: startRaw || null,
      source,
      confidence: 0.9,
      data: {
        durationMinutes: durationMin,
        quality: quality !== null ? Math.round(quality) : null,
        restingHeartRate: hr,
        notes: null,
      } as unknown as CanonicalRecord['data'],
      rawText: null,
      dedupeKey: createDedupeKey('sleep_entry', date, 'sleepcycle'),
    })
  }

  return buildResult(records, source, warnings, errors, 'Sleep Cycle')
}

// ── Strong (workout tracker) CSV Parser ────────────────────────────

/**
 * Strong export columns:
 * Date, Workout Name, Duration (sec), Exercise Name, Set Order, Weight, Reps, RPE, ...
 * Aggregates multiple sets into one activity_entry per workout per day.
 */
export function parseStrongCsv(text: string, fileName?: string): ParseResult {
  const source = makeSource('csv-generic', 'Strong', fileName)
  const records: CanonicalRecord[] = []
  const warnings: string[] = []
  const errors: string[] = []

  const { headers, rows } = parseCsvText(text)
  const dateIdx = headers.indexOf('date')
  const workoutIdx = headers.findIndex(h => h.includes('workout'))
  const durationIdx = headers.findIndex(h => h.includes('duration'))
  const exerciseIdx = headers.findIndex(h => h.includes('exercise'))
  const weightIdx = headers.indexOf('weight')
  const repsIdx = headers.indexOf('reps')

  if (dateIdx === -1) {
    return {
      records: [],
      warnings: [],
      errors: ['Strong CSV missing date column'],
      metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Strong' },
    }
  }

  // Aggregate sets by date+workout
  const aggregated = new Map<string, {
    date: string
    workoutName: string
    durationSec: number
    exercises: Map<string, { sets: number; totalWeight: number }>
  }>()

  for (const row of rows) {
    const date = normalizeDate(row[dateIdx] ?? '')
    if (!date) continue

    const workout = row[workoutIdx] ?? 'Workout'
    const key = `${date}|${workout}`
    const duration = durationIdx >= 0 ? parseNumber(row[durationIdx] ?? '') ?? 0 : 0
    const exercise = exerciseIdx >= 0 ? row[exerciseIdx] ?? 'Exercise' : 'Exercise'
    const weight = weightIdx >= 0 ? parseNumber(row[weightIdx] ?? '') ?? 0 : 0
    const reps = repsIdx >= 0 ? parseNumber(row[repsIdx] ?? '') ?? 0 : 0

    const existing = aggregated.get(key)
    if (existing) {
      existing.durationSec = Math.max(existing.durationSec, duration)
      const exInfo = existing.exercises.get(exercise) ?? { sets: 0, totalWeight: 0 }
      exInfo.sets += 1
      exInfo.totalWeight += weight * reps
      existing.exercises.set(exercise, exInfo)
    } else {
      const exercises = new Map<string, { sets: number; totalWeight: number }>()
      exercises.set(exercise, { sets: 1, totalWeight: weight * reps })
      aggregated.set(key, { date, workoutName: workout, durationSec: duration, exercises })
    }
  }

  for (const [, w] of aggregated) {
    const totalVolume = Array.from(w.exercises.values()).reduce((s, e) => s + e.totalWeight, 0)
    records.push({
      type: 'activity_entry',
      date: w.date,
      datetime: null,
      source,
      confidence: 0.94,
      data: {
        activityType: 'strength_training',
        durationMinutes: w.durationSec > 0 ? Math.round(w.durationSec / 60) : null,
        calories: null,
        distance: null,
        notes: `${w.workoutName}: ${Array.from(w.exercises.keys()).join(', ')} (volume: ${totalVolume})`,
      } as unknown as CanonicalRecord['data'],
      rawText: null,
      dedupeKey: createDedupeKey('activity_entry', w.date, `strong_${w.workoutName}`),
    })
  }

  return buildResult(records, source, warnings, errors, 'Strong')
}

// ── MacroFactor CSV Parser ─────────────────────────────────────────

/**
 * MacroFactor export columns (observed):
 * Date, Meal, Food, Calories, Protein (g), Carbs (g), Fat (g), Fiber (g), Sugar (g), ...
 */
export function parseMacroFactorCsv(text: string, fileName?: string): ParseResult {
  const source = makeSource('csv-generic', 'MacroFactor', fileName)
  const records: CanonicalRecord[] = []
  const warnings: string[] = []
  const errors: string[] = []

  const { headers, rows } = parseCsvText(text)
  const dateIdx = headers.indexOf('date')
  const mealIdx = headers.indexOf('meal')
  const foodIdx = headers.indexOf('food')
  const calIdx = headers.findIndex(h => h === 'calories' || h.startsWith('kcal'))
  const proIdx = headers.findIndex(h => h.startsWith('protein'))
  const carbIdx = headers.findIndex(h => h.startsWith('carbs') || h.startsWith('carbohydrate'))
  const fatIdx = headers.findIndex(h => h.startsWith('fat'))
  const fiberIdx = headers.findIndex(h => h.startsWith('fiber') || h.startsWith('fibre'))
  const sugarIdx = headers.findIndex(h => h.startsWith('sugar'))

  if (dateIdx === -1) {
    return {
      records: [],
      warnings: [],
      errors: ['MacroFactor CSV missing date column'],
      metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'MacroFactor' },
    }
  }

  // Map MacroFactor meal names to canonical meal types
  const mealMap: Record<string, string> = {
    breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner',
    snack: 'snack', snacks: 'snack',
  }

  for (const row of rows) {
    const date = normalizeDate(row[dateIdx] ?? '')
    if (!date) continue

    const mealRaw = mealIdx >= 0 ? (row[mealIdx] ?? '').toLowerCase() : ''
    const mealType = mealMap[mealRaw] ?? null
    const food = foodIdx >= 0 ? row[foodIdx] : ''

    const calories = calIdx >= 0 ? parseNumber(row[calIdx] ?? '') : null
    const protein = proIdx >= 0 ? parseNumber(row[proIdx] ?? '') : null
    const carbs = carbIdx >= 0 ? parseNumber(row[carbIdx] ?? '') : null
    const fat = fatIdx >= 0 ? parseNumber(row[fatIdx] ?? '') : null
    const fiber = fiberIdx >= 0 ? parseNumber(row[fiberIdx] ?? '') : null
    const sugar = sugarIdx >= 0 ? parseNumber(row[sugarIdx] ?? '') : null

    records.push({
      type: 'food_entry',
      date,
      datetime: null,
      source,
      confidence: 0.93,
      data: {
        mealType,
        foods: food ? [food] : [],
        calories,
        protein,
        carbs,
        fat,
        fiber,
        sugar,
      } as unknown as CanonicalRecord['data'],
      rawText: null,
      dedupeKey: createDedupeKey('food_entry', date, `macrofactor_${mealType}_${food?.slice(0, 20)}`),
    })
  }

  return buildResult(records, source, warnings, errors, 'MacroFactor')
}

// ── Helper: build result object ────────────────────────────────────

function buildResult(
  records: CanonicalRecord[],
  source: ImportSource,
  warnings: string[],
  errors: string[],
  sourceName: string,
): ParseResult {
  const byType: Record<string, number> = {}
  let earliest = ''
  let latest = ''
  for (const r of records) {
    byType[r.type] = (byType[r.type] ?? 0) + 1
    if (!earliest || r.date < earliest) earliest = r.date
    if (!latest || r.date > latest) latest = r.date
  }
  return {
    records,
    warnings,
    errors,
    metadata: {
      totalExtracted: records.length,
      byType,
      dateRange: records.length > 0 ? { earliest, latest } : null,
      sourceName,
    },
  }
}

// ── Unified Parser Interface ───────────────────────────────────────

export const tier2Parser: Parser = {
  supportedFormats: ['json-flo', 'json-clue', 'csv-bearable'],

  async parse(content: string | Buffer, format: DetectedFormat, fileName?: string): Promise<ParseResult> {
    const text = typeof content === 'string' ? content : content.toString('utf-8')

    // Heuristic sniffing for ambiguous generic CSV/JSON from Sleep Cycle, Strong, MacroFactor
    const lower = text.slice(0, 2000).toLowerCase()
    if (format === 'json-flo') return parseFloJson(text, fileName)
    if (format === 'json-clue') return parseClueJson(text, fileName)
    if (format === 'csv-bearable') return parseBearableCsv(text, fileName)

    // Fallback sniff for csv-generic
    if (fileName?.toLowerCase().includes('sleep cycle') || lower.includes('sleep quality')) {
      return parseSleepCycleCsv(text, fileName)
    }
    if (fileName?.toLowerCase().includes('strong') || lower.includes('set order')) {
      return parseStrongCsv(text, fileName)
    }
    if (fileName?.toLowerCase().includes('macrofactor') || lower.includes('macrofactor')) {
      return parseMacroFactorCsv(text, fileName)
    }

    return {
      records: [],
      warnings: [`No tier-2 parser matched format '${format}'.`],
      errors: [],
      metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Unknown' },
    }
  },
}
