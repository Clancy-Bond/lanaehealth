---
date: 2026-04-16
agent: R7
area: migrations
status: FIXED (applied 2026-04-17 via Supabase SQL editor)
severity: MEDIUM
applied_by: orchestrator via Chrome + Monaco editor paste
verification_method: api-vs-code
---

# Migration 012 (push_subscriptions) not applied in live DB

## One-sentence finding
The `push_subscriptions` table does not exist in live Supabase, and any
code path that reads or writes it will fail with HTTP 500
("Could not find the table 'public.push_subscriptions' in the schema
cache"); migration 012 landed in git today (commit 5b8da46,
2026-04-16 23:25) but has not been applied to the database.

## Expected
After running `src/lib/migrations/012_push_subscriptions.sql`, the live
DB has a `push_subscriptions` table with columns:
`id, endpoint (unique), keys (jsonb), user_agent, morning_time,
evening_time, timezone, enabled, last_sent_at, created_at, updated_at`
plus partial index `push_subscriptions_enabled_idx` on enabled rows.

## Actual
```
$ curl -s 'http://localhost:3005/api/admin/peek?table=push_subscriptions&limit=1' \
    -w '\nHTTP %{http_code}\n'
{"error":"Could not find the table 'public.push_subscriptions' in the schema cache"}
HTTP 500
```

## Blast radius (to investigate before applying)
Any caller of `supabase.from('push_subscriptions')` will 500. Known likely
call sites to search and verify:
- `src/app/api/push/` (subscribe / unsubscribe endpoints)
- server-side cron that dispatches morning and evening reminders (the
  migration comment says "so the server-side cron can dispatch check-in
  reminders even when the tab is closed")
- any service worker registration hook that posts the subscription to the
  server on the client

If any of these are already wired into Vercel cron or a client bootstrap,
this is an **active** 500, not a latent bug.

## How to verify after fix

```bash
# 1. Table exists:
curl -s 'http://localhost:3005/api/admin/peek?table=push_subscriptions&limit=1' \
  -w '\nHTTP %{http_code}\n'
# Expect: {"count":0,"sample":[]} + HTTP 200

# 2. Columns match spec:
curl -s 'http://localhost:3005/api/admin/peek?table=push_subscriptions&limit=0' \
  | python3 -m json.tool
# Then insert a test row via the push subscribe endpoint (if exists) and
# verify keys match the 11-column schema.
```

## Recommended action
- INVESTIGATE which routes / crons reference `push_subscriptions`. If any
  are live, this is a HIGH-severity bug (user-visible 500s on push
  subscribe). If none are wired yet, LOW severity, same fix.
- APPLY migration via `docs/plans/MIGRATION_012_APPLY.md` (Supabase
  dashboard SQL paste, same pattern as 011). Idempotent; safe to re-run.
- CONSIDER adding an `/api/admin/apply-migration-012` probe endpoint that
  mirrors the 011 pattern so the app can feature-detect cleanly.

## Resolution (2026-04-17, IMPL-W3-1)

A canonical migration runner now exists at `scripts/migrate.mjs`, wired
into `package.json` as `npm run db:migrate`. It reads every SQL file in
`src/lib/migrations/` in alphanumeric order, maintains a
`schema_migrations` tracking table, wraps each file in a transaction,
and treats "already exists" errors (Postgres codes 42P07 / 42701 /
42710 / 23505 / etc.) as soft-success so prior hand-applied migrations
are absorbed cleanly. Running it with `SUPABASE_DB_URL` or
`DATABASE_URL` in env will create `push_subscriptions`. The runner was
**not** executed against the live DB in this session; that action
remains user-gated. Until it is run, any code path that reads or writes
`push_subscriptions` still returns HTTP 500 as documented above.
