/**
 * Graceful upsert scoping for the pre-/post-migration window.
 *
 * Companion to `scope-query.ts`. Reads got a graceful fallback in PR
 * #116; writes (specifically `health_profile` upserts in onboarding,
 * settings, and the doctor profile) need the same treatment so a fresh
 * pre-migration deploy does not freeze users at the first save.
 *
 * Three failure modes we have to handle:
 *
 *   A) `user_id` column does not exist on the table (migration 035
 *      not applied yet).
 *      Postgres / PostgREST signal:
 *        code = 42703  | PGRST204
 *        message: /column .* user_id .* (does not exist|not found)/i
 *      Fix: drop user_id from the row and retry.
 *
 *   B) No unique constraint matching `(user_id, section)` (migration
 *      041 not applied yet, or only the legacy `(section)` UNIQUE
 *      survives).
 *      Postgres signal:
 *        code = 42P10
 *        message: /no unique or exclusion constraint matching/i
 *      Fix: retry with `onConflict` set to whatever constraint we
 *      believe is present (caller-supplied legacy key) or, if all
 *      else fails, fall back to manual SELECT then UPDATE / INSERT.
 *
 *   C) Both A and B simultaneously (truly fresh schema): drop user_id
 *      and use the legacy `(section)` constraint.
 *
 * The decision per table is cached for the process lifetime so we do
 * not hammer the DB with failing-then-retrying writes on every
 * keystroke. Cold starts re-detect from scratch, which is fine.
 *
 * NEVER does this helper widen scope: if user_id IS present and a
 * write would silently lose the user_id (the legacy fallback), we
 * also write a structured warning so the operator can confirm a
 * migration is overdue.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingColumnError } from './scope-query'

/**
 * What we know about a table after probing:
 *   - hasUserId: whether the `user_id` column is present
 *   - hasUserSectionUnique: whether `(user_id, section)` UNIQUE is present
 *   - hasLegacySectionUnique: whether plain `section` UNIQUE is present
 *
 * `undefined` means "not yet probed".
 */
interface TableSchemaState {
  hasUserId?: boolean
  hasUserSectionUnique?: boolean
  hasLegacySectionUnique?: boolean
}

const tableState = new Map<string, TableSchemaState>()

/** Test-only seam: forget everything we have learned about schemas. */
export function __resetSchemaCache(): void {
  tableState.clear()
}

/** Test-only seam: prime the cache to a known state. */
export function __setSchemaState(table: string, s: TableSchemaState): void {
  tableState.set(table, { ...(tableState.get(table) ?? {}), ...s })
}

function getState(table: string): TableSchemaState {
  let s = tableState.get(table)
  if (!s) {
    s = {}
    tableState.set(table, s)
  }
  return s
}

/** Postgres "no unique constraint matching ON CONFLICT" detection. */
function isMissingConflictTargetError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === '42P10') return true
  const msg = err.message ?? ''
  if (/no unique or exclusion constraint matching/i.test(msg)) return true
  // PostgREST flavor.
  if (/there is no unique or exclusion constraint/i.test(msg)) return true
  return false
}

export interface UpsertProfileSectionInput {
  /** Caller's Supabase client. Always pass the service-role client for
   *  onboarding-style writes; routes that already gate on `requireUser()`
   *  may also pass a per-request client.
   */
  sb: SupabaseClient
  /** Postgres table name; must include a `section` column. */
  table: string
  /** Authenticated user id (uuid). Optional — when omitted we never
   *  try to write user_id at all (legacy single-tenant path).
   */
  userId: string | null | undefined
  /** Section identifier (the natural key inside the user's profile). */
  section: string
  /** JSONB content payload. */
  content: unknown
  /** Optional override for the timestamp (defaults to `new Date().toISOString()`). */
  updatedAtIso?: string
}

export type UpsertResult = { ok: true } | { ok: false; error: string }

