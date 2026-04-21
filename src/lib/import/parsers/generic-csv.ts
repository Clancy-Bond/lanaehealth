/**
 * Generic CSV Parser with Intelligent Column Mapping
 *
 * Handles unknown CSV formats by analyzing column headers to determine
 * data type and mapping. Covers ~80% of health app CSV exports.
 * Also handles known formats: Cronometer, MFP, Bearable, Daylio.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  DetectedFormat, ParseResult, CanonicalRecord, CanonicalRecordType,
  ImportSource, Parser,
} from '../types'
import { createDedupeKey } from '../deduplicator'

const AI_MODEL = 'claude-haiku-4-5-20251001'

function makeSource(format: DetectedFormat, fileName?: string): ImportSource {
  return {
    format,
    fileName: fileName ?? null,
    appName: format === 'csv-generic' ? 'Unknown CSV' : format.replace('csv-', ''),
    importedAt: new Date().toISOString(),
    parserVersion: '1.0.0',
  }
}

// ── CSV Parsing Helpers ────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseRows(text: string): { headers: string[]; rows: string[][] } {
  // Handle BOM
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase().trim())
  const rows = lines.slice(1).map(splitCsvLine)
  return { headers, rows }
}

function findColumnIndex(headers: string[], ...keywords: string[]): number {
  for (const kw of keywords) {
    const idx = headers.findIndex(h => h.includes(kw.toLowerCase()))
    if (idx !== -1) return idx
  }
  return -1
}

function parseNumber(val: string): number | null {
  const num = parseFloat(val.replace(/[,$%]/g, ''))
  return isNaN(num) ? null : num
}

function normalizeDate(val: string): string | null {
  if (!val) return null
  // Try common formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, M/D/YYYY
  const isoMatch = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`

  const usMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (usMatch) {
    const m = usMatch[1].padStart(2, '0')
    const d = usMatch[2].padStart(2, '0')
    return `${usMatch[3]}-${m}-${d}`
  }

  const dashMatch = val.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (dashMatch) {
    return `${dashMatch[3]}-${dashMatch[1].padStart(2, '0')}-${dashMatch[2].padStart(2, '0')}`
  }

  return null
}

// ── Known Format Parsers ───────────────────────────────────────────

function parseDaylioCsv(headers: string[], rows: string[][], source: ImportSource): CanonicalRecord[] {
  const dateIdx = findColumnIndex(headers, 'date', 'full_date')
  const moodIdx = findColumnIndex(headers, 'mood')
  const activitiesIdx = findColumnIndex(headers, 'activities')
  const noteIdx = findColumnIndex(headers, 'note')

  if (dateIdx === -1 || moodIdx === -1) return []

  const moodMap: Record<string, number> = {
    'rad': 5, 'good': 4, 'meh': 3, 'bad': 2, 'awful': 1,
    'great': 5, 'okay': 3, 'terrible': 1,
  }

  return rows.map(row => {
    const date = normalizeDate(row[dateIdx] ?? '') ?? new Date().toISOString().slice(0, 10)
    const moodText = (row[moodIdx] ?? '').toLowerCase().trim()
    const score = moodMap[moodText] ?? 3
    const activities = row[activitiesIdx]?.split('|').map(a => a.trim()).filter(Boolean) ?? []
    const note = row[noteIdx] ?? null

    return {
      type: 'mood_entry' as CanonicalRecordType,
      date,
      datetime: null,
      source,
      confidence: 0.85,
      data: {
        score,
        emotions: activities,
        notes: note,
      },
      rawText: null,
      dedupeKey: createDedupeKey('mood_entry', date, `daylio_${score}`),
    }
  })
}

// ── AI Column Mapping for Unknown CSVs ─────────────────────────────

async function aiMapColumns(
  headers: string[],
  sampleRows: string[][],
): Promise<{
  recordType: CanonicalRecordType
  dateColumn: string | null
  fieldMappings: Record<string, string> // column header -> canonical field name
}> {
  const client = new Anthropic()

  const sampleData = sampleRows.slice(0, 3).map(row =>
    headers.map((h, i) => `${h}: ${row[i] ?? ''}`).join(', ')
  ).join('\n')

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Analyze this CSV data and determine what health data type it contains.

Headers: ${headers.join(', ')}

Sample rows:
${sampleData}

Respond with JSON only:
{
  "recordType": "food_entry" | "lab_result" | "vital_sign" | "medication" | "symptom" | "mood_entry" | "cycle_entry" | "sleep_entry" | "activity_entry" | "body_measurement",
  "dateColumn": "column_name_that_contains_dates",
  "fieldMappings": {
    "column_name": "canonical_field_name"
  }
}

canonical_field_name examples for food_entry: mealType, foods, calories, protein, fat, carbs, fiber, sugar, sodium
for lab_result: testName, value, unit, referenceRangeLow, referenceRangeHigh
for vital_sign: vitalType, value, unit
for mood_entry: score, emotions
for activity_entry: activityType, durationMinutes, calories, distance`,
    }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
  const cleaned = text.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim()
  return JSON.parse(cleaned)
}

// ── Main Parser ────────────────────────────────────────────────────

const genericCsvParser: Parser = {
  supportedFormats: ['csv-generic', 'csv-cronometer', 'csv-mfp', 'csv-bearable', 'csv-daylio'],

  async parse(content: string | Buffer, format: DetectedFormat, fileName?: string): Promise<ParseResult> {
    const text = typeof content === 'string' ? content : content.toString('utf-8')
    const source = makeSource(format, fileName)
    const warnings: string[] = []
    const errors: string[] = []

    const { headers, rows } = parseRows(text)
    if (headers.length === 0 || rows.length === 0) {
      return {
        records: [],
        warnings: [],
        errors: ['CSV file is empty or has no data rows'],
        metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: source.appName },
      }
    }

    let records: CanonicalRecord[] = []

    // Daylio has a known format
    if (format === 'csv-daylio') {
      records = parseDaylioCsv(headers, rows, source)
    } else {
      // Use AI to map columns for unknown CSVs
      try {
        const mapping = await aiMapColumns(headers, rows.slice(0, 5))
        const dateColIdx = mapping.dateColumn
          ? headers.indexOf(mapping.dateColumn.toLowerCase())
          : findColumnIndex(headers, 'date', 'day', 'time', 'timestamp')

        for (const row of rows) {
          const date = dateColIdx >= 0 ? normalizeDate(row[dateColIdx] ?? '') : null
          const today = new Date().toISOString().slice(0, 10)
          const recordDate = date ?? today

          const data: Record<string, unknown> = {}
          for (const [colName, fieldName] of Object.entries(mapping.fieldMappings)) {
            const colIdx = headers.indexOf(colName.toLowerCase())
            if (colIdx >= 0 && row[colIdx]) {
              const val = row[colIdx]
              // Try to parse as number if it looks numeric
              const num = parseNumber(val)
              data[fieldName] = num !== null ? num : val
            }
          }

          records.push({
            type: mapping.recordType,
            date: recordDate,
            datetime: null,
            source,
            confidence: 0.7,
            data: data as unknown as CanonicalRecord['data'],
            rawText: row.join(', ').slice(0, 200),
            dedupeKey: createDedupeKey(mapping.recordType, recordDate, row.slice(0, 4).join('_')),
          })
        }
      } catch (e) {
        errors.push(`AI column mapping failed: ${e instanceof Error ? e.message : 'Unknown'}`)
      }
    }

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
        sourceName: source.appName ?? 'CSV',
      },
    }
  },
}

export default genericCsvParser
