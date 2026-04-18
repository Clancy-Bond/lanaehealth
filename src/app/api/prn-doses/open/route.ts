// ---------------------------------------------------------------------------
// GET /api/prn-doses/open
//
// Returns the list of PRN dose events whose efficacy poll is currently
// open for Lanae to answer. Backs the PrnEffectivenessPoll in-app
// fallback surface on /log (Wave 2e F7).
//
// "Open" means:
//   - poll_scheduled_for has passed
//   - poll_response is still NULL
//   - poll_scheduled_for is within the last gracePeriodHours (default 6)
//
// This endpoint is read-only and carries no PII beyond the logged
// medication name. It is safe to call on every /log render.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import { getOpenInAppPolls } from '@/lib/api/prn-doses'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const graceRaw = url.searchParams.get('graceHours')
  const limitRaw = url.searchParams.get('limit')

  let graceHours = 6
  if (graceRaw !== null) {
    const parsed = Number(graceRaw)
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 72) {
      graceHours = parsed
    }
  }

  let limit = 10
  if (limitRaw !== null) {
    const parsed = Number(limitRaw)
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 50) {
      limit = parsed
    }
  }

  try {
    const polls = await getOpenInAppPolls(graceHours, limit)
    return NextResponse.json({ polls })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'failed to load PRN polls'
    return NextResponse.json({ error: msg, polls: [] }, { status: 500 })
  }
}
