import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { maybeTriggerAnalysis } from '@/lib/intelligence/auto-trigger'
import { normalizeMedicationName } from '@/lib/import/normalize-medication'
import { parseProfileContent } from '@/lib/profile/parse-content'
import {
  enforceDeclaredSize,
  DEFAULT_UPLOAD_LIMIT_BYTES,
  rateLimit,
  clientKey,
} from '@/lib/upload-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const IMPORT_LIMITER = rateLimit({ windowMs: 60_000, max: 5 })

// Model for parsing - use Haiku for speed
const PARSE_MODEL = 'claude-3-5-haiku-20241022'

type ImportCategory = 'labs' | 'appointments' | 'medications' | 'notes'

interface ParsedLabRecord {
  date: string | null
  category: string | null
  test_name: string
  value: number | null
  unit: string | null
  reference_range_low: number | null
  reference_range_high: number | null
  flag: 'normal' | 'low' | 'high' | 'critical' | null
}

interface ParsedAppointmentRecord {
  date: string | null
  doctor_name: string | null
  specialty: string | null
  clinic: string | null
  reason: string | null
  notes: string | null
}

interface ParsedMedicationRecord {
  name: string
  dose: string | null
  frequency: string | null
  route: string | null
  prescriber: string | null
  start_date: string | null
}

interface ParsedNoteRecord {
  title: string
  content: string
  date: string | null
  provider: string | null
}

// ── Regex-based quick parsers (attempt before calling Claude) ──

function tryQuickParseLabs(text: string): ParsedLabRecord[] | null {
  const records: ParsedLabRecord[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Common myAH format: Test Name    Value    Unit    Reference Range
  // Also: Date header lines like "03/15/2025  CBC with Differential"
  let currentDate: string | null = null
  let currentCategory: string | null = null

  for (const line of lines) {
    // Try to match a date header line
    const dateHeaderMatch = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+)/
    )
    if (dateHeaderMatch) {
      currentDate = normalizeDate(dateHeaderMatch[1])
      currentCategory = dateHeaderMatch[2].trim()
      continue
    }

    // Try to match a lab result line
    // Pattern: TestName  Value  Unit  Low-High
    const labMatch = line.match(
      /^(.+?)\s{2,}([\d.]+)\s+([\w/%^*]+)\s+([\d.]+)\s*[-]\s*([\d.]+)/
    )
    if (labMatch) {
      const value = parseFloat(labMatch[2])
      const low = parseFloat(labMatch[4])
      const high = parseFloat(labMatch[5])
      let flag: ParsedLabRecord['flag'] = 'normal'
      if (value < low) flag = 'low'
      if (value > high) flag = 'high'

      records.push({
        date: currentDate,
        category: currentCategory,
        test_name: labMatch[1].trim(),
        value,
        unit: labMatch[3],
        reference_range_low: low,
        reference_range_high: high,
        flag,
      })
      continue
    }

    // Alternative: "Test Name: Value Unit (Reference: Low-High)"
    const altMatch = line.match(
      /^(.+?):\s*([\d.]+)\s*([\w/%^*]*)\s*\((?:Reference|Ref|Range):\s*([\d.]+)\s*-\s*([\d.]+)\)/i
    )
    if (altMatch) {
      const value = parseFloat(altMatch[2])
      const low = parseFloat(altMatch[4])
      const high = parseFloat(altMatch[5])
      let flag: ParsedLabRecord['flag'] = 'normal'
      if (value < low) flag = 'low'
      if (value > high) flag = 'high'

      records.push({
        date: currentDate,
        category: currentCategory,
        test_name: altMatch[1].trim(),
        value,
        unit: altMatch[3] || null,
        reference_range_low: low,
        reference_range_high: high,
        flag,
      })
    }
  }

  return records.length > 0 ? records : null
}

function tryQuickParseAppointments(text: string): ParsedAppointmentRecord[] | null {
  const records: ParsedAppointmentRecord[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    // Pattern: Date  Doctor  - Specialty  - Reason
    const match = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:Dr\.?\s+)?(.+?)\s+-\s+(.+?)(?:\s+-\s+(.+))?$/
    )
    if (match) {
      records.push({
        date: normalizeDate(match[1]),
        doctor_name: match[2].trim(),
        specialty: match[3].trim(),
        clinic: null,
        reason: match[4]?.trim() || null,
        notes: null,
      })
    }
  }

  return records.length > 0 ? records : null
}

