/**
 * Universal Import API Route
 *
 * POST /api/import/universal
 *
 * Two-phase import:
 * Phase 1 (detect + parse): Send file, get back detected format + extracted records for review
 * Phase 2 (confirm + save): Send confirmed records, save to Supabase
 *
 * Accepts:
 * - multipart/form-data with file(s)
 * - application/json with { content: base64, fileName, mimeType } for images/screenshots
 * - application/json with { action: 'confirm', records: CanonicalRecord[] } for Phase 2
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { runImportPipeline } from '@/lib/import'
import { deduplicateRecords, filterExistingRecords } from '@/lib/import/deduplicator'
import type { CanonicalRecord } from '@/lib/import/types'
import { parseProfileContent } from '@/lib/profile/parse-content'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ── Phase 1: Detect + Parse ────────────────────────────────────────

async function handleParse(req: NextRequest): Promise<NextResponse> {
  const contentType = req.headers.get('content-type') ?? ''

  let content: string | Buffer
  let fileName: string | undefined
  let mimeType: string | undefined

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const arrayBuffer = await file.arrayBuffer()
    content = Buffer.from(arrayBuffer)
    fileName = file.name
    mimeType = file.type
  } else {
    // JSON body with base64 content
    const body = await req.json()

    if (body.action === 'confirm') {
      return handleConfirm(body.records)
    }

    if (!body.content) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    // If content is base64, keep as string (for images)
    content = body.content
    fileName = body.fileName
    mimeType = body.mimeType
  }

  // Size check (50MB max)
  const size = typeof content === 'string' ? Buffer.byteLength(content) : content.length
  if (size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 })
  }

  try {
    const result = await runImportPipeline({ content, fileName, mimeType })

    // Deduplicate within the imported set
    const { unique, duplicateCount } = deduplicateRecords(result.parseResult.records)

    // Check for legacy format redirect
    const legacyFormats = ['apple-health-xml', 'csv-mynetdiary', 'csv-natural-cycles']
    if (legacyFormats.includes(result.detection.format)) {
      const routes: Record<string, string> = {
        'apple-health-xml': '/api/import/apple-health',
        'csv-mynetdiary': '/api/import/mynetdiary',
        'csv-natural-cycles': '/api/import/natural-cycles',
      }
      return NextResponse.json({
        phase: 'redirect',
        format: result.detection,
        redirectTo: routes[result.detection.format],
        message: `This is a ${result.detection.format} file. Use the dedicated importer for best results.`,
      })
    }

    return NextResponse.json({
      phase: 'review',
      format: result.detection,
      records: unique,
      duplicateCount,
      metadata: result.parseResult.metadata,
      warnings: result.parseResult.warnings,
      errors: result.parseResult.errors,
    })
  } catch (e) {
    console.error('Import pipeline error:', e)
    return NextResponse.json(
      { error: `Import failed: ${e instanceof Error ? e.message : 'Unknown error'}` },
      { status: 500 },
    )
  }
}

// ── Phase 2: Confirm + Save ────────────────────────────────────────

async function handleConfirm(records: CanonicalRecord[]): Promise<NextResponse> {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'No records to save' }, { status: 400 })
  }

  // Filter out records that already exist in the database. This replaces the
  // previous upsert+onConflict pattern, which was broken because none of the
  // composite unique constraints it referenced (date,test_name etc.) exist in
  // the live schema. filterExistingRecords does a per-record existence check
  // and returns only the records that are genuinely new.
  const { newRecords, existingCount } = await filterExistingRecords(records)

  const supabase = createServiceClient()
  const saved: Record<string, number> = {}
  const errors: string[] = []

  for (const record of newRecords) {
    try {
      switch (record.type) {
        case 'lab_result': {
          const data = record.data as unknown as Record<string, unknown>
          const { error } = await supabase.from('lab_results').insert({
            date: record.date,
            test_name: data.testName,
            value: data.value,
            unit: data.unit,
            reference_range_low: data.referenceRangeLow,
            reference_range_high: data.referenceRangeHigh,
            flag: data.flag ?? 'normal',
            category: data.category,
            source_document_id: `import_${record.source.format}_${record.source.importedAt}`,
          })
          if (error) throw error
          saved.lab_result = (saved.lab_result ?? 0) + 1
          break
        }

        case 'medication': {
          const data = record.data as unknown as Record<string, unknown>
          // Add to medical_timeline as a medication event
          const descriptionParts = [data.dose, data.unit, data.frequency, data.route]
            .filter(Boolean)
            .join(' ')
          const { error } = await supabase.from('medical_timeline').insert({
            event_date: record.date,
            event_type: 'medication_change',
            title: `Medication: ${data.name}`,
            description: [descriptionParts, `(source: import_${record.source.format})`]
              .filter(Boolean)
              .join(' '),
            significance: 'normal',
          })
          if (error) throw error
          saved.medication = (saved.medication ?? 0) + 1
          break
        }

        case 'condition': {
          const data = record.data as unknown as Record<string, unknown>
          // active_problems has columns (problem, status, onset_date, latest_data, ...).
          // There is no icd_code column; fold that into latest_data / notes.
          const latestDataParts: string[] = []
          if (data.icdCode) latestDataParts.push(`ICD: ${data.icdCode}`)
          if (data.severity) latestDataParts.push(`Severity: ${data.severity}`)
          const { error } = await supabase.from('active_problems').insert({
            problem: data.name,
            status: data.status ?? 'active',
            onset_date: data.onsetDate,
            latest_data: latestDataParts.length > 0 ? latestDataParts.join('; ') : null,
          })
          if (error) throw error
          saved.condition = (saved.condition ?? 0) + 1
          break
        }

        case 'appointment': {
          const data = record.data as unknown as Record<string, unknown>
          const { error } = await supabase.from('appointments').insert({
            date: record.date,
            doctor_name: data.doctorName,
            specialty: data.specialty,
            clinic: data.clinic ?? 'Imported',
            reason: data.reason,
            notes: data.notes,
          })
          if (error) throw error
          saved.appointment = (saved.appointment ?? 0) + 1
          break
        }

        case 'allergy': {
          const data = record.data as unknown as Record<string, unknown>
          // Store in health_profile allergies section. health_profile(section) DOES
          // have a unique constraint (migration 001), so upsert is safe here.
          const { data: profile } = await supabase
            .from('health_profile')
            .select('content')
            .eq('section', 'allergies')
            .single()

          // W2.6: parseProfileContent normalizes both legacy JSON-stringified
          // rows and raw jsonb objects so the .items access below is safe.
          const parsedContent = parseProfileContent(profile?.content) as
            | Record<string, unknown>
            | undefined
          const existing = (parsedContent?.items as string[] | undefined) ?? []
          const substance = data.substance as string
          if (!existing.includes(substance)) {
            existing.push(substance)
            await supabase.from('health_profile').upsert({
              section: 'allergies',
              content: { items: existing },
            }, { onConflict: 'section' })
          }
          saved.allergy = (saved.allergy ?? 0) + 1
          break
        }

        case 'immunization': {
          const data = record.data as unknown as Record<string, unknown>
          const { error } = await supabase.from('medical_timeline').insert({
            event_date: record.date,
            event_type: 'test',
            title: `Immunization: ${data.vaccine}`,
            description: `${data.vaccine} - ${data.status} (source: import_${record.source.format})`,
            significance: 'normal',
          })
          if (error) throw error
          saved.immunization = (saved.immunization ?? 0) + 1
          break
        }

        case 'procedure': {
          const data = record.data as unknown as Record<string, unknown>
          const descriptionParts = [data.performer, data.location].filter(Boolean).join(' at ')
          const { error } = await supabase.from('medical_timeline').insert({
            event_date: record.date,
            event_type: 'test',
            title: `Procedure: ${data.name}`,
            description: [descriptionParts, `(source: import_${record.source.format})`]
              .filter(Boolean)
              .join(' '),
            significance: 'important',
          })
          if (error) throw error
          saved.procedure = (saved.procedure ?? 0) + 1
          break
        }

        case 'vital_sign': {
          const data = record.data as unknown as Record<string, unknown>
          // Store as a lab result with vital sign category
          const { error } = await supabase.from('lab_results').insert({
            date: record.date,
            test_name: data.vitalType as string,
            value: data.value,
            unit: data.unit,
            category: 'Vitals',
            flag: 'normal',
            source_document_id: `import_${record.source.format}`,
          })
          if (error) throw error
          saved.vital_sign = (saved.vital_sign ?? 0) + 1
          break
        }

        case 'clinical_note': {
          const data = record.data as unknown as Record<string, unknown>
          // medical_narrative has no date column. Prepend the date to content so
          // the context is preserved, and drop the date field from the payload.
          const content = `[${record.date}] ${data.content ?? ''}`
          const { error } = await supabase.from('medical_narrative').insert({
            section_title: data.title ?? 'Imported Note',
            content,
            section_order: 0,
          })
          if (error) throw error
          saved.clinical_note = (saved.clinical_note ?? 0) + 1
          break
        }

        default:
          // For types without dedicated tables, store in medical_timeline
          const { error } = await supabase.from('medical_timeline').insert({
            event_date: record.date,
            event_type: 'test',
            title: `Imported: ${record.type}`,
            description: `${JSON.stringify(record.data).slice(0, 400)} (source: import_${record.source.format})`,
            significance: 'normal',
          })
          if (error) throw error
          saved[record.type] = (saved[record.type] ?? 0) + 1
      }
    } catch (e) {
      errors.push(`Failed to save ${record.type}: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }

  const totalSaved = Object.values(saved).reduce((a, b) => a + b, 0)

  // Log to import_history
  if (totalSaved > 0) {
    const firstRecord = records[0]
    const dates = records.map(r => r.date).filter(Boolean).sort()
    await supabase.from('import_history').insert({
      format: firstRecord?.source?.format ?? 'unknown',
      file_name: firstRecord?.source?.fileName,
      source_app: firstRecord?.source?.appName,
      records_imported: totalSaved,
      records_by_type: saved,
      date_range_start: dates[0] ?? null,
      date_range_end: dates[dates.length - 1] ?? null,
      warnings: [],
      errors,
    })
  }

  return NextResponse.json({
    phase: 'complete',
    saved,
    totalSaved,
    skippedAsDuplicate: existingCount,
    errors,
  })
}

// ── Route Handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  return handleParse(req)
}
