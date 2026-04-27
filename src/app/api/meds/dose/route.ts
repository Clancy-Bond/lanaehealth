/**
 * POST /api/meds/dose
 *
 * Records a single med dose. Called from the home meds card on every
 * tap. The body is intentionally minimal: just enough to identify the
 * med + slot + time. The dose row stamps user_id from the session.
 *
 * Request:
 *   {
 *     med_slug: string,
 *     med_name: string,
 *     kind: 'scheduled' | 'prn',
 *     slot?: 'morning' | 'midday' | 'night',
 *     taken_at?: string (ISO; defaults to server now),
 *     dose_text?: string,
 *     source?: 'tap' | 'note_extraction' | 'manual_edit'
 *   }
 *
 * Response: { ok: true, id: string, taken_at: string } on success;
 *           { ok: false, error: string } on failure.
 *
 * Pre-migration: if the med_doses table does not exist yet (migration
 * 046), returns 503 with a friendly message. The card uses that to
 * surface a banner asking the operator to run migrations.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import { recordDose } from '@/lib/meds/dose-log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PostSchema = z.object({
  med_slug: z.string().trim().min(1).max(80),
  med_name: z.string().trim().min(1).max(120),
  kind: z.enum(['scheduled', 'prn']),
  slot: z.enum(['morning', 'midday', 'night']).optional().nullable(),
  taken_at: z.string().datetime().optional(),
  dose_text: z.string().trim().max(120).optional().nullable(),
  source: z.enum(['tap', 'note_extraction', 'manual_edit']).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export async function POST(req: Request) {
  let userId: string | null = null
  try {
    const user = await requireUser()
    userId = user.id
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
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

  const result = await recordDose({
    userId,
    med_slug: parsed.data.med_slug,
    med_name: parsed.data.med_name,
    kind: parsed.data.kind,
    slot: parsed.data.slot ?? null,
    taken_at: parsed.data.taken_at,
    source: parsed.data.source ?? 'tap',
    dose_text: parsed.data.dose_text ?? null,
    notes: parsed.data.notes ?? null,
  })

  if (!result.ok) {
    if (result.reason === 'table_missing') {
      return NextResponse.json(
        { ok: false, error: 'med_doses table not present yet (run migration 046)' },
        { status: 503 },
      )
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.id, taken_at: result.taken_at })
}
