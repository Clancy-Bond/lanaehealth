/**
 * Generic JSON Parser
 *
 * Handles JSON exports from health apps (Flo, Clue, and unknown formats).
 * Uses Claude AI to understand the schema and extract canonical records.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  DetectedFormat, ParseResult, CanonicalRecord, CanonicalRecordType,
  ImportSource, Parser,
} from '../types'
import { createDedupeKey } from '../deduplicator'

const MODEL = 'claude-3-5-haiku-20241022'

function makeSource(format: DetectedFormat, fileName?: string): ImportSource {
  return {
    format,
    fileName: fileName ?? null,
    appName: format === 'json-flo' ? 'Flo' : format === 'json-clue' ? 'Clue' : 'JSON Import',
    importedAt: new Date().toISOString(),
    parserVersion: '1.0.0',
  }
}

const EXTRACTION_PROMPT = `You are a health data extraction system. Analyze this JSON data from a health app export and extract ALL health records.

For each record, output:
- type: one of "lab_result", "vital_sign", "medication", "condition", "symptom", "appointment", "food_entry", "cycle_entry", "mood_entry", "sleep_entry", "activity_entry", "body_measurement", "clinical_note"
- date: ISO date YYYY-MM-DD
- data: structured fields (see types below)
- confidence: 0-1

Type fields:
- cycle_entry: { cycleDay, flow (none/spotting/light/medium/heavy), temperature, cervicalMucus, lhTest, ovulationStatus, notes }
- mood_entry: { score (1-5), emotions (array), notes }
- symptom: { name, severity (0-10), bodyRegion, duration }
- food_entry: { mealType, foods, calories, protein, fat, carbs }
- sleep_entry: { totalMinutes, sleepScore, deepMinutes, remMinutes }
- activity_entry: { activityType, durationMinutes, calories }

Respond with ONLY a JSON array. If no health data, respond with [].`

const genericJsonParser: Parser = {
  supportedFormats: ['json-flo', 'json-clue', 'json-generic'],

  async parse(content: string | Buffer, format: DetectedFormat, fileName?: string): Promise<ParseResult> {
    const text = typeof content === 'string' ? content : content.toString('utf-8')
    const source = makeSource(format, fileName)
    const warnings: string[] = []
    const errors: string[] = []

    // Truncate for API call if very large
    const truncated = text.length > 12000 ? text.slice(0, 12000) + '\n... [truncated]' : text

    const client = new Anthropic()

    let extracted: Array<{
      type: CanonicalRecordType
      date: string | null
      data: Record<string, unknown>
      confidence: number
    }> = []

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\n--- JSON DATA ---\n${truncated}`,
        }],
      })

      const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '[]'
      const cleaned = responseText.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim()
      extracted = JSON.parse(cleaned)
      if (!Array.isArray(extracted)) extracted = []

      if (text.length > 12000) {
        warnings.push(`JSON was truncated for analysis (${text.length} bytes). Some records may be missing.`)
      }
    } catch (e) {
      errors.push(`JSON extraction failed: ${e instanceof Error ? e.message : 'Unknown'}`)
    }

    const today = new Date().toISOString().slice(0, 10)
    const records: CanonicalRecord[] = extracted.map((item) => ({
      type: item.type,
      date: item.date ?? today,
      datetime: null,
      source,
      confidence: item.confidence ?? 0.7,
      data: item.data as unknown as CanonicalRecord['data'],
      rawText: null,
      dedupeKey: createDedupeKey(item.type, item.date ?? today, JSON.stringify(item.data).slice(0, 100)),
    }))

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
        sourceName: source.appName ?? 'JSON',
      },
    }
  },
}

export default genericJsonParser
