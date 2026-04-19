import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { jsonError } from '@/lib/api/json-error'

/**
 * POST /api/medication-timeline
 *
 * Records a medication event (dose taken, skipped) into the shared
 * medical_timeline table. Server-mediated so client components do not
 * need a service-role key. Called from MedicationCard when Lanae logs
 * or skips a dose.
 *
 * Request body:
 *   {
 *     date: string (YYYY-MM-DD),
 *     title: string,
 *     description: string,
 *     significance: 'normal' | ...
 *   }
 *
 * Returns { ok: true } on success, or { error } with a 4xx/5xx status.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { date, title, description, significance } = body as {
    date?: string
    title?: string
    description?: string
    significance?: string
  }

  if (!date || !title) {
    return NextResponse.json(
      { error: 'missing_required_fields', required: ['date', 'title'] },
      { status: 400 },
    )
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('medical_timeline').insert({
    date,
    event_type: 'medication_change',
    title,
    description: description ?? null,
    significance: significance ?? 'normal',
    source: 'daily_log',
  })

  if (error) {
    return jsonError(500, 'medication_timeline_insert_failed', error)
  }

  return NextResponse.json({ ok: true })
}
