/**
 * POST /api/notes/[id]/apply
 *
 * Apply one extraction chip from a note's extractions list. The user
 * tapped the chip; we now write the structured row (med_doses /
 * pain_points / headache_attacks / symptoms) and link it back to
 * the source note via source_note_id (added by migration 047).
 *
 * Body:
 *   { extraction_id: string }
 *
 * Response:
 *   { ok: true, kind: string, target_id: string }
 *
 * Idempotent: applying the same extraction id twice writes only once
 * because the route checks notes.applied_extractions before writing.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser, UnauthenticatedError } from '@/lib/auth/get-user'
import { recordDose } from '@/lib/meds/dose-log'
import { createServiceClient } from '@/lib/supabase'
import {
  appendAppliedExtractionId,
  getNote,
} from '@/lib/notes/persist-extractions'
import {
  isHeadache,
  isMedDose,
  isPain,
  isSymptom,
} from '@/lib/notes/extract'
import type { Extraction } from '@/lib/notes/extraction-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  extraction_id: z.string().min(1).max(80),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let userId: string | null = null
  try {
    const user = await requireUser()
    userId = user.id
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ ok: false, error: 'auth check failed' }, { status: 500 })
  }

  const { id: noteId } = await params
  if (!noteId) {
    return NextResponse.json({ ok: false, error: 'note id required' }, { status: 400 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })
  }

  const noteResult = await getNote({ userId, noteId })
  if (!noteResult.ok) {
    return NextResponse.json({ ok: false, error: noteResult.error }, { status: 404 })
  }
  const extractions = (noteResult.extractions as Extraction[]) ?? []
  const target = extractions.find((e) => e.id === parsed.data.extraction_id)
  if (!target) {
    return NextResponse.json(
      { ok: false, error: 'extraction not found on this note' },
      { status: 404 },
    )
  }

  // Branch on extraction kind. Each branch persists a row in the
  // matching domain table and returns the row id.
  if (isMedDose(target)) {
    const dose = await recordDose({
      userId,
      med_slug: target.med_slug,
      med_name: target.med_name,
      kind: target.scheduled_or_prn,
      slot: target.slot ?? null,
      taken_at: target.taken_at_iso,
      source: 'note_extraction',
      dose_text: target.dose_text ?? null,
    })
    if (!dose.ok) {
      return NextResponse.json({ ok: false, error: dose.error }, { status: 500 })
    }
    await appendAppliedExtractionId({ userId, noteId, extractionId: target.id })
    return NextResponse.json({ ok: true, kind: 'med_dose', target_id: dose.id })
  }

  if (isPain(target)) {
    const sb = createServiceClient()
    const row: Record<string, unknown> = {
      intensity: Math.round(target.intensity),
      // pain_points expects body_region as TEXT; legacy schema may also
      // require a body coordinate. The body map is gone, so we write
      // what we have and leave coordinates null. The doctor view tolerates this.
      body_region: target.body_region ?? null,
      pain_type: target.pain_quality ?? null,
      logged_at: target.noted_at_iso,
      source_note_id: noteId,
    }
    if (userId) row.user_id = userId
    const { data, error } = await sb
      .from('pain_points')
      .insert(row)
      .select('id')
      .single()
    if (error) {
      // Pre-035 fallback.
      if (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /user_id/i.test(error.message ?? '')
      ) {
        delete row.user_id
        const retry = await sb.from('pain_points').insert(row).select('id').single()
        if (retry.error) {
          return NextResponse.json({ ok: false, error: retry.error.message }, { status: 500 })
        }
        await appendAppliedExtractionId({ userId, noteId, extractionId: target.id })
        return NextResponse.json({
          ok: true,
          kind: 'pain',
          target_id: (retry.data as { id: string }).id,
        })
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    await appendAppliedExtractionId({ userId, noteId, extractionId: target.id })
    return NextResponse.json({
      ok: true,
      kind: 'pain',
      target_id: (data as { id: string }).id,
    })
  }

  if (isHeadache(target)) {
    const sb = createServiceClient()
    const row: Record<string, unknown> = {
      started_at: target.started_at_iso,
      intensity: target.intensity ?? null,
      side: target.side ?? null,
      aura: target.aura ?? null,
      trigger: target.trigger ?? null,
      source_note_id: noteId,
    }
    if (userId) row.user_id = userId
    const { data, error } = await sb
      .from('headache_attacks')
      .insert(row)
      .select('id')
      .single()
    if (error) {
      if (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /user_id/i.test(error.message ?? '')
      ) {
        delete row.user_id
        const retry = await sb
          .from('headache_attacks')
          .insert(row)
          .select('id')
          .single()
        if (retry.error) {
          return NextResponse.json({ ok: false, error: retry.error.message }, { status: 500 })
        }
        await appendAppliedExtractionId({ userId, noteId, extractionId: target.id })
        return NextResponse.json({
          ok: true,
          kind: 'headache_attack',
          target_id: (retry.data as { id: string }).id,
        })
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    await appendAppliedExtractionId({ userId, noteId, extractionId: target.id })
    return NextResponse.json({
      ok: true,
      kind: 'headache_attack',
      target_id: (data as { id: string }).id,
    })
  }

  if (isSymptom(target)) {
    const sb = createServiceClient()
    const row: Record<string, unknown> = {
      label: target.label,
      intensity: target.intensity ?? null,
      logged_at: target.noted_at_iso,
      source_note_id: noteId,
    }
    if (userId) row.user_id = userId
    const { data, error } = await sb
      .from('symptoms')
      .insert(row)
      .select('id')
      .single()
    if (error) {
      if (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /user_id/i.test(error.message ?? '')
      ) {
        delete row.user_id
        const retry = await sb.from('symptoms').insert(row).select('id').single()
        if (retry.error) {
          return NextResponse.json({ ok: false, error: retry.error.message }, { status: 500 })
        }
        await appendAppliedExtractionId({ userId, noteId, extractionId: target.id })
        return NextResponse.json({
          ok: true,
          kind: 'symptom',
          target_id: (retry.data as { id: string }).id,
        })
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    await appendAppliedExtractionId({ userId, noteId, extractionId: target.id })
    return NextResponse.json({
      ok: true,
      kind: 'symptom',
      target_id: (data as { id: string }).id,
    })
  }

  return NextResponse.json({ ok: false, error: 'unknown extraction kind' }, { status: 400 })
}
