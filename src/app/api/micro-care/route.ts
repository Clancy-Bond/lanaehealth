// ---------------------------------------------------------------------------
// POST /api/micro-care
//
// Accepts a completion payload from the MicroCareDrawer client and writes
// a row to `micro_care_completions`. Voice-neutral: we return the inserted
// row only. No streaks, no "goal met", no shame framing.
//
// GET /api/micro-care returns the trailing 7-day completion count as a
// plain integer (`{ count: 6 }`). The caller may render it as a gentle
// presence count, NEVER as a denominator or percentage.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server'
import {
  logMicroCareCompletion,
  countRecentMicroCareCompletions,
} from '@/lib/api/micro-care'
import { requireUser } from '@/lib/api/require-user'
import { safeErrorMessage, safeErrorResponse } from '@/lib/api/safe-error'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireUser(req)
    const body = await req.json().catch(() => null) as
      | { actionSlug?: string; durationSeconds?: number; feltBetter?: boolean; notes?: string }
      | null
    if (!body || typeof body.actionSlug !== 'string') {
      return NextResponse.json(
        { error: 'actionSlug (string) is required' },
        { status: 400 }
      )
    }
    const row = await logMicroCareCompletion({
      actionSlug: body.actionSlug,
      durationSeconds: typeof body.durationSeconds === 'number'
        ? body.durationSeconds
        : null,
      feltBetter: typeof body.feltBetter === 'boolean' ? body.feltBetter : null,
      notes: typeof body.notes === 'string' ? body.notes : null,
    })
    return NextResponse.json({ completion: row })
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : ''
    const isValidation = rawMsg.startsWith('Unknown micro-care action slug')
    if (isValidation) {
      return NextResponse.json(
        { error: safeErrorMessage(err, 'invalid_action_slug') },
        { status: 400 },
      )
    }
    return safeErrorResponse(err, 'micro_care_log_failed')
  }
}

export async function GET(req: NextRequest) {
  try { await requireUser(req); } catch (err) { return safeErrorResponse(err); }
  try {
    const count = await countRecentMicroCareCompletions(7)
    return NextResponse.json({ count })
  } catch (err) {
    return safeErrorResponse(err, 'micro_care_count_failed')
  }
}
