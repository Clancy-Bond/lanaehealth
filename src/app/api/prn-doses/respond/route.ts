// ---------------------------------------------------------------------------
// POST /api/prn-doses/respond
//
// Records Lanae's 2-tap response to a PRN efficacy poll. Body:
//   { id: string, response: 'helped' | 'no_change' | 'worse' }
//
// First answer wins - if the row already has a response, we return 409
// so the client can quietly remove its stale prompt.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server'
import { recordEfficacyResponse } from '@/lib/api/prn-doses'
import { requireUser } from '@/lib/api/require-user'
import { safeErrorMessage, safeErrorResponse } from '@/lib/api/safe-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RespondBody {
  id?: unknown
  response?: unknown
}

const VALID_RESPONSES = new Set(['helped', 'no_change', 'worse'])

export async function POST(req: Request) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  let body: RespondBody
  try {
    body = (await req.json()) as RespondBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (typeof body.id !== 'string' || body.id.length === 0) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  if (typeof body.response !== 'string' || !VALID_RESPONSES.has(body.response)) {
    return NextResponse.json(
      { error: 'response must be one of helped, no_change, worse' },
      { status: 400 },
    )
  }

  try {
    const row = await recordEfficacyResponse({
      id: body.id,
      response: body.response as 'helped' | 'no_change' | 'worse',
    })
    return NextResponse.json({ ok: true, row })
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : ''
    const alreadyAnswered = /not found or already answered/i.test(rawMsg)
    if (alreadyAnswered) {
      return NextResponse.json(
        { error: safeErrorMessage(err, 'already_answered') },
        { status: 409 },
      )
    }
    return safeErrorResponse(err, 'failed_to_record_response')
  }
}
