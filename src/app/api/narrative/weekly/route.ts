/**
 * Weekly Narrative API (per-specialist variants)
 *
 * GET  /api/narrative/weekly?view=pcp|obgyn|cardiology
 *   - Returns the cached 200-word narrative for the given view.
 *   - section_title is `weekly_summary_<view>`. PCP is the default.
 *   - If missing or older than 7 days, returns { stale: true } without regen.
 *
 * POST /api/narrative/weekly?view=pcp|obgyn|cardiology
 *   - Force-regenerates using specialist-aware prompting.
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { assembleDynamicContext, STATIC_SYSTEM_PROMPT, splitSystemPromptForCaching } from '@/lib/context/assembler'
import { logCacheMetrics } from '@/lib/ai/cache-metrics'
import { SPECIALIST_CONFIG, type SpecialistView } from '@/lib/doctor/specialist-config'

const STALE_AFTER_DAYS = 7

export const maxDuration = 60

function parseView(url: URL): SpecialistView {
  const v = url.searchParams.get('view')
  if (v === 'obgyn' || v === 'cardiology' || v === 'pcp') return v
  return 'pcp'
}

function sectionTitleFor(view: SpecialistView): string {
  return `weekly_summary_${view}`
}

function specialistFraming(view: SpecialistView): string {
  switch (view) {
    case 'obgyn':
      return (
        'Frame this narrative for an OB/GYN. Emphasize cycle data, dysmenorrhea, ' +
        'flow/clots, dyspareunia, urinary-pelvic overlap, and any suspected ' +
        'endometriosis signals. Downplay unrelated cardiovascular or thyroid data.'
      )
    case 'cardiology':
      return (
        'Frame this narrative for a cardiologist. Emphasize orthostatic vitals, ' +
        'syncope history, HRV trends, resting HR, palpitations, and autonomic ' +
        'dysfunction signals. Downplay reproductive / gynecologic detail.'
      )
    case 'pcp':
    default:
      return (
        'Frame this narrative for a whole-picture Primary Care / Internal Medicine ' +
        'doctor. Balance all systems; include the cross-system coordination ' +
        'questions that only the PCP can resolve.'
      )
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const view = parseView(url)
    const title = sectionTitleFor(view)

    const sb = createServiceClient()
    const { data, error } = await sb
      .from('medical_narrative')
      .select('content, updated_at')
      .eq('section_title', title)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      // Fall back to legacy section_title='weekly_summary' for PCP view
      if (view === 'pcp') {
        const legacy = await sb
          .from('medical_narrative')
          .select('content, updated_at')
          .eq('section_title', 'weekly_summary')
          .maybeSingle()
        if (legacy.data) {
          const age =
            (Date.now() - new Date(legacy.data.updated_at).getTime()) /
            (1000 * 60 * 60 * 24)
          return NextResponse.json({
            content: legacy.data.content,
            generatedAt: legacy.data.updated_at,
            stale: age > STALE_AFTER_DAYS,
            view,
          })
        }
      }
      return NextResponse.json({ content: null, stale: true, generatedAt: null, view })
    }

    const age =
      (Date.now() - new Date(data.updated_at).getTime()) / (1000 * 60 * 60 * 24)

    return NextResponse.json({
      content: data.content,
      generatedAt: data.updated_at,
      stale: age > STALE_AFTER_DAYS,
      view,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const view = parseView(url)
    const title = sectionTitleFor(view)
    const cfg = SPECIALIST_CONFIG[view]

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
    }

    const query =
      `Generate a 200-word longitudinal narrative for a ${cfg.label} visit. ` +
      'Cover chief complaint, workup to date, active issues, and what this visit should clarify.'

    // Skip heavy layers to keep context under ~5K tokens (~10s response)
    const { context } = await assembleDynamicContext(query, {
      skipKnowledgeBase: true,
      skipRetrieval: true,
    })

    const systemPrompt = `${STATIC_SYSTEM_PROMPT}
__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__
${context}`

    // Split the assembled string on the boundary so the cached STATIC half
    // carries ephemeral cache_control and the dynamic patient context does not.
    const cachedSystem = splitSystemPromptForCaching(systemPrompt)

    const userMessage =
      `Write a tight, chronological 200-word narrative for a ${cfg.label} reading this cold. ` +
      specialistFraming(view) +
      ' Structure: (1) one-sentence identity + specialty-relevant chief complaint, ' +
      '(2) timeline of diagnoses/workup so far, ' +
      '(3) current active issues and open questions framed for this specialty, ' +
      '(4) what THIS visit should clarify. ' +
      'Plain prose, no bullet points. Cite dates inline where useful. ' +
      'Target 200 words, hard cap 250. Do not use em dashes.'

    const client = new Anthropic({ apiKey })
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: cachedSystem as unknown as Anthropic.TextBlockParam[],
      messages: [{ role: 'user', content: userMessage }],
    })
    logCacheMetrics(resp, `narrative:${view}`)

    const block = resp.content.find((b) => b.type === 'text')
    const content = block && block.type === 'text' ? block.text.trim() : ''

    if (!content) {
      return NextResponse.json({ error: 'Empty narrative from model' }, { status: 500 })
    }

    // Delete existing + insert (no unique constraint on section_title)
    const sb = createServiceClient()
    const { error: delError } = await sb
      .from('medical_narrative')
      .delete()
      .eq('section_title', title)
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 })
    }

    const { error } = await sb.from('medical_narrative').insert({
      section_title: title,
      content,
      section_order: 999,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      content,
      generatedAt: new Date().toISOString(),
      stale: false,
      view,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate narrative'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
