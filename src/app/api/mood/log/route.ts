/**
 * POST /api/mood/log
 *
 * Upsert mood_entries by log_id. Accepts JSON or form body.
 * Mirrors the narrow shape previously written client-side by
 * MoodQuickRow: { log_id, mood_score }.
 *
 * Upsert semantics: specified columns update on conflict, other
 * columns (e.g. emotions) are preserved.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_SCORES = new Set([1, 2, 3, 4, 5])

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }

  const ct = req.headers.get('content-type') ?? ''
  let raw: Record<string, unknown> = {}
  try {
    if (ct.includes('application/json')) {
      raw = (await req.json()) as Record<string, unknown>
    } else {
      const fd = await req.formData()
      for (const [k, v] of fd.entries()) raw[k] = typeof v === 'string' ? v : v.name
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  const logId = typeof raw.log_id === 'string' ? raw.log_id.trim() : ''
  if (!logId) {
    return NextResponse.json({ error: 'log_id is required.' }, { status: 400 })
  }

  const moodScore = Number(raw.mood_score)
  if (!VALID_SCORES.has(moodScore)) {
    return NextResponse.json({ error: 'mood_score must be 1-5.' }, { status: 400 })
  }

  const sb = createServiceClient()
  // Confirm the daily_log row that owns this mood_entries record belongs
  // to the authenticated user. Stops a malicious caller from upserting
  // mood onto someone else's log_id.
  const { data: ownerCheck } = await sb
    .from('daily_logs')
    .select('id')
    .eq('id', logId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!ownerCheck) {
    return NextResponse.json({ error: 'log_id not found for this user.' }, { status: 404 })
  }

  const { data, error } = await sb
    .from('mood_entries')
    .upsert({ log_id: logId, mood_score: moodScore }, { onConflict: 'log_id' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, entry: data }, { status: 200 })
}
