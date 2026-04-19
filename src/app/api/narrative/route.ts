/**
 * Narrative API Route
 *
 * GET  /api/narrative - Fetch all medical_narrative rows ordered by section_order
 * PUT  /api/narrative - Upsert a narrative section
 *   Body: { section_title: string, content: string, section_order: number }
 *
 * Uses service client to bypass RLS restrictions.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireUser } from '@/lib/auth/require-user'
import { sanitizeForPersistedSummary } from '@/lib/ai/safety/wrap-user-content'
import { recordAuditEvent, auditMetaFromRequest } from '@/lib/security/audit-log'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const audit = auditMetaFromRequest(request)
  const auth = await requireUser(request)
  if (!auth.ok) {
    await recordAuditEvent({
      endpoint: 'GET /api/narrative',
      actor: audit.ip ?? 'unauthenticated',
      outcome: 'deny',
      status: 401,
      reason: 'auth',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return auth.response
  }

  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('medical_narrative')
      .select('*')
      .order('section_order', { ascending: true })

    if (error) {
      console.error('[narrative] select failed:', error.message)
      return NextResponse.json({ error: 'Failed to fetch narratives' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[narrative] GET threw:', err)
    return NextResponse.json({ error: 'Failed to fetch narratives' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const audit = auditMetaFromRequest(request)
  const auth = await requireUser(request)
  if (!auth.ok) {
    await recordAuditEvent({
      endpoint: 'PUT /api/narrative',
      actor: audit.ip ?? 'unauthenticated',
      outcome: 'deny',
      status: 401,
      reason: 'auth',
      ip: audit.ip,
      userAgent: audit.userAgent,
    })
    return auth.response
  }

  try {
    const body = (await request.json()) as {
      section_title?: string
      content?: string
      section_order?: number
    }

    if (!body.section_title || typeof body.section_title !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: section_title (string)' },
        { status: 400 },
      )
    }

    if (body.content === undefined || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: content (string)' },
        { status: 400 },
      )
    }

    if (body.section_order === undefined || typeof body.section_order !== 'number') {
      return NextResponse.json(
        { error: 'Missing required field: section_order (number)' },
        { status: 400 },
      )
    }

    const supabase = createServiceClient()

    // Narrative is rendered to doctors and fed back into summary
    // generation. Sanitize embedded prompt-injection markers before
    // persisting so the loop can't be weaponized by a compromised client.
    const safeContent = sanitizeForPersistedSummary(body.content)

    const { error } = await supabase.from('medical_narrative').upsert(
      {
        section_title: body.section_title,
        content: safeContent,
        section_order: body.section_order,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section_title' },
    )

    if (error) {
      console.error('[narrative] upsert failed:', error.message)
      return NextResponse.json({ error: 'Failed to save narrative' }, { status: 500 })
    }

    await recordAuditEvent({
      endpoint: 'PUT /api/narrative',
      actor: auth.user.id,
      outcome: 'allow',
      status: 200,
      ip: audit.ip,
      userAgent: audit.userAgent,
      meta: { section_title: body.section_title },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[narrative] PUT threw:', err)
    return NextResponse.json({ error: 'Failed to save narrative' }, { status: 500 })
  }
}
