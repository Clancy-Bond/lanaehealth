# Multi-user data isolation verification - 2026-04-26

## TL;DR

**FAIL.** The application code in `main` is multi-user-aware (PR #81, #86,
#92 added `requireUserScope`, `resolveUserId`, `user_id` filters on writes,
`getCurrentUser` everywhere). The **production Supabase database is not.**
Migrations 035 (add `user_id` columns), 036 (corrections), 037 (body
metrics), 038 (enable RLS), and 039 (cycle_messages) are all unapplied.

The result is a broken middle state where:
- **Reads leak PHI across users.** Brand-new authenticated users see
  Lanae's actual cycle history on `/v2/cycle` (cycle day, phase, BBT
  context, NC import data).
- **Writes fail with PostgREST schema-cache errors.** The application
  stamps `user_id` on every insert/upsert, the database rejects it
  because the column doesn't exist.
- **Migration 038 (RLS) is NOT safe to apply yet.** RLS would need
  `user_id` columns to exist first (migration 035), and the production
  DB has none of them.

## Method

1. Created two test users via Supabase Auth Admin API
   (`test-user-a@lanaehealth.dev`, `test-user-b@lanaehealth.dev`).
   Both confirmed and deleted post-test.
2. Inspected production schema via REST + a service-role node script.
   13 PHI tables checked; none have `user_id` columns. `cycle_messages`
   table doesn't exist.
3. Probed reads end-to-end via Playwright + cookie-based session,
   hitting real `/v2/cycle`, `/v2/calories`, `/api/v2/*` routes against
   the dev server (`localhost:3005`) running production env.
4. Probed writes via the same Playwright session, posting JSON to
   `/api/cycle/log`, `/api/v2/cycle/messages`, `/api/v2/home-layout`.

## Findings per route

### Reads

| Route | Status | Verdict |
|---|---|---|
| `/v2/cycle` (page) | 200 OK | LEAK. Renders Lanae's cycle day, phase, week strip with menstruation classifications. Brand-new User A saw "Cycle Day 9" + "follicular phase" + week-strip dates Apr 23-29 with menstruation classifications - all of which is Lanae's data. |
| `/v2/calories` (page) | 200 OK | LEAK BY DESIGN, hidden by sparse data. `home-data.ts` has no `user_id` filter; only reason User A sees zero is Lanae has no recent food logs. The route would leak any food entry on a date the test user picked. |
| `GET /api/v2/cycle/messages` | 200 OK | Returns empty array (cycle_messages table doesn't exist; query silently returns nothing). Not a leak in current state, but route's correctness depends on a missing table. |
| `GET /api/v2/home-layout` | 200 OK | Returns the user-scoped row OR the default. Scoping works. |
| `GET /api/v2/notifications/pending` | 200 OK | Empty result. |

### Writes

| Route | Status | Verdict |
|---|---|---|
| `POST /api/cycle/log` | 400 | BROKEN. PostgREST: `Could not find the 'user_id' column of 'cycle_entries' in the schema cache`. User A cannot log a period. |
| `POST /api/v2/cycle/messages` | 200 | Returns `{generated:1, persisted:0}`. Silent failure: the upsert hits a missing table and the route swallows the error. |
| `PUT /api/v2/home-layout` | 500 | `{"error":"save failed"}`. Returns generic 500; underlying cause not surfaced. |

### Legacy single-secret routes (PR #87 refactors)

| Route | Status | Verdict |
|---|---|---|
| `GET /api/chat/history` | 500 | Same root cause: `chat_messages` has no `user_id` column; resolveUserId stamps it on the WHERE clause; query fails. |
| `GET /api/timeline` | 500 | Same: `medical_timeline` has no `user_id` column. |

## Service-role regression check

Service role still sees all rows including legacy unscoped data, as
expected. Inserting a row with an invalid `user_id` column name fails
with the expected PostgREST error (no such column).

## Test users + data cleanup

- Both Auth users deleted via `DELETE /auth/v1/admin/users/<id>`.
  Verified absent from `auth/v1/admin/users?per_page=200`.
- Three legacy seed rows (cycle_entries / daily_logs / oura_daily,
  date 2020-01-01) inserted during the schema probe were deleted.
  Verified absent.

## What it would take to actually claim "multi-user safe"

1. Apply migration 035 (`run-035-user-id-phi-tables.mjs`) to add
   `user_id` columns to all 22 PHI tables.
2. Run the Lanae backfill (`run-035-backfill-lanae.mjs`) so her
   existing rows get her `user_id` and stop being legacy NULL.
3. Apply migrations 036, 037, 039 (additive feature columns and the
   `cycle_messages` table).
4. Refactor every read loader that today does `sb.from('phi').select()`
   without a `user_id` filter:
   - `src/lib/cycle/load-cycle-context.ts` (cycle_entries, nc_imported,
     oura_daily, BBT log)
   - `src/lib/calories/home-data.ts` (daily_logs, food_entries)
   - `src/lib/calories/goals.ts`, `weight.ts`, `water.ts`,
     `activity.ts` (likely all unscoped; spot-checked)
   - `src/lib/cycle/bbt-log.ts`
   - `src/lib/api/nc-cycle.ts` (`getCombinedCycleEntries`)
   - audit `src/lib/context/*` (vector store, summaries, narrative)
5. Add the `(user_id, date)` composite unique indexes called for in
   035 SQL so upserts don't collide across users.
6. THEN apply migration 038 (RLS). Until step 4 is done, RLS would
   break the loaders silently (queries return zero rows for everyone).
7. Re-run the E2E spec
   (`tests/e2e/v2-multi-user-isolation.spec.ts`) added in this PR.
   The spec is designed to fail loudly today and pass once the above
   steps are complete.

## Files referenced

- `src/lib/auth/with-user-scope.ts` (correct, unchanged)
- `src/lib/auth/resolve-user-id.ts` (correct, unchanged)
- `src/app/api/cycle/log/route.ts` (writes correctly, DB rejects)
- `src/app/api/food/log/route.ts` (writes correctly, DB rejects)
- `src/app/api/v2/cycle/messages/route.ts` (route logic correct, DB rejects)
- `src/app/v2/cycle/page.tsx` (mixes `getCurrentUser()` for some helpers
  with unscoped `loadCycleContext()` for the main data fetch - this is
  the leak)
- `src/lib/cycle/load-cycle-context.ts` (root cause for the cycle leak)
- `src/lib/calories/home-data.ts` (root cause for future calories leak
  once Lanae logs more food)
- `src/lib/migrations/035_user_id_phi_tables.sql` (the migration that
  must run before any of this works)
