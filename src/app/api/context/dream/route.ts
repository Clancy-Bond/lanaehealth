/**
 * Dream Cycle - API Route
 *
 * POST - Runs the full dream cycle: regenerates stale summaries
 *        and syncs recent data into the vector store.
 *
 * Returns a DreamResult with details on what was regenerated,
 * what was skipped, and how many vector records were synced.
 *
 * Note: maxDuration is 300s (5 minutes) because regenerating
 * all 32 micro-summaries via Claude calls is slow and sequential.
 */

import { runDreamCycle } from '@/lib/context/dream-cycle'
import { requireAuth } from '@/lib/auth/require-user'

export const maxDuration = 300

export async function POST(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  try {
    const result = await runDreamCycle()

    return Response.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Dream cycle API error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
