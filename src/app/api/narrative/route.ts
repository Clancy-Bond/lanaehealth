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

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('medical_narrative')
      .select('*')
      .order('section_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch narratives'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
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

    const { error } = await supabase.from('medical_narrative').upsert(
      {
        section_title: body.section_title,
        content: body.content,
        section_order: body.section_order,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section_title' },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save narrative'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
