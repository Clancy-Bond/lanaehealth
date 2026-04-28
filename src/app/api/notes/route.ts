/**
 * POST /api/notes
 *
 * Save a single composer entry. Verbatim body always preserved.
 * Time-stamped at modal-open (captured_at), not save-press.
 *
 * GET /api/notes?limit=N
 *
 * Returns recent notes for the authenticated user (chronological,
 * most recent first). Used by the /v2/log history feed (next PR)
 * and the chip-extraction worker.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import { saveNote, listNotes } from '@/lib/notes/save-note'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PostSchema = z.object({
  body: z.string().min(1).max(8000),
  source: z.enum(['text', 'voice', 'mixed']).default('text'),
  captured_at: z.string().datetime().optional(),
  client_meta: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(req: Request) {
  let userId: string | null = null
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json(
        { ok: false, error: 'unauthenticated (no session and OWNER_USER_ID unset)' },
        { status: 401 },
      )
    }
    return NextResponse.json({ ok: false, error: 'auth check failed' }, { status: 500 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })
  }
  const parsed = PostSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const result = await saveNote({
    userId,
    body: parsed.data.body,
    source: parsed.data.source,
    capturedAt: parsed.data.captured_at,
    clientMeta: parsed.data.client_meta,
  })

  if (!result.ok) {
    if (result.reason === 'table_missing') {
      return NextResponse.json(
        { ok: false, error: 'notes table not present yet (run migration 047)' },
        { status: 503 },
      )
    }
    if (result.reason === 'invalid') {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    captured_at: result.captured_at,
    created_at: result.created_at,
  })
}

export async function GET(req: Request) {
  let userId: string | null = null
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json(
        { ok: false, error: 'unauthenticated (no session and OWNER_USER_ID unset)' },
        { status: 401 },
      )
    }
    return NextResponse.json({ ok: false, error: 'auth check failed' }, { status: 500 })
  }

  const url = new URL(req.url)
  const limitParam = url.searchParams.get('limit')
  const sinceParam = url.searchParams.get('since')
  const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam) || 50)) : 50
  const since = sinceParam && /^\d{4}-\d{2}-\d{2}/.test(sinceParam) ? sinceParam : undefined

  const notes = await listNotes({ userId, limit, sinceIso: since })
  return NextResponse.json({ notes })
}
