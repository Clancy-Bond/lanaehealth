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
import { jsonError } from '@/lib/api/json-error'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
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
    // Unknown slug surfaces as a 400 with its literal message (not PII).
    if (rawMsg.startsWith('Unknown micro-care action slug')) {
      return NextResponse.json(
        { error: rawMsg, code: 'unknown_slug' },
        { status: 400 },
      )
    }
    return jsonError(500, 'micro_care_log_failed', err)
  }
}

export async function GET() {
  try {
    const count = await countRecentMicroCareCompletions(7)
    return NextResponse.json({ count })
  } catch (err) {
    return jsonError(500, 'micro_care_count_failed', err)
  }
}
