/**
 * Claude AI Text Parser
 *
 * Handles unstructured text: portal copy-paste, clinical notes, plain text.
 * Uses Claude to identify and extract structured health data.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  DetectedFormat, ParseResult, CanonicalRecord, CanonicalRecordType,
  ImportSource, Parser,
} from '../types'
import { createDedupeKey } from '../deduplicator'

const MODEL = 'claude-3-5-haiku-20241022'

const EXTRACTION_PROMPT = `You are a medical data extraction system. Analyze the following text and extract ALL health-related data you can find.

For each piece of data, output a JSON object with these fields:
- type: one of "lab_result", "vital_sign", "medication", "condition", "symptom", "appointment", "procedure", "allergy", "immunization", "clinical_note"
- date: ISO date YYYY-MM-DD if found, or null
- data: structured fields appropriate to the type (see below)
- confidence: 0-1 how confident you are in the extraction

Type-specific data fields:
- lab_result: { testName, value, unit, referenceRangeLow, referenceRangeHigh, flag, category }
- vital_sign: { vitalType, value, value2 (for BP diastolic), unit, position, context }
- medication: { name, dose, unit, frequency, route, prescriber, startDate, status, reason }
- condition: { name, status, onsetDate, severity, icdCode }
- symptom: { name, severity, bodyRegion, duration }
- appointment: { doctorName, specialty, clinic, reason, notes }
- procedure: { name, status, performer, location }
- allergy: { substance, reaction, severity, status }
- immunization: { vaccine, status, lotNumber }
- clinical_note: { title, content, author, noteType }

Respond with ONLY a JSON array. No other text. If no health data found, respond with [].`

function makeSource(format: DetectedFormat, fileName?: string): ImportSource {
  return {
    format,
    fileName: fileName ?? null,
    appName: 'Claude AI',
    importedAt: new Date().toISOString(),
    parserVersion: '1.0.0',
  }
}

const textAiParser: Parser = {
  supportedFormats: ['text-plain', 'unknown'],

  async parse(content: string | Buffer, format: DetectedFormat, fileName?: string): Promise<ParseResult> {
    const text = typeof content === 'string' ? content : content.toString('utf-8')
    const source = makeSource(format, fileName)

    if (text.trim().length < 10) {
      return {
        records: [],
        warnings: ['Text content is too short to extract meaningful data'],
        errors: [],
        metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Claude AI' },
      }
    }

    const client = new Anthropic()
    const warnings: string[] = []
    const errors: string[] = []

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
          content: `${EXTRACTION_PROMPT}\n\n--- TEXT TO ANALYZE ---\n${text.slice(0, 8000)}`,
        }],
      })

      const responseText = response.content[0]?.type === 'text'
        ? response.content[0].text : ''

      // Parse JSON, handling markdown code fences
      const jsonStr = responseText
        .replace(/^```json?\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      extracted = JSON.parse(jsonStr)
      if (!Array.isArray(extracted)) extracted = []
    } catch (e) {
      errors.push(`Claude extraction failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return {
        records: [],
        warnings,
        errors,
        metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Claude AI' },
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const records: CanonicalRecord[] = extracted.map((item) => ({
      type: item.type,
      date: item.date ?? today,
      datetime: null,
      source,
      confidence: item.confidence ?? 0.7,
      data: item.data as unknown as CanonicalRecord['data'],
      rawText: text.slice(0, 500),
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
        sourceName: 'Claude AI',
      },
    }
  },
}

export default textAiParser
