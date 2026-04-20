/**
 * PATCH /api/medications/reminders/[id]
 * DELETE /api/medications/reminders/[id]
 *
 * Per-id update and delete. PATCH accepts a partial payload so
 * toggles (just { is_active }) and full edits share the same route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

interface ReminderPatch {
  medication_name?: string
  reminder_times?: string[]
  days_of_week?: number[] | null
  is_active?: boolean
}

function buildPatch(raw: Record<string, unknown>): { ok: true; patch: ReminderPatch } | { ok: false; error: string } {
  const patch: ReminderPatch = {}

  if (raw.medication_name !== undefined) {
    const name = typeof raw.medication_name === 'string' ? raw.medication_name.trim() : ''
    if (!name) return { ok: false, error: 'medication_name cannot be empty.' }
    patch.medication_name = name
  }

  if (raw.reminder_times !== undefined) {
    if (!Array.isArray(raw.reminder_times)) return { ok: false, error: 'reminder_times must be an array.' }
    const times = raw.reminder_times.filter((t): t is string => typeof t === 'string' && TIME_RE.test(t))
    if (times.length === 0) return { ok: false, error: 'reminder_times must contain at least one HH:MM value.' }
    patch.reminder_times = times
  }

  if (raw.days_of_week !== undefined) {
    if (raw.days_of_week === null) {
      patch.days_of_week = null
    } else if (Array.isArray(raw.days_of_week)) {
      const vals = raw.days_of_week.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      patch.days_of_week = vals.length > 0 ? Array.from(new Set(vals)).sort() : null
    } else {
      return { ok: false, error: 'days_of_week must be an array of 0-6 or null.' }
    }
  }

  if (raw.is_active !== undefined) {
    patch.is_active = Boolean(raw.is_active)
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'No updatable fields in body.' }
  }
  return { ok: true, patch }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })

  let raw: Record<string, unknown> = {}
  try {
    raw = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const built = buildPatch(raw)
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('medication_reminders')
    .update(built.patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, reminder: data }, { status: 200 })
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 })

  const sb = createServiceClient()
  const { error } = await sb
    .from('medication_reminders')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true }, { status: 200 })
}
