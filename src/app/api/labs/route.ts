/**
 * Labs API Route
 *
 * POST /api/labs - Insert a new lab result
 * Body: { date, test_name, value, unit, reference_range_low, reference_range_high, category }
 *
 * Auto-computes the flag based on value vs reference range.
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LabInput

    if (!body.date || !body.test_name) {
      return Response.json(
        { error: 'Missing required fields: date, test_name' },
        { status: 400 }
      )
    }

    const flag = computeFlag(
      body.value ?? null,
      body.reference_range_low ?? null,
      body.reference_range_high ?? null
    )

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('lab_results')
      .insert({
        date: body.date,
        test_name: body.test_name,
        value: body.value ?? null,
        unit: body.unit ?? null,
        reference_range_low: body.reference_range_low ?? null,
        reference_range_high: body.reference_range_high ?? null,
        category: body.category || 'Other',
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
