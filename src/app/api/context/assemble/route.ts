/**
 * Context Assembler - Test API Route
 *
 * POST /api/context/assemble
 * Body: { query: string, doctorMode?: boolean }
 *
 * Tests the full context assembly pipeline and returns
 * the complete system prompt with section breakdowns.
 */

import { getFullSystemPrompt } from '@/lib/context/assembler'
import { requireAuth } from '@/lib/auth/require-user'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'

export const maxDuration = 120

export async function POST(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  let userId: string
  try {
    const r = await resolveUserId()
    userId = r.userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return Response.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return Response.json({ error: 'auth check failed' }, { status: 500 })
  }

  try {
    const body = await request.json() as { query?: string; doctorMode?: boolean }

    if (!body.query || typeof body.query !== 'string') {
      return Response.json(
        { error: 'Missing required field: query (string)' },
        { status: 400 },
      )
    }

    const { systemPrompt, tokenEstimate, charCount, sections } =
      await getFullSystemPrompt(body.query, {
        userId,
        includeAllSummaries: body.doctorMode ?? false,
      })

    return Response.json({
      systemPrompt,
      tokenEstimate,
      charCount,
      sections: {
        permanentCore: sections.permanentCore
          ? {
              present: true,
              tokenEstimate: Math.round(sections.permanentCore.length / 4),
            }
          : { present: false },
        handoff: sections.handoff
          ? {
              present: true,
              tokenEstimate: Math.round(sections.handoff.length / 4),
            }
          : { present: false },
        summaries: sections.summaries.map((s) => ({
          topic: s.topic,
          tokenEstimate: Math.round(s.content.length / 4),
        })),
        retrieval: sections.retrieval
          ? {
              present: true,
              tokenEstimate: Math.round(sections.retrieval.length / 4),
            }
          : { present: false },
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
