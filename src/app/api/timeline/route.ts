/**
 * Timeline API Route
 *
 * GET  /api/timeline - Fetch all events ordered by event_date DESC
 * POST /api/timeline - Insert a new timeline event
 */

import { createServiceClient } from '@/lib/supabase'
import type { TimelineEventType, EventSignificance } from '@/lib/types'

const VALID_EVENT_TYPES: TimelineEventType[] = [
  'diagnosis',
  'symptom_onset',
  'test',
  'medication_change',
  'appointment',
  'imaging',
  'hospitalization',
]

const VALID_SIGNIFICANCE: EventSignificance[] = ['normal', 'important', 'critical']

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('medical_timeline')
      .select('*')
      .order('event_date', { ascending: false })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ events: data })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

interface CreateEventBody {
  event_date: string
  event_type: TimelineEventType
  title: string
  description?: string
  significance?: EventSignificance
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateEventBody

    // Validate required fields
    if (!body.event_date || typeof body.event_date !== 'string') {
      return Response.json(
        { error: 'Missing required field: event_date (YYYY-MM-DD)' },
        { status: 400 },
      )
    }

    if (!body.event_type || !VALID_EVENT_TYPES.includes(body.event_type)) {
      return Response.json(
        { error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 },
      )
    }

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return Response.json(
        { error: 'Missing required field: title (non-empty string)' },
        { status: 400 },
      )
    }

    const significance = body.significance || 'normal'
    if (!VALID_SIGNIFICANCE.includes(significance)) {
      return Response.json(
        { error: `Invalid significance. Must be one of: ${VALID_SIGNIFICANCE.join(', ')}` },
        { status: 400 },
      )
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('medical_timeline')
      .insert({
        event_date: body.event_date,
        event_type: body.event_type,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        significance,
        linked_data: {},
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ event: data }, { status: 201 })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
