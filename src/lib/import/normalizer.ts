/**
 * Claude AI Normalization Layer
 *
 * Takes semi-structured or ambiguous extracted data and normalizes it
 * to fit the canonical record schema. Handles edge cases that structured
 * parsers can't: mixed date formats, abbreviated lab names, unclear units,
 * medication name variations, etc.
 *
 * Also validates extracted data against medical reference ranges and flags
 * suspicious values (e.g., a heart rate of 500 bpm is likely a typo).
 */

import Anthropic from '@anthropic-ai/sdk'
import type { CanonicalRecord, CanonicalRecordData } from './types'

const MODEL = 'claude-haiku-4-5-20251001'

const NORMALIZATION_PROMPT = `You are a medical data normalization system. Given extracted health records that may have errors or ambiguity, clean and validate each record.

For each record:
1. Normalize dates to YYYY-MM-DD format
2. Standardize lab test names (e.g., "WBC" and "White Blood Cell Count" -> "WBC")
3. Validate numeric values against medical reference ranges
4. Flag values that are physiologically impossible (mark confidence: 0.3)
5. Standardize units (e.g., "mg/dl" -> "mg/dL", "K/ul" -> "K/uL")
6. Resolve medication name variations to standard names
7. Ensure all required fields are present

Respond with a JSON array of the same records, cleaned up. For each record include a "normalizedFields" array listing which fields were changed.

Medical reference ranges for validation:
- Heart rate: 30-220 bpm (flag outside this)
- Blood pressure systolic: 60-250 mmHg
- Blood pressure diastolic: 30-150 mmHg
- Temperature: 95-108 F or 35-42 C
- SpO2: 70-100%
- Blood glucose: 20-600 mg/dL
- Weight: 50-500 lbs or 20-250 kg
- Hemoglobin: 3-20 g/dL
- WBC: 1-30 K/uL
- Platelets: 50-600 K/uL`

/**
 * Normalize a batch of canonical records using Claude AI.
 * Validates values, standardizes names/units, and flags suspicious data.
 */
export async function normalizeRecords(
  records: CanonicalRecord[],
): Promise<{ records: CanonicalRecord[]; changes: string[] }> {
  if (records.length === 0) return { records: [], changes: [] }

  // Only normalize records that might have issues (lower confidence)
  const needsNormalization = records.filter(r => r.confidence < 0.85)
  const highConfidence = records.filter(r => r.confidence >= 0.85)

  if (needsNormalization.length === 0) {
    return { records, changes: [] }
  }

  const client = new Anthropic()
  const changes: string[] = []

  try {
    // Prepare a compact representation for the API
    const compact = needsNormalization.map((r, i) => ({
      index: i,
      type: r.type,
      date: r.date,
      confidence: r.confidence,
      data: r.data,
    }))

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `${NORMALIZATION_PROMPT}\n\n--- RECORDS TO NORMALIZE ---\n${JSON.stringify(compact, null, 2)}`,
      }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]'
    const cleaned = text.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim()
    const normalized = JSON.parse(cleaned) as Array<{
      index: number
      date: string
      confidence: number
      data: Record<string, unknown>
      normalizedFields: string[]
    }>

    // Apply normalizations back to original records
    for (const norm of normalized) {
      const original = needsNormalization[norm.index]
      if (!original) continue

      if (norm.date && norm.date !== original.date) {
        original.date = norm.date
        changes.push(`Record ${norm.index}: date normalized to ${norm.date}`)
      }

      if (norm.confidence !== undefined) {
        original.confidence = norm.confidence
      }

      if (norm.data) {
        original.data = norm.data as unknown as CanonicalRecordData
      }

      if (norm.normalizedFields?.length) {
        changes.push(`Record ${norm.index}: normalized fields: ${norm.normalizedFields.join(', ')}`)
      }
    }
  } catch (e) {
    changes.push(`Normalization had an issue: ${e instanceof Error ? e.message : 'Unknown'} -- using raw data`)
  }

  return {
    records: [...highConfidence, ...needsNormalization],
    changes,
  }
}

/**
 * Quick validation pass -- flags impossible values without Claude API call.
 * Runs locally, no network needed.
 */
export function quickValidate(records: CanonicalRecord[]): CanonicalRecord[] {
  for (const record of records) {
    const data = record.data as unknown as Record<string, unknown>

    switch (record.type) {
      case 'vital_sign': {
        const value = data.value as number
        const type = data.vitalType as string

        if (type === 'heart_rate' && (value < 20 || value > 250)) {
          record.confidence = Math.min(record.confidence, 0.2)
        }
        if (type === 'blood_pressure' && (value < 50 || value > 300)) {
          record.confidence = Math.min(record.confidence, 0.2)
        }
        if (type === 'spo2' && (value < 50 || value > 100)) {
          record.confidence = Math.min(record.confidence, 0.2)
        }
        if (type === 'temperature') {
          // Could be F or C
          if (value > 50 && value < 115) { /* Fahrenheit range -- ok */ }
          else if (value > 30 && value < 45) { /* Celsius range -- ok */ }
          else record.confidence = Math.min(record.confidence, 0.2)
        }
        break
      }
      case 'lab_result': {
        const value = data.value as number | null
        if (value !== null && value < 0) {
          record.confidence = Math.min(record.confidence, 0.3)
        }
        break
      }
    }

    // Validate date is reasonable (not in the future, not before 1900)
    if (record.date) {
      const d = new Date(record.date)
      if (d > new Date(Date.now() + 24 * 60 * 60 * 1000)) {
        record.confidence = Math.min(record.confidence, 0.3) // Future date
      }
      if (d < new Date('1900-01-01')) {
        record.confidence = Math.min(record.confidence, 0.1) // Way too old
      }
    }
  }

  return records
}