/**
 * Upsert one row into a `health_profile`-shaped table, gracefully
 * degrading across the migration timeline:
 *
 *   - Multi-tenant (post-035 + post-041):
 *       row = { user_id, section, content, updated_at }
 *       onConflict = "user_id,section"
 *
 *   - Multi-tenant column, legacy unique (post-035 + pre-041):
 *       row = { user_id, section, content, updated_at }
 *       onConflict = "section"     (legacy global UNIQUE)
 *
 *   - Pre-migration (pre-035, pre-041):
 *       row = { section, content, updated_at }
 *       onConflict = "section"
 *
 * If even the legacy upsert fails because the constraint name has
 * been dropped or renamed by hand, we fall back to a manual
 * select-then-update-or-insert to guarantee progress.
 */
export async function upsertProfileSection(
  input: UpsertProfileSectionInput,
): Promise<UpsertResult> {
  const { sb, table, userId, section, content, updatedAtIso } = input
  if (!section) return { ok: false, error: 'section required' }

  const state = getState(table)
  const updated_at = updatedAtIso ?? new Date().toISOString()
  const wantsScope = !!userId

  // First-attempt strategy is determined by what we already know.
  // If we have not probed yet, optimistically try the post-migration
  // shape; the fallback chain handles every other state.
  const strategy = pickFirstStrategy(state, wantsScope)

  const result = await tryStrategy({ sb, table, userId, section, content, updated_at, strategy })
  if (result.ok === true) return result.value

  // Translate the failure into a state update + try the next strategy.
  const firstError = result.error
  const next = pickFallbackStrategy(state, strategy, firstError, wantsScope)
  if (!next) {
    return { ok: false, error: firstError.message ?? 'upsert failed' }
  }

  const fallback = await tryStrategy({
    sb,
    table,
    userId,
    section,
    content,
    updated_at,
    strategy: next,
  })
  if (fallback.ok === true) return fallback.value

  // Last-resort: manual SELECT then UPDATE or INSERT. This bypasses
  // ON CONFLICT entirely so we never depend on any unique constraint.
  return manualUpsert({ sb, table, userId, section, content, updated_at, wantsScope })
}

// ── Internals ──────────────────────────────────────────────────────

type Strategy =
  | { kind: 'user-section'; includeUserId: true; onConflict: 'user_id,section' }
  | { kind: 'user-with-legacy-conflict'; includeUserId: true; onConflict: 'section' }
  | { kind: 'legacy'; includeUserId: false; onConflict: 'section' }

function pickFirstStrategy(state: TableSchemaState, wantsScope: boolean): Strategy {
  // No user requested: skip straight to the legacy shape. This is
  // the cron / single-tenant tooling path.
  if (!wantsScope) return { kind: 'legacy', includeUserId: false, onConflict: 'section' }

  if (state.hasUserId === false) {
    // We already learned this table has no user_id column. Stay
    // legacy until cold-start re-probe.
    return { kind: 'legacy', includeUserId: false, onConflict: 'section' }
  }
  if (state.hasUserSectionUnique === false && state.hasLegacySectionUnique !== false) {
    return {
      kind: 'user-with-legacy-conflict',
      includeUserId: true,
      onConflict: 'section',
    }
  }
  return { kind: 'user-section', includeUserId: true, onConflict: 'user_id,section' }
}

