/**
 * Graceful loader scoping for the pre-/post-migration window.
 *
 * Background (PR #115 isolation test): the v2 read loaders historically
 * pulled rows without filtering by user_id because the app started as
 * single-tenant. Migration 035 adds user_id columns to PHI tables; the
 * accompanying RLS / scoping work (this PR) teaches the loaders to
 * filter by the signed-in user when the column is present.
 *
 * The challenge: we ship the read-side filter BEFORE migration 035
 * applies in production. If we hard-required the column today, every
 * loader would 500 against the live DB. If we never filter, then once
 * migration 035 + a second user exist, user A could read user B's
 * rows. Neither is acceptable.
 *
 * This helper threads the needle:
 *
 *   1. Loaders accept an optional `userId`. The home/cycle/calories
 *      pages resolve it from getCurrentUser() before calling.
 *
 *   2. When the loader runs the query, it adds `.eq('user_id', userId)`
 *      ONLY when userId is provided AND we believe the column exists
 *      on this table. Existence is detected once per process per table
 *      and cached.
 *
 *   3. If the filtered query returns the PostgREST "column not found"
 *      error (PGRST204 / 42703 / "column ... does not exist"), the
 *      helper marks the column as missing for that table and retries
 *      WITHOUT the filter. This is the single-user fallback used until
 *      migration 035 lands.
 *
 *   4. If userId is null/undefined, the loader does NOT filter by
 *      user_id. This keeps the pre-migration single-user view of the
 *      app working: pages call without an id and get all rows.
 *
 * The result:
 *
 *   pre-migration  + caller passes Lanae's id     → filter fails, retry
 *                                                   without filter, Lanae
 *                                                   sees her own data.
 *   pre-migration  + caller passes nothing        → unfiltered, Lanae
 *                                                   sees her own data.
 *   post-migration + caller passes a user's id    → filter succeeds, the
 *                                                   user sees only their
 *                                                   own rows. New users
 *                                                   see empty.
 *   post-migration + caller passes nothing        → unfiltered. This path
 *                                                   stays only for
 *                                                   internal/cron tooling
 *                                                   that already gates on
 *                                                   APP_AUTH_TOKEN; no
 *                                                   browser session can
 *                                                   reach it.
 *
 * NEVER does user A see user B's rows. The "filter fails, retry without"
 * branch only fires when the column itself does not exist; once it does,
 * the filter cannot be silently dropped.
 *
 * This module is internal to the PHI loaders. Direct DB access from new
 * code should prefer the `with-user-scope` helpers in this same folder.
 */

/**
 * Cache of (table → column-present?) decisions inside the current
 * process. Resets on cold-start, which is fine: we only need it to avoid
 * repeating the failing query on every render of a hot page.
 *
 * `undefined` means "we have not yet seen a definitive answer for this
 * table". `true` means "user_id exists, always filter when caller
 * supplies an id". `false` means "the column does not exist; do not add
 * the filter".
 */
const userIdColumnPresent = new Map<string, boolean>()

/**
 * Test-only seam: clear the cache between tests so they do not see one
 * another's decisions. Not exported for app code.
 */
export function __resetUserIdColumnCache(): void {
  userIdColumnPresent.clear()
}

/**
 * Test-only seam: prime the cache to a known state. Useful for asserting
 * the post-migration path without first triggering a failed query.
 */
export function __setUserIdColumnPresent(table: string, present: boolean): void {
  userIdColumnPresent.set(table, present)
}

/**
 * Inspect the cached decision. Returns `undefined` when nothing is
 * cached yet.
 */
export function isUserIdColumnPresent(table: string): boolean | undefined {
  return userIdColumnPresent.get(table)
}

/**
 * Detect whether a Supabase error indicates a missing column. PostgREST
 * surfaces three closely related shapes; we accept all of them.
 */
export function isMissingColumnError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === '42703' || err.code === 'PGRST204') return true
  const msg = err.message ?? ''
  // Two phrasings cover essentially every PostgREST + Postgres surface:
  //   "column ... does not exist" (raw Postgres)
  //   "Could not find ... column ..."   (PostgREST schema-cache miss)
  if (/column\s+(?:"|`)?[\w.]*(?:"|`)?\s+(?:does\s+not\s+exist|not\s+found)/i.test(msg)) return true
  if (/could\s+not\s+find\s+(?:the\s+)?(?:'[\w.]+'\s+)?column/i.test(msg)) return true
  return false
}

/**
 * Run a Supabase query with a user_id scope, falling back to an
 * unfiltered query when the column does not yet exist on the target
 * table.
 *
 * Pass two query builders: `withFilter` already has `.eq('user_id', ...)`
 * applied; `withoutFilter` is the same query without the user scope.
 * The helper invokes `withFilter` first when we believe the column is
 * present (or we have not yet checked), and falls back to `withoutFilter`
 * iff the filtered call returns a missing-column error.
 *
 * `table` is used to cache the column-presence decision so the next call
 * skips the filtered attempt entirely once we have learned the column
 * does not exist.
 *
 * Both builders are lazy: this helper only awaits the one(s) it needs.
 */
export interface ScopedQueryResult<TData> {
  data: TData
  error: { message?: string; code?: string } | null
}

export async function runScopedQuery<TData>(opts: {
  table: string
  userId: string | null | undefined
  withFilter: () => PromiseLike<ScopedQueryResult<TData>>
  withoutFilter: () => PromiseLike<ScopedQueryResult<TData>>
}): Promise<ScopedQueryResult<TData>> {
  const { table, userId, withFilter, withoutFilter } = opts
  const wantsScope = userId != null && userId !== ''

  // No userId provided: use the unfiltered query directly. This is the
  // legacy single-tenant path and the cron tooling path; it never adds
  // a filter so it can never trip the column-missing branch.
  if (!wantsScope) {
    return withoutFilter()
  }

  const cached = userIdColumnPresent.get(table)
  if (cached === false) {
    // We already learned that user_id does not exist on this table in
    // the current process. Skip the filtered attempt entirely so we
    // do not write a noisy 42703 to the logs on every page render.
    return withoutFilter()
  }

  const result = await withFilter()
  if (!result.error) {
    if (cached === undefined) {
      userIdColumnPresent.set(table, true)
    }
    return result
  }

  if (isMissingColumnError(result.error)) {
    // First time we hit this on this process. Mark the column missing
    // and log a single warning so the operator can confirm the
    // migration has not yet applied. Subsequent calls skip the
    // filtered attempt entirely.
    userIdColumnPresent.set(table, false)
    console.warn(
      `[scope-query] user_id column missing on "${table}"; falling back to unfiltered query. ` +
        `Apply migration 035 to enable per-user scoping.`,
    )
    return withoutFilter()
  }

  // Some other error (RLS denial, network, syntax). Bubble it up so the
  // caller's existing try/catch (or the safe() wrapper in load-home-context)
  // handles it the same way it always has. We do NOT silently fall back
  // to the unfiltered query for non-schema errors: doing so would let an
  // RLS denial widen the scope and leak rows.
  return result
}
