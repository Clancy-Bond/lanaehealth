/**
 * Read + write helpers for med_doses (the time-stamped dose log
 * powering the home meds card).
 *
 * Pre-migration safety: the table comes from migration 046. Until that
 * is applied to prod, every write is wrapped so a "table not found"
 * error degrades to ok:false (caller surfaces a friendly toast) rather
 * than crashing the route. Reads return [] so the card renders empty
 * state instead of erroring.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'
import type { MedDose, MedSlot } from './types'

interface ListOpts {
  userId: string | null
  /** Inclusive ISO date (UTC) lower bound. */
  fromIso?: string
  /** Inclusive ISO date (UTC) upper bound. */
  toIso?: string
  /** Optional filter by slug. */
  slug?: string
  /** Default 200, capped at 500. */
  limit?: number
}

/**
 * Look up doses for the user across a window. Used by the meds card
 * to compute "what is checked off today" and by the PRN sub-section
 * to show "last taken: X days ago".
 *
 * Pre-migration: returns [] if the table does not exist yet.
 */
export async function listMedDoses(opts: ListOpts): Promise<MedDose[]> {
  const sb = createServiceClient()
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500)
  try {
    let q = sb
      .from('med_doses')
      .select('id, med_slug, med_name, kind, slot, source, dose_text, taken_at, notes')
      .order('taken_at', { ascending: false })
      .limit(limit)
    if (opts.userId) q = q.eq('user_id', opts.userId)
    if (opts.fromIso) q = q.gte('taken_at', opts.fromIso)
    if (opts.toIso) q = q.lte('taken_at', opts.toIso)
    if (opts.slug) q = q.eq('med_slug', opts.slug)

    const { data, error } = await q
    if (error) {
      if (isTableMissing(error)) return []
      // user_id column missing on legacy DBs: retry unscoped (single-tenant).
      if (isMissingUserId(error) && opts.userId) {
        const retry = await retryWithoutUser(sb, opts, limit)
        return retry
      }
      console.warn('[dose-log] list error:', error.message)
      return []
    }
    return (data ?? []) as MedDose[]
  } catch (err) {
    console.warn('[dose-log] list threw:', err)
    return []
  }
}

async function retryWithoutUser(
  sb: SupabaseClient,
  opts: ListOpts,
  limit: number,
): Promise<MedDose[]> {
  let q = sb
    .from('med_doses')
    .select('id, med_slug, med_name, kind, slot, source, dose_text, taken_at, notes')
    .order('taken_at', { ascending: false })
    .limit(limit)
  if (opts.fromIso) q = q.gte('taken_at', opts.fromIso)
  if (opts.toIso) q = q.lte('taken_at', opts.toIso)
  if (opts.slug) q = q.eq('med_slug', opts.slug)
  const { data, error } = await q
  if (error) return []
  return (data ?? []) as MedDose[]
}

export interface RecordDoseInput {
  userId: string | null
  med_slug: string
  med_name: string
  kind: 'scheduled' | 'prn'
  slot?: MedSlot | null
  taken_at?: string // ISO; defaults to now
  source?: 'tap' | 'note_extraction' | 'manual_edit'
  dose_text?: string | null
  notes?: string | null
}

export type RecordDoseResult =
  | { ok: true; id: string; taken_at: string }
  | { ok: false; error: string; reason: 'table_missing' | 'invalid' | 'db_error' }

export async function recordDose(input: RecordDoseInput): Promise<RecordDoseResult> {
  if (!input.med_slug || !input.med_name) {
    return { ok: false, error: 'med slug and name required', reason: 'invalid' }
  }
  const taken_at = input.taken_at ?? new Date().toISOString()

  const sb = createServiceClient()
  const row: Record<string, unknown> = {
    med_slug: input.med_slug,
    med_name: input.med_name,
    kind: input.kind,
    slot: input.slot ?? null,
    source: input.source ?? 'tap',
    dose_text: input.dose_text ?? null,
    taken_at,
    notes: input.notes ?? null,
  }
  if (input.userId) row.user_id = input.userId

  try {
    const { data, error } = await sb
      .from('med_doses')
      .insert(row)
      .select('id, taken_at')
      .single()
    if (error) {
      if (isTableMissing(error)) {
        return {
          ok: false,
          error: 'med_doses table not present yet (apply migration 046)',
          reason: 'table_missing',
        }
      }
      // Pre-035 fallback: drop user_id and retry.
      if (isMissingUserId(error) && row.user_id) {
        delete row.user_id
        const retry = await sb.from('med_doses').insert(row).select('id, taken_at').single()
        if (retry.error) {
          return { ok: false, error: retry.error.message, reason: 'db_error' }
        }
        const r = retry.data as { id: string; taken_at: string }
        return { ok: true, id: r.id, taken_at: r.taken_at }
      }
      return { ok: false, error: error.message, reason: 'db_error' }
    }
    const r = data as { id: string; taken_at: string }
    return { ok: true, id: r.id, taken_at: r.taken_at }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown',
      reason: 'db_error',
    }
  }
}

export interface DeleteDoseResult {
  ok: boolean
  error?: string
}

export async function deleteDose(opts: {
  userId: string | null
  id: string
}): Promise<DeleteDoseResult> {
  if (!opts.id) return { ok: false, error: 'id required' }
  const sb = createServiceClient()
  try {
    let q = sb.from('med_doses').delete().eq('id', opts.id)
    if (opts.userId) q = q.eq('user_id', opts.userId)
    const { error } = await q
    if (error) {
      if (isTableMissing(error)) return { ok: true } // nothing to delete
      // Pre-035 fallback: retry without user filter.
      if (isMissingUserId(error)) {
        const retry = await sb.from('med_doses').delete().eq('id', opts.id)
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

// ── Error shape detectors ─────────────────────────────────────────

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
