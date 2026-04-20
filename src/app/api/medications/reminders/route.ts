/**
 * POST /api/medications/reminders
 *
 * Create a medication reminder. Payload shape:
 *   { medication_name, reminder_times, days_of_week, is_active }
 *
 * GET /api/medications/reminders
 *
 * List the current user's reminders (server-side fetch for initial
 * page data; kept here so the client has one source of truth).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

interface ReminderPayload {
  medication_name: string
  reminder_times: string[]
  days_of_week: number[] | null
  is_active: boolean
}

function parsePayload(raw: Record<string, unknown>): { ok: true; payload: ReminderPayload } | { ok: false; error: string } {
  const name = typeof raw.medication_name === 'string' ? raw.medication_name.trim() : ''
  if (!name) return { ok: false, error: 'medication_name is required.' }

  const timesRaw = raw.reminder_times
  const times = Array.isArray(timesRaw) ? timesRaw.filter((t): t is string => typeof t === 'string' && TIME_RE.test(t)) : []
  if (times.length === 0) return { ok: false, error: 'reminder_times must contain at least one HH:MM value.' }

  let days: number[] | null = null
  if (raw.days_of_week === null) {
    days = null
  } else if (Array.isArray(raw.days_of_week)) {
    const vals = raw.days_of_week.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    days = vals.length > 0 ? Array.from(new Set(vals)).sort() : null
  }

  const isActive = raw.is_active === undefined ? true : Boolean(raw.is_active)

  return { ok: true, payload: { medication_name: name, reminder_times: times, days_of_week: days, is_active: isActive } }
}

export async function POST(req: NextRequest) {
  let raw: Record<string, unknown> = {}
  try {
    raw = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = parsePayload(raw)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('medication_reminders')
    .insert(parsed.payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, reminder: data }, { status: 200 })
}

export async function GET() {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('medication_reminders')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, reminders: data ?? [] }, { status: 200 })
}
