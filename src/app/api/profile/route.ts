/**
 * Profile API Route
 *
 * PUT /api/profile - Upsert a health_profile section
 * Body: { section: string, content: any }
 *
 * Uses service client to bypass RLS restrictions on health_profile table.
 */

import { createServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'
export async function PUT(request: Request) {
  const gate = requireAuth(request)
  if (!gate.ok) return gate.response

  try {
    const body = (await request.json()) as { section?: string; content?: unknown }

    if (!body.section || typeof body.section !== 'string') {
      return Response.json(
        { error: 'Missing required field: section (string)' },
        { status: 400 },
      )
    }

    if (body.content === undefined) {
      return Response.json(
        { error: 'Missing required field: content' },
        { status: 400 },
      )
    }

    const supabase = createServiceClient()
    // health_profile.content is jsonb. Pass the raw object so Supabase
    // serializes it natively. Session 2 W2.6: the previous JSON.stringify
    // call stored a double-encoded string that direct-access readers could
    // not use. Existing legacy-shape rows are left untouched (zero data
    // loss); readers route through parseProfileContent to handle both.
    const { error } = await supabase.from('health_profile').upsert(
      {
        section: body.section,
        content: body.content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section' },
    )

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
