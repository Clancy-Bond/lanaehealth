/**
 * Persist extraction results back onto the originating notes row.
 *
 * Called from /api/notes/[id]/extract once Claude returns. Updates
 * notes.extractions + notes.extraction_status.
 *
 * Pre-migration safe: silently no-ops if the notes table is not
 * present yet (the composer-save path already returns 503 in that
 * case, so the extract route only runs after a real save).
 */
import { createServiceClient } from '@/lib/supabase'
import type { Extraction } from './extraction-types'

export type ExtractionStatus =
  | 'pending'
  | 'queued'
  | 'ready'
  | 'applied'
  | 'dismissed'
  | 'failed'

export async function saveExtractionsToNote(opts: {
  userId: string | null
  noteId: string
  extractions: Extraction[]
  status: ExtractionStatus
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient()
  const update: Record<string, unknown> = {
    extractions: opts.extractions,
    extraction_status: opts.status,
    updated_at: new Date().toISOString(),
  }
  try {
    let q = sb.from('notes').update(update).eq('id', opts.noteId)
    if (opts.userId) q = q.eq('user_id', opts.userId)
    const { error } = await q
    if (error) {
      // Pre-migration / pre-035 fallbacks: retry without user filter.
      if (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /user_id/i.test(error.message ?? '')
      ) {
        const retry = await sb.from('notes').update(update).eq('id', opts.noteId)
        if (retry.error) return { ok: false, error: retry.error.message }
        return { ok: true }
      }
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function appendAppliedExtractionId(opts: {
  userId: string | null
  noteId: string
  extractionId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient()
  // Read-modify-write because Supabase's PostgREST does not expose
  // a clean array_append builder. The race window is tiny (one
  // user, one note) so this is safe.
  try {
    let read = sb.from('notes').select('applied_extractions, extraction_status').eq('id', opts.noteId)
    if (opts.userId) read = read.eq('user_id', opts.userId)
    const { data, error } = await read.maybeSingle()
    if (error || !data) {
      return { ok: false, error: error?.message ?? 'note not found' }
    }
    const cur = Array.isArray(data.applied_extractions) ? data.applied_extractions : []
    const next = cur.includes(opts.extractionId) ? cur : [...cur, opts.extractionId]
    const update: Record<string, unknown> = {
      applied_extractions: next,
      extraction_status: 'applied',
      updated_at: new Date().toISOString(),
    }
    let q = sb.from('notes').update(update).eq('id', opts.noteId)
    if (opts.userId) q = q.eq('user_id', opts.userId)
    const { error: updErr } = await q
    if (updErr) return { ok: false, error: updErr.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function getNote(opts: {
  userId: string | null
  noteId: string
}): Promise<
  | { ok: true; body: string; captured_at: string; extractions: unknown }
  | { ok: false; error: string }
> {
  const sb = createServiceClient()
  try {
    let q = sb
      .from('notes')
      .select('body, captured_at, extractions')
      .eq('id', opts.noteId)
    if (opts.userId) q = q.eq('user_id', opts.userId)
    const { data, error } = await q.maybeSingle()
    if (error) {
      // Pre-035 fallback.
      if (
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        /user_id/i.test(error.message ?? '')
      ) {
        const retry = await sb
          .from('notes')
          .select('body, captured_at, extractions')
          .eq('id', opts.noteId)
          .maybeSingle()
        if (retry.error || !retry.data) {
          return { ok: false, error: retry.error?.message ?? 'note not found' }
        }
        const r = retry.data as { body: string; captured_at: string; extractions: unknown }
        return { ok: true, body: r.body, captured_at: r.captured_at, extractions: r.extractions }
      }
      return { ok: false, error: error.message }
    }
    if (!data) return { ok: false, error: 'note not found' }
    const r = data as { body: string; captured_at: string; extractions: unknown }
    return { ok: true, body: r.body, captured_at: r.captured_at, extractions: r.extractions }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
