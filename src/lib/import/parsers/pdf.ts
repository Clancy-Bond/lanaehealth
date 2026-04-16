/**
 * PDF Medical Document Parser
 *
 * Extracts text from PDF files and sends to Claude for structured extraction.
 * For now, converts PDF to image and uses Vision, since Next.js serverless
 * doesn't easily support native PDF text extraction libraries.
 *
 * Strategy: PDF -> base64 image (page by page) -> Claude Vision -> canonical records
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  DetectedFormat, ParseResult, CanonicalRecord, CanonicalRecordType,
  ImportSource, Parser,
} from '../types'
import { createDedupeKey } from '../deduplicator'

const MODEL = 'claude-sonnet-4-6'

const EXTRACTION_PROMPT = `You are a medical document analysis system. This is a PDF of a medical document.

Identify the document type and extract ALL health data. For each item provide:
- type: one of "lab_result", "vital_sign", "medication", "condition", "symptom", "appointment", "procedure", "allergy", "immunization", "clinical_note"
- date: ISO date YYYY-MM-DD
- data: structured fields appropriate to the type
- confidence: 0-1

Type-specific data fields:
- lab_result: { testName, value, unit, referenceRangeLow, referenceRangeHigh, flag (normal/low/high/critical), category }
- vital_sign: { vitalType, value, value2, unit }
- medication: { name, dose, unit, frequency, route, prescriber, startDate, status }
- condition: { name, status, onsetDate, severity }
- appointment: { doctorName, specialty, clinic, reason, notes }
- procedure: { name, status, performer }
- allergy: { substance, reaction, severity }
- immunization: { vaccine, status }
- clinical_note: { title, content, author, noteType }

Respond with JSON only:
{
  "documentType": "description of document",
  "records": [ ... ]
}`

function makeSource(fileName?: string): ImportSource {
  return {
    format: 'pdf-medical',
    fileName: fileName ?? null,
    appName: 'PDF Import',
    importedAt: new Date().toISOString(),
    parserVersion: '1.0.0',
  }
}

const pdfParser: Parser = {
  supportedFormats: ['pdf-medical'],

  async parse(content: string | Buffer, _format: DetectedFormat, fileName?: string): Promise<ParseResult> {
    const source = makeSource(fileName)
    const warnings: string[] = []
    const errors: string[] = []

    // Convert to base64 for the API
    const base64 = typeof content === 'string'
      ? content.replace(/^data:application\/pdf;base64,/, '')
      : Buffer.from(content).toString('base64')

    const client = new Anthropic()

    let extracted: {
      documentType: string
      records: Array<{
        type: CanonicalRecordType
        date: string | null
        data: Record<string, unknown>
        confidence: number
      }>
    } = { documentType: 'unknown', records: [] }

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        }],
      })

      const responseText = response.content[0]?.type === 'text'
        ? response.content[0].text : '{}'

      const cleaned = responseText
        .replace(/^```json?\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim()

      extracted = JSON.parse(cleaned)
    } catch (e) {
      errors.push(`PDF extraction failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return {
        records: [],
        warnings,
        errors,
        metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: 'PDF Import' },
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const records: CanonicalRecord[] = (extracted.records ?? []).map((item) => ({
      type: item.type,
      date: item.date ?? today,
      datetime: null,
      source,
      confidence: item.confidence ?? 0.75,
      data: item.data as unknown as CanonicalRecord['data'],
      rawText: `[PDF: ${extracted.documentType}]`,
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
        sourceName: `PDF Import (${extracted.documentType})`,
      },
    }
  },
}

export default pdfParser
