/**
 * Screenshot / Medical Image OCR Parser
 *
 * Extends the existing lab photo scanner to handle ANY medical document:
 * lab results, appointment summaries, medication lists, discharge papers,
 * referral letters, etc.
 *
 * Uses Claude Vision to identify document type and extract structured data.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  DetectedFormat, ParseResult, CanonicalRecord, CanonicalRecordType,
  ImportSource, Parser,
} from '../types'
import { createDedupeKey } from '../deduplicator'

const MODEL = 'claude-sonnet-4-6'
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const VALID_MEDIA_TYPES: MediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const EXTRACTION_PROMPT = `You are a medical document OCR system. Analyze this image and extract ALL health-related data.

First, identify the document type (lab results, appointment summary, medication list, discharge summary, referral letter, vital signs, imaging report, insurance card, prescription, or other).

Then extract every piece of structured data you can find. For each item, provide:
- type: one of "lab_result", "vital_sign", "medication", "condition", "symptom", "appointment", "procedure", "allergy", "immunization", "clinical_note"
- date: ISO date YYYY-MM-DD if visible, or null
- data: structured fields appropriate to the type
- confidence: 0-1 how confident you are

Type-specific data fields:
- lab_result: { testName, value, unit, referenceRangeLow, referenceRangeHigh, flag (normal/low/high/critical), category }
- vital_sign: { vitalType (blood_pressure/heart_rate/temperature/respiratory_rate/spo2/weight/blood_glucose), value, value2 (for BP diastolic), unit }
- medication: { name, dose, unit, frequency, route, prescriber, startDate, status }
- condition: { name, status (active/resolved), onsetDate }
- appointment: { doctorName, specialty, clinic, reason, notes }
- procedure: { name, status, performer, location }
- allergy: { substance, reaction, severity }
- immunization: { vaccine, status, lotNumber }
- clinical_note: { title, content, author, noteType }

Respond with ONLY a JSON object:
{
  "documentType": "lab results",
  "records": [ ... array of extracted records ... ]
}

If you cannot read the image clearly, add "uncertain": true to affected records.
If the image is not a medical document, respond with: { "documentType": "non-medical", "records": [] }`

function makeSource(fileName?: string): ImportSource {
  return {
    format: 'image-medical',
    fileName: fileName ?? null,
    appName: 'Claude Vision OCR',
    importedAt: new Date().toISOString(),
    parserVersion: '1.0.0',
  }
}

function detectMediaType(content: Buffer): MediaType {
  // Check magic bytes
  if (content[0] === 0xFF && content[1] === 0xD8) return 'image/jpeg'
  if (content[0] === 0x89 && content[1] === 0x50) return 'image/png'
  if (content.slice(0, 4).toString() === 'RIFF' && content.slice(8, 12).toString() === 'WEBP') return 'image/webp'
  if (content.slice(0, 3).toString() === 'GIF') return 'image/gif'
  return 'image/jpeg' // default
}

const screenshotParser: Parser = {
  supportedFormats: ['image-medical'],

  async parse(content: string | Buffer, _format: DetectedFormat, fileName?: string): Promise<ParseResult> {
    const source = makeSource(fileName)
    const warnings: string[] = []
    const errors: string[] = []

    // Handle both base64 string and Buffer
    let base64: string
    let mediaType: MediaType

    if (typeof content === 'string') {
      // Assume it's already base64 or a data URL
      base64 = content.replace(/^data:image\/\w+;base64,/, '')
      const mimeMatch = content.match(/^data:(image\/\w+);base64,/)
      mediaType = (mimeMatch?.[1] as MediaType) ?? 'image/jpeg'
    } else {
      if (content.length > MAX_IMAGE_SIZE) {
        return {
          records: [],
          warnings: [],
          errors: [`Image exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`],
          metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Claude Vision OCR' },
        }
      }
      base64 = content.toString('base64')
      mediaType = detectMediaType(content)
    }

    if (!VALID_MEDIA_TYPES.includes(mediaType)) {
      mediaType = 'image/jpeg'
      warnings.push(`Unknown image type, treating as JPEG`)
    }

    const client = new Anthropic()

    let extracted: { documentType: string; records: Array<{
      type: CanonicalRecordType
      date: string | null
      data: Record<string, unknown>
      confidence: number
    }> } = { documentType: 'unknown', records: [] }

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        }],
      })

      const responseText = response.content[0]?.type === 'text'
        ? response.content[0].text : ''

      const jsonStr = responseText
        .replace(/^```json?\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      extracted = JSON.parse(jsonStr)

      if (extracted.documentType === 'non-medical') {
        return {
          records: [],
          warnings: ['This does not appear to be a medical document'],
          errors: [],
          metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Claude Vision OCR' },
        }
      }
    } catch (e) {
      errors.push(`Claude Vision extraction failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return {
        records: [],
        warnings,
        errors,
        metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'Claude Vision OCR' },
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const records: CanonicalRecord[] = (extracted.records ?? []).map((item) => ({
      type: item.type,
      date: item.date ?? today,
      datetime: null,
      source,
      confidence: item.confidence ?? 0.7,
      data: item.data as unknown as CanonicalRecord['data'],
      rawText: `[Image: ${extracted.documentType}]`,
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
        sourceName: `Claude Vision OCR (${extracted.documentType})`,
      },
    }
  },
}

export default screenshotParser
