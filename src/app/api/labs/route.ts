/**
 * Labs API Route
 *
 * POST /api/labs - Insert lab result(s)
 *
 * Single: { date, test_name, value, unit, reference_range_low, reference_range_high, category }
 * Batch:  { results: Array<{ date, test_name, value, unit, ... }>, source?: string }
 *
 * Auto-computes the flag based on value vs reference range.
 * Batch mode also creates a medical_timeline event.
 */

import { createServiceClient } from '@/lib/supabase'

interface LabInput {
  date: string
  test_name: string
  value: number | null
  unit: string | null
  reference_range_low: number | null
  reference_range_high: number | null
  category: string
}

interface BatchBody {
  results: LabInput[]
  source?: string // e.g. "photo_scan"
}

function computeFlag(
  value: number | null,
  low: number | null,
  high: number | null
): 'normal' | 'low' | 'high' {
  if (value === null) return 'normal'
  if (low !== null && value < low) return 'low'
  if (high !== null && value > high) return 'high'
  return 'normal'
}

function isBatchBody(body: unknown): body is BatchBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'results' in body &&
    Array.isArray((body as BatchBody).results)
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Batch import mode
    if (isBatchBody(body)) {
      const { results, source } = body

      if (results.length === 0) {
        return Response.json(
          { error: 'No results to import' },
          { status: 400 }
        )
      }

      // Validate each result
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (!r.date || !r.test_name) {
          return Response.json(
            { error: `Result ${i + 1} missing required fields: date, test_name` },
            { status: 400 }
          )
        }
      }

      // Prepare rows with computed flags
      const rows = results.map((r) => ({
        date: r.date,
        test_name: r.test_name.trim(),
        value: r.value ?? null,
        unit: r.unit?.trim() || null,
        reference_range_low: r.reference_range_low ?? null,
        reference_range_high: r.reference_range_high ?? null,
        category: r.category || 'Other',
        flag: computeFlag(
          r.value ?? null,
          r.reference_range_low ?? null,
          r.reference_range_high ?? null
        ),
      }))

      const supabase = createServiceClient()

      const { data, error } = await supabase
        .from('lab_results')
        .insert(rows)
        .select()

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      // Add a timeline event for batch imports
      const uniqueDates = [...new Set(results.map((r) => r.date))].sort()
      const eventDate = uniqueDates[0] || new Date().toISOString().split('T')[0]
      const sourceLabel = source === 'photo_scan' ? 'scanned from photo' : 'batch imported'

      await supabase.from('medical_timeline').insert({
        event_date: eventDate,
        event_type: 'test',
        title: `Lab results ${sourceLabel}: ${results.length} tests imported`,
        description: `Tests: ${results.map((r) => r.test_name).join(', ')}`,
        significance: 'normal',
        linked_data: {},
      })

      return Response.json({
        success: true,
        results: data,
        count: data?.length ?? 0,
      })
    }

    // Single insert mode (original behavior)
    const singleBody = body as LabInput

    if (!singleBody.date || !singleBody.test_name) {
      return Response.json(
        { error: 'Missing required fields: date, test_name' },
        { status: 400 }
      )
    }

    const flag = computeFlag(
      singleBody.value ?? null,
      singleBody.reference_range_low ?? null,
      singleBody.reference_range_high ?? null
    )

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('lab_results')
      .insert({
        date: singleBody.date,
        test_name: singleBody.test_name,
        value: singleBody.value ?? null,
        unit: singleBody.unit ?? null,
        reference_range_low: singleBody.reference_range_low ?? null,
        reference_range_high: singleBody.reference_range_high ?? null,
        category: singleBody.category || 'Other',
        flag,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, result: data })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
