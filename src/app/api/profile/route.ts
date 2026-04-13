/**
 * Profile API Route
 *
 * PUT /api/profile - Upsert a health_profile section
 * Body: { section: string, content: any }
 *
 * Uses service client to bypass RLS restrictions on health_profile table.
 */

import { createServiceClient } from '@/lib/supabase'

export async function PUT(request: Request) {
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
    const { error } = await supabase.from('health_profile').upsert(
      {
        section: body.section,
        content: JSON.stringify(body.content),
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
