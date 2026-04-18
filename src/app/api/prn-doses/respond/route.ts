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

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RespondBody {
  id?: unknown
  response?: unknown
}

const VALID_RESPONSES = new Set(['helped', 'no_change', 'worse'])

export async function POST(req: Request) {
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
    const msg = err instanceof Error ? err.message : 'failed to record response'
    const alreadyAnswered = /not found or already answered/i.test(msg)
    return NextResponse.json(
      { error: msg },
      { status: alreadyAnswered ? 409 : 500 },
    )
  }
}
