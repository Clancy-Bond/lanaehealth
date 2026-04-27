/**
 * Server-side helpers for the v2 notes composer.
 *
 * One row per save in `notes` (migration 047). Verbatim body is always
 * preserved. Time-stamp is the moment the composer opened (passed as
 * `captured_at`), not the moment of save, so a "took Tylenol 5 mins
 * ago" note carries the right anchor even if she takes 30 seconds to
 * type and tap Save.
 *
 * Pre-migration: `notes` table may not exist yet. saveNote returns
 * { ok:false, reason:'table_missing' } and the route surfaces a
 * friendly toast. Reads return [] so the history feed renders empty
 * instead of erroring.
 */
import { createServiceClient } from '@/lib/supabase'

export type NoteSource = 'text' | 'voice' | 'mixed'

export interface SaveNoteInput {
  userId: string | null
  body: string
  source: NoteSource
  /** ISO; defaults to server now. */
  capturedAt?: string
  clientMeta?: Record<string, unknown>
}

export type SaveNoteResult =
  | {
      ok: true
      id: string
      captured_at: string
      created_at: string
    }
  | {
      ok: false
      error: string
      reason: 'table_missing' | 'invalid' | 'db_error'
    }

export async function saveNote(input: SaveNoteInput): Promise<SaveNoteResult> {
  const trimmed = input.body.trim()
  if (!trimmed) {
    return { ok: false, error: 'note body required', reason: 'invalid' }
  }
  if (trimmed.length > 8000) {
    return {
      ok: false,
      error: 'note is too long (8000 chars max)',
      reason: 'invalid',
    }
  }

  const sb = createServiceClient()
  const captured_at = input.capturedAt ?? new Date().toISOString()
  const row: Record<string, unknown> = {
    body: trimmed,
    source: input.source,
    captured_at,
    extraction_status: 'pending',
    extractions: [],
    applied_extractions: [],
  }
  if (input.userId) row.user_id = input.userId
  if (input.clientMeta) row.client_meta = input.clientMeta

  try {
    const { data, error } = await sb
      .from('notes')
      .insert(row)
      .select('id, captured_at, created_at')
      .single()

    if (error) {
      if (isTableMissing(error)) {
        return {
          ok: false,
          error: 'notes table not present yet (apply migration 047)',
          reason: 'table_missing',
        }
      }
      // Pre-035 fallback: drop user_id, retry. Keeps single-tenant
      // legacy DBs ingesting notes.
      if (isMissingUserId(error) && row.user_id) {
        delete row.user_id
        const retry = await sb
          .from('notes')
          .insert(row)
          .select('id, captured_at, created_at')
          .single()
        if (retry.error) {
          return { ok: false, error: retry.error.message, reason: 'db_error' }
        }
        const r = retry.data as {
          id: string
          captured_at: string
          created_at: string
        }
        return {
          ok: true,
          id: r.id,
          captured_at: r.captured_at,
          created_at: r.created_at,
        }
      }
      return { ok: false, error: error.message, reason: 'db_error' }
    }
    const r = data as {
      id: string
      captured_at: string
      created_at: string
    }
    return {
      ok: true,
      id: r.id,
      captured_at: r.captured_at,
      created_at: r.created_at,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown',
      reason: 'db_error',
    }
  }
}

export interface NoteRow {
  id: string
  body: string
  source: NoteSource
  captured_at: string
  created_at: string
  extractions: unknown
  applied_extractions: unknown
  extraction_status: string
}

interface ListOpts {
  userId: string | null
  /** Default 50, cap 200. */
  limit?: number
  /** Optional inclusive lower bound on captured_at. */
  sinceIso?: string
}

export async function listNotes(opts: ListOpts): Promise<NoteRow[]> {
  const sb = createServiceClient()
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  try {
    let q = sb
      .from('notes')
      .select(
        'id, body, source, captured_at, created_at, extractions, applied_extractions, extraction_status',
      )
      .order('captured_at', { ascending: false })
      .limit(limit)
    if (opts.userId) q = q.eq('user_id', opts.userId)
    if (opts.sinceIso) q = q.gte('captured_at', opts.sinceIso)

    const { data, error } = await q
    if (error) {
      if (isTableMissing(error)) return []
      if (isMissingUserId(error) && opts.userId) {
        // Retry unscoped (single-tenant legacy schema).
        let q2 = sb
          .from('notes')
          .select(
            'id, body, source, captured_at, created_at, extractions, applied_extractions, extraction_status',
          )
          .order('captured_at', { ascending: false })
          .limit(limit)
        if (opts.sinceIso) q2 = q2.gte('captured_at', opts.sinceIso)
        const retry = await q2
        if (retry.error) return []
        return (retry.data ?? []) as NoteRow[]
      }
      return []
    }
    return (data ?? []) as NoteRow[]
  } catch {
    return []
  }
}

// ── Error shape detectors (mirror src/lib/meds/dose-log.ts) ──────────

function isTableMissing(err: { code?: string; message?: string }): boolean {
  if (err.code === '42P01' || err.code === 'PGRST205') return true
  const m = err.message ?? ''
  return /relation .* does not exist|Could not find the table/i.test(m)
}

function isMissingUserId(err: { code?: string; message?: string }): boolean {
  if (err.code === '42703' || err.code === 'PGRST204') return true
  const m = err.message ?? ''
  return /user_id.*does not exist|Could not find the 'user_id'/i.test(m)
}