function pickFallbackStrategy(
  state: TableSchemaState,
  attempted: Strategy,
  error: { message?: string; code?: string },
  wantsScope: boolean,
): Strategy | null {
  if (isMissingColumnError(error)) {
    // The user_id column itself is missing. Remember that and drop
    // to the legacy shape on retry.
    state.hasUserId = false
    if (attempted.kind !== 'legacy') {
      return { kind: 'legacy', includeUserId: false, onConflict: 'section' }
    }
    return null
  }
  if (isMissingConflictTargetError(error)) {
    if (attempted.kind === 'user-section') {
      // The (user_id, section) UNIQUE is not in place. Try the
      // legacy `(section)` UNIQUE while still writing user_id.
      state.hasUserSectionUnique = false
      if (wantsScope) {
        return {
          kind: 'user-with-legacy-conflict',
          includeUserId: true,
          onConflict: 'section',
        }
      }
      return { kind: 'legacy', includeUserId: false, onConflict: 'section' }
    }
    if (attempted.kind === 'user-with-legacy-conflict' || attempted.kind === 'legacy') {
      // No conflict target survives. Mark the legacy unique missing
      // so we go straight to manual upsert next time.
      state.hasLegacySectionUnique = false
      return null
    }
  }
  return null
}

interface TryStrategyArgs {
  sb: SupabaseClient
  table: string
  userId: string | null | undefined
  section: string
  content: unknown
  updated_at: string
  strategy: Strategy
}

async function tryStrategy(
  args: TryStrategyArgs,
): Promise<{ ok: true; value: UpsertResult } | { ok: false; error: { message?: string; code?: string } }> {
  const { sb, table, userId, section, content, updated_at, strategy } = args
  const row: Record<string, unknown> = { section, content, updated_at }
  if (strategy.includeUserId && userId) row.user_id = userId

  try {
    const { error } = await sb.from(table).upsert(row, { onConflict: strategy.onConflict })
    if (!error) {
      // Successful write: cache positive evidence.
      const state = getState(table)
      if (strategy.includeUserId) state.hasUserId = true
      if (strategy.kind === 'user-section') state.hasUserSectionUnique = true
      if (strategy.kind === 'user-with-legacy-conflict' || strategy.kind === 'legacy') {
        state.hasLegacySectionUnique = true
      }
      // Operator visibility: the caller asked for multi-tenant scoping
      // but the post-migration constraint isn't present yet. Worth a
      // single noisy line so the migration debt is obvious.
      if (strategy.kind === 'user-with-legacy-conflict' || (strategy.kind === 'legacy' && userId)) {
        console.warn(
          `[scope-upsert] wrote to "${table}" via legacy strategy "${strategy.kind}". ` +
            `Apply migration ${strategy.includeUserId ? '041' : '035 + 041'} ` +
            `to enable per-user scoping.`,
        )
      }
      return { ok: true, value: { ok: true } }
    }
    return { ok: false, error: { message: error.message, code: error.code } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return { ok: false, error: { message } }
  }
}

interface ManualUpsertArgs {
  sb: SupabaseClient
  table: string
  userId: string | null | undefined
  section: string
  content: unknown
  updated_at: string
  wantsScope: boolean
}

async function manualUpsert(args: ManualUpsertArgs): Promise<UpsertResult> {
  const { sb, table, userId, section, content, updated_at, wantsScope } = args
  const state = getState(table)
  const includeUserId = wantsScope && state.hasUserId !== false

  try {
    // Look for an existing row. Filter by user_id when we know we can.
    let selectQ = sb.from(table).select('id').eq('section', section)
    if (includeUserId && userId) selectQ = selectQ.eq('user_id', userId)

    const { data: existing, error: selErr } = await selectQ.maybeSingle()
    if (selErr && !isMissingColumnError(selErr)) {
      return { ok: false, error: selErr.message }
    }

    const row: Record<string, unknown> = { section, content, updated_at }
    if (includeUserId && userId) row.user_id = userId

    if (existing && (existing as { id?: string }).id) {
      const { error: updErr } = await sb
        .from(table)
        .update(row)
        .eq('id', (existing as { id: string }).id)
      if (updErr) return { ok: false, error: updErr.message }
    } else {
      const { error: insErr } = await sb.from(table).insert(row)
      if (insErr) return { ok: false, error: insErr.message }
    }

    console.warn(
      `[scope-upsert] manual upsert path used on "${table}" (no usable unique constraint). ` +
        `Apply migrations 035 + 041 to restore native upsert.`,
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
