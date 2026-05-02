/**
 * Timeline API Route
 *
 * GET  /api/timeline - Fetch all events ordered by event_date DESC
 * POST /api/timeline - Insert a new timeline event
 */

import { createServiceClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api/require-user'
import { safeErrorMessage, safeErrorResponse } from '@/lib/api/safe-error'
import type { TimelineEventType, EventSignificance } from '@/lib/types'

// Skip static page-data collection at build time. Vercel's build container
// does not have Supabase env vars available during the collect-page-data
// phase, and this route hits Supabase on every request (nothing to prerender).
export const dynamic = 'force-dynamic'

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

export async function GET(request: Request) {
  try {
    await requireUser(request)
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('medical_timeline')
      .select('*')
      .order('event_date', { ascending: false })

    if (error) {
      return Response.json({ error: safeErrorMessage(error, "timeline_list_failed") }, { status: 500 })
    }

    return Response.json({ events: data })
  } catch (err) {
    return safeErrorResponse(err, 'timeline_list_failed')
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
    await requireUser(request)
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
      return Response.json({ error: safeErrorMessage(error, "timeline_insert_failed") }, { status: 500 })
    }

    return Response.json({ event: data }, { status: 201 })
  } catch (err) {
    return safeErrorResponse(err, 'timeline_insert_failed')
  }
}
