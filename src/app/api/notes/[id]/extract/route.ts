/**
 * POST /api/notes/[id]/extract
 *
 * Run AI extraction over a note. The composer fires this in the
 * background after a save, but the route also supports manual
 * re-extraction (e.g. if the model misfires the first time).
 *
 * Returns the candidate extractions so the UI can render chips
 * without a second round trip.
 */
import { NextResponse } from 'next/server'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import { extractCandidates } from '@/lib/notes/extract'
import { loadMedsConfig } from '@/lib/meds/load-meds-config'
import {
  getNote,
  saveExtractionsToNote,
} from '@/lib/notes/persist-extractions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 })
  }

  const noteResult = await getNote({ userId, noteId: id })
  if (!noteResult.ok) {
    return NextResponse.json({ ok: false, error: noteResult.error }, { status: 404 })
  }

  const meds = await loadMedsConfig(userId)
  const result = await extractCandidates({
    noteBody: noteResult.body,
    capturedAt: noteResult.captured_at,
    meds,
  })

  if (!result.ok) {
    // Mark the note as failed extraction so the UI can show "couldn't
    // extract" silently. Note body is preserved either way.
    await saveExtractionsToNote({
      userId,
      noteId: id,
      extractions: [],
      status: 'failed',
    })
    return NextResponse.json(
      { ok: false, error: result.error, reason: result.reason },
      { status: 502 },
    )
  }

  const persistResult = await saveExtractionsToNote({
    userId,
    noteId: id,
    extractions: result.extractions,
    status: 'ready',
  })
  if (!persistResult.ok) {
    return NextResponse.json(
      { ok: false, error: persistResult.error },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, extractions: result.extractions })
}
