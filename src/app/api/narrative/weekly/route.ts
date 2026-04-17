/**
 * Weekly Narrative API
 *
 * GET  /api/narrative/weekly
 *   - Returns the cached 200-word narrative from medical_narrative
 *     where section_title='weekly_summary'.
 *   - If missing or older than 7 days, returns { stale: true } without regen.
 *
 * POST /api/narrative/weekly
 *   - Force-regenerates via three-layer context assembler + Claude.
 *   - Caches by upserting medical_narrative(section_title='weekly_summary').
 *
 * Why on-demand rather than cron: Lanae may want a fresh narrative right
 * before a doctor visit. Cron would bake in staleness. A 7-day cache
 * prevents hammering the API for casual views.
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { assembleDynamicContext, STATIC_SYSTEM_PROMPT } from '@/lib/context/assembler'

const WEEKLY_SECTION = 'weekly_summary'
const STALE_AFTER_DAYS = 7

export const maxDuration = 60

export async function GET() {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('medical_narrative')
      .select('content, updated_at')
      .eq('section_title', WEEKLY_SECTION)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ content: null, stale: true, generatedAt: null })
    }

    const age =
      (Date.now() - new Date(data.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    const stale = age > STALE_AFTER_DAYS

    return NextResponse.json({
      content: data.content,
      generatedAt: data.updated_at,
      stale,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
    }

    // Build context using three-layer assembler (doctor mode loads all summaries)
    const query =
      'Generate a 200-word longitudinal narrative of the patient\'s health story. ' +
      'Cover symptoms, key diagnoses under consideration, recent changes, and open questions.'

    const { context } = await assembleDynamicContext(query, {
      includeAllSummaries: true,
    })

    // Static/Dynamic boundary: stable instructions first, dynamic context last
    const systemPrompt = `${STATIC_SYSTEM_PROMPT}
__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__
${context}`

    const client = new Anthropic({ apiKey })
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content:
            'Write a tight, chronological 200-word narrative of this patient\'s health story ' +
            'for a doctor reading it cold. Structure: ' +
            '(1) one-sentence identity + chief complaint, ' +
            '(2) timeline of diagnoses/workup so far, ' +
            '(3) current active issues and open questions, ' +
            '(4) what this visit should clarify. ' +
            'Use plain prose, no bullet points. Cite dates inline where useful. ' +
            'Target 200 words, hard cap 250. Do not use em dashes.',
        },
      ],
    })

    const block = resp.content.find((b) => b.type === 'text')
    const content = block && block.type === 'text' ? block.text.trim() : ''

    if (!content) {
      return NextResponse.json({ error: 'Empty narrative from model' }, { status: 500 })
    }

    const sb = createServiceClient()
    const { error } = await sb.from('medical_narrative').upsert(
      {
        section_title: WEEKLY_SECTION,
        content,
        section_order: 999,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'section_title' },
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      content,
      generatedAt: new Date().toISOString(),
      stale: false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate narrative'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