function tryQuickParseMedications(text: string): ParsedMedicationRecord[] | null {
  const records: ParsedMedicationRecord[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    // Pattern: MedicationName DoseMg - Instructions
    const match = line.match(
      /^(.+?)\s+(\d+\s*(?:mg|mcg|iu|ml|g|units?))\s*[-]\s*(.+)/i
    )
    if (match) {
      records.push({
        name: match[1].trim(),
        dose: match[2].trim(),
        frequency: match[3].trim(),
        route: null,
        prescriber: null,
        start_date: null,
      })
      continue
    }

    // Alternative: just name and dose on a line
    const simpleMatch = line.match(
      /^(.+?)\s+(\d+\s*(?:mg|mcg|iu|ml|g|units?))/i
    )
    if (simpleMatch) {
      records.push({
        name: simpleMatch[1].trim(),
        dose: simpleMatch[2].trim(),
        frequency: null,
        route: null,
        prescriber: null,
        start_date: null,
      })
    }
  }

  return records.length > 0 ? records : null
}

// ── Claude-powered parser for unstructured text ──

async function parseWithClaude(
  type: ImportCategory,
  rawText: string
): Promise<{ records: Array<Record<string, string | number | null>>; warnings: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const client = new Anthropic({ apiKey })

  const prompts: Record<ImportCategory, string> = {
    labs: `Parse the following text from a patient portal lab results page. Extract each individual lab test result.

Return a JSON array where each element has these fields:
- date: string (YYYY-MM-DD format, or null)
- category: string (panel/test group name like "CBC", "Metabolic Panel", or null)
- test_name: string (specific test name like "WBC", "Hemoglobin")
- value: number or null
- unit: string or null
- reference_range_low: number or null
- reference_range_high: number or null
- flag: "normal", "low", "high", "critical", or null

If a result has "H" or "High" marked, set flag to "high". If "L" or "Low", set flag to "low". If the value falls outside the reference range, compute the flag from the values.

If dates appear as section headers (like "March 15, 2025 - CBC"), apply that date to all results under it until a new date appears.`,

    appointments: `Parse the following text from a patient portal appointments/visits page. Extract each appointment.

Return a JSON array where each element has these fields:
- date: string (YYYY-MM-DD format, or null)
- doctor_name: string or null
- specialty: string or null
- clinic: string or null
- reason: string or null
- notes: string or null

Include provider titles like "Dr." in doctor_name.`,

    medications: `Parse the following text from a patient portal medications page. Extract each medication.

Return a JSON array where each element has these fields:
- name: string (medication name)
- dose: string or null (e.g. "500mg", "2000 IU")
- frequency: string or null (e.g. "twice daily", "once daily")
- route: string or null (e.g. "oral", "topical")
- prescriber: string or null
- start_date: string (YYYY-MM-DD) or null`,

    notes: `Parse the following clinical notes or after-visit summaries from a patient portal. Break them into logical sections.

Return a JSON array where each element has these fields:
- title: string (a short descriptive title for the note section)
- content: string (the full text content)
- date: string (YYYY-MM-DD) or null
- provider: string or null`,
  }

  const response = await client.messages.create({
    model: PARSE_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${prompts[type]}

IMPORTANT: Return ONLY a valid JSON object with two keys:
- "records": the array of parsed records
- "warnings": an array of strings noting any issues (e.g. "Could not parse date for row 3", "Ambiguous value for Hemoglobin")

Do not include any markdown formatting, code fences, or explanation. Just the raw JSON object.

Here is the text to parse:

${rawText}`,
      },
    ],
  })

  // Extract text from response
  const textContent = response.content.find(c => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from parser')
  }

  let parsed: { records: Array<Record<string, string | number | null>>; warnings: string[] }
  try {
    // Clean up potential markdown code fences
    let cleaned = textContent.text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Failed to parse AI response. The pasted text may not contain recognizable medical data.')
  }

  if (!Array.isArray(parsed.records)) {
    throw new Error('Unexpected response format from parser')
  }

  return {
    records: parsed.records,
    warnings: parsed.warnings || [],
  }
}

// ── Database import functions ──

async function importLabs(records: ParsedLabRecord[]) {
  const supabase = createServiceClient()
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const rec of records) {
    if (!rec.test_name) {
      skipped++
      continue
    }

    const row = {
      date: rec.date || new Date().toISOString().split('T')[0],
      category: rec.category || 'Imported from myAH',
      test_name: rec.test_name,
      value: rec.value,
      unit: rec.unit,
      reference_range_low: rec.reference_range_low,
      reference_range_high: rec.reference_range_high,
      flag: rec.flag,
      source_document_id: null,
    }

    const { error } = await supabase.from('lab_results').insert(row)
    if (error) {
      // Try to detect duplicates by checking for same date + test_name
      if (error.code === '23505') {
        skipped++
      } else {
        errors.push(`${rec.test_name}: ${error.message}`)
      }
    } else {
      imported++
    }
  }

  return { imported, skipped, errors }
}

async function importAppointments(records: ParsedAppointmentRecord[]) {
  const supabase = createServiceClient()
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const rec of records) {
    const row = {
      date: rec.date || new Date().toISOString().split('T')[0],
      doctor_name: rec.doctor_name,
      specialty: rec.specialty,
      clinic: rec.clinic || 'Adventist Health',
      reason: rec.reason,
      notes: rec.notes,
      action_items: null,
      follow_up_date: null,
    }

    const { error } = await supabase.from('appointments').insert(row)
    if (error) {
      if (error.code === '23505') {
        skipped++
      } else {
        errors.push(`${rec.doctor_name || 'Appointment'}: ${error.message}`)
      }
    } else {
      imported++
    }
  }

  return { imported, skipped, errors }
}

async function importMedications(records: ParsedMedicationRecord[]) {
  const supabase = createServiceClient()
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Medications go into health_profile as a JSON section
  // First, fetch existing medications from health_profile
  const { data: existing } = await supabase
    .from('health_profile')
    .select('content')
    .eq('section', 'medications')
    .maybeSingle()

  // W2.6: parseProfileContent normalizes both legacy JSON-stringified rows
  // and raw jsonb objects, so .current_medications access below is safe.
  const parsedExistingContent = parseProfileContent(existing?.content) as
    | Record<string, unknown>
    | undefined
  const existingMeds: string[] =
    (parsedExistingContent?.current_medications as string[] | undefined) || []

  const newMeds: string[] = []
  for (const rec of records) {
    const medString = [rec.name, rec.dose, rec.frequency]
      .filter(Boolean)
      .join(' - ')

    // Check if already exists using normalized (name + dose) comparison.
    // Both sides pass through normalizeMedicationName so casing, spacing,
    // dose formatting ("500 mg" vs "500mg"), and trailing verbs ("taken",
    // "logged") no longer cause missed duplicates or wrong merges.
    //
    // Existing entries are stored as "<name> - <dose> - <frequency>".
    // We build a normalized (name, dose) token for both incoming and
    // existing rows and require an exact match or a prefix match on the
    // leading name+dose segment; a bare `.includes()` substring test is
    // intentionally avoided so "Tylenol 500mg" does not collide with
    // "Tylenol PM 500mg".
    const incomingName = normalizeMedicationName(rec.name)
    const incomingDose = normalizeMedicationName(rec.dose || '')
    const incomingKey = incomingDose
      ? `${incomingName} ${incomingDose}`
      : incomingName
    const alreadyExists = existingMeds.some((m) => {
      const existingNormalized = normalizeMedicationName(m)
      if (existingNormalized === incomingKey) return true
      if (existingNormalized.startsWith(`${incomingKey} `)) return true
      if (existingNormalized.startsWith(`${incomingKey}-`)) return true
      return false
    })

    if (alreadyExists) {
      skipped++
    } else {
      newMeds.push(medString)
      imported++
    }
  }

  if (newMeds.length > 0) {
    const allMeds = [...existingMeds, ...newMeds]
    const { error } = await supabase
      .from('health_profile')
      .upsert(
        {
          section: 'medications',
          content: { current_medications: allMeds },
          updated_at: new Date().toISOString(),
          updated_by: 'myah_import',
        },
        { onConflict: 'section' }
      )

    if (error) {
      errors.push(`Medication save failed: ${error.message}`)
      imported = 0 // rollback count
    }
  }

  // Also create a medical_timeline entry for the import
  if (imported > 0) {
    await supabase.from('medical_timeline').insert({
      event_date: new Date().toISOString().split('T')[0],
      event_type: 'medication_change',
      title: `Imported ${imported} medications from myAH`,
      description: newMeds.join('; '),
      significance: 'normal',
    })
  }

  return { imported, skipped, errors }
}

async function importNotes(records: ParsedNoteRecord[]) {
  const supabase = createServiceClient()
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  // Get the max section_order so we append after existing entries
  const { data: maxRow } = await supabase
    .from('medical_narrative')
    .select('section_order')
    .order('section_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextOrder = (maxRow?.section_order || 0) + 1

  for (const rec of records) {
    if (!rec.content?.trim()) {
      skipped++
      continue
    }

    const title = rec.title || `myAH Note${rec.date ? ` - ${rec.date}` : ''}`
    const content = rec.provider
      ? `Provider: ${rec.provider}\n\n${rec.content}`
      : rec.content

    const { error } = await supabase.from('medical_narrative').insert({
      section_title: title,
      content,
      section_order: nextOrder++,
    })

    if (error) {
      errors.push(`Note "${title.slice(0, 30)}...": ${error.message}`)
    } else {
      imported++
    }
  }

  return { imported, skipped, errors }
}

// ── Helpers ──

function normalizeDate(dateStr: string): string {
  // Convert MM/DD/YYYY or MM/DD/YY to YYYY-MM-DD
  const parts = dateStr.split('/')
  if (parts.length !== 3) return dateStr

  let [month, day, year] = parts
  if (year.length === 2) {
    year = parseInt(year) > 50 ? `19${year}` : `20${year}`
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// ── Route handler ──

export async function POST(request: NextRequest) {
  const sizeDeny = enforceDeclaredSize(request, DEFAULT_UPLOAD_LIMIT_BYTES)
  if (sizeDeny) return sizeDeny
  if (!IMPORT_LIMITER.consume(clientKey(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  try {
    const contentType = request.headers.get('content-type') || ''

    // Handle file upload (PDF)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const categoriesJson = formData.get('categories') as string | null

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      }

      if (file.size > DEFAULT_UPLOAD_LIMIT_BYTES) {
        return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
      }

      // For now, extract text from PDF using a simple approach
      // In the future this could use a PDF parsing library
      const text = await file.text()

      if (!text.trim()) {
        return NextResponse.json(
          { error: 'Could not extract text from the uploaded file. Try copying and pasting the data instead.' },
          { status: 400 }
        )
      }

      const categories: ImportCategory[] = categoriesJson
        ? JSON.parse(categoriesJson)
        : ['labs', 'appointments', 'medications', 'notes']

      const results = []
      for (const cat of categories) {
        const parsed = await parseWithClaude(cat, text)
        results.push({
          category: cat,
          records: parsed.records.map((r) => ({ raw: '', parsed: r })),
          warnings: parsed.warnings,
        })
      }

      return NextResponse.json({ results })
    }

    // Handle JSON requests (paste mode)
    const body = await request.json()
    const { type, rawText, action, records } = body as {
      type: ImportCategory
      rawText?: string
      action: 'parse' | 'import'
      records?: Array<Record<string, string | number | null>>
    }

    if (!type || !['labs', 'appointments', 'medications', 'notes'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid import type. Must be one of: labs, appointments, medications, notes' },
        { status: 400 }
      )
    }

    // ── Parse action ──
    if (action === 'parse') {
      if (!rawText?.trim()) {
        return NextResponse.json(
          { error: 'No text provided to parse' },
          { status: 400 }
        )
      }

      // Try quick regex parsing first
      let quickResult: Array<Record<string, string | number | null>> | null = null

      if (type === 'labs') {
        const quick = tryQuickParseLabs(rawText)
        if (quick) quickResult = quick as unknown as Array<Record<string, string | number | null>>
      } else if (type === 'appointments') {
        const quick = tryQuickParseAppointments(rawText)
        if (quick) quickResult = quick as unknown as Array<Record<string, string | number | null>>
      } else if (type === 'medications') {
        const quick = tryQuickParseMedications(rawText)
        if (quick) quickResult = quick as unknown as Array<Record<string, string | number | null>>
      }

      if (quickResult && quickResult.length > 0) {
        return NextResponse.json({
          records: quickResult.map((r) => ({ raw: '', parsed: r })),
          warnings: [],
          parser: 'regex',
        })
      }

      // Fall back to Claude parsing
      const parsed = await parseWithClaude(type, rawText)
      return NextResponse.json({
        records: parsed.records.map((r) => ({ raw: '', parsed: r })),
        warnings: parsed.warnings,
        parser: 'claude',
      })
    }

    // ── Import action ──
    if (action === 'import') {
      if (!records || !Array.isArray(records) || records.length === 0) {
        return NextResponse.json(
          { error: 'No records to import' },
          { status: 400 }
        )
      }

      let result: { imported: number; skipped: number; errors: string[] }

      switch (type) {
        case 'labs':
          result = await importLabs(records as unknown as ParsedLabRecord[])
          break
        case 'appointments':
          result = await importAppointments(records as unknown as ParsedAppointmentRecord[])
          break
        case 'medications':
          result = await importMedications(records as unknown as ParsedMedicationRecord[])
          break
        case 'notes':
          result = await importNotes(records as unknown as ParsedNoteRecord[])
          break
        default:
          return NextResponse.json(
            { error: 'Unknown import type' },
            { status: 400 }
          )
      }

      // Trigger clinical intelligence analysis for imported records
      if (result.imported > 0) {
        await maybeTriggerAnalysis('import_myah', result.imported)
      }

      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be "parse" or "import"' },
      { status: 400 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    console.error('[myAH Import Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
