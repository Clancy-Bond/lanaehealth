# Ops Runbook

The single source of truth for keeping LanaeHealth production healthy.
If you only read one thing during an incident, read this.

## 1. Daily ops

### Where to check that cron jobs ran

Six cron jobs run on the production deployment. They are scheduled in
`vercel.json` and each one writes a row to the `cron_runs` audit table
at the start of every invocation, then updates the row to `success` or
`failed` at the end.

The fastest way to see whether everything fired in the last 24 hours
is to hit the health endpoint with the cron secret:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://lanaehealth.vercel.app/api/cron/_health | jq
```

The response shape:

```json
{
  "jobs": [
    {
      "cron_name": "api/cron/notifications",
      "last_run_at": "2026-04-25T03:00:00Z",
      "last_success_at": "2026-04-25T03:00:00Z",
      "last_failure_at": "2026-04-22T17:00:00Z",
      "last_status": "success",
      "last_error": null,
      "last_duration_ms": 412
    }
  ],
  "failureCountLast24h": 0,
  "inFlight": [],
  "generatedAt": "2026-04-25T04:12:00Z"
}
```

What to look for:

- `last_run_at` should be no older than the cron's schedule. The
  hourly notifications cron should never be more than ~70 minutes old.
  The 6-hourly doctor-prep cron should never be more than ~7 hours.
- `last_status` of `failed` is a hard signal. Read `last_error` and
  cross-check the corresponding evaluator (next section).
- `inFlight` rows older than the route's `maxDuration` are probably
  stuck. Vercel will already have killed the function; the row is
  orphaned and can be ignored unless it keeps recurring.

### Cron schedule (canonical, see vercel.json)

| Job | Path | Schedule | Purpose |
|-----|------|----------|---------|
| Integration sync | `/api/sync` | every 2 hours | Pulls Oura, weather, etc. |
| Daily weather | `/api/weather` | 08:00 UTC daily | Caches today's Kailua HI weather row |
| Push check-in | `/api/push/send` | every 10 min | Fires morning/evening check-in pushes inside the user's local fire window |
| Doctor prep | `/api/cron/doctor-prep` | every 6 hours | Refreshes the hypothesis tracker if an appointment is within 3 days |
| Build status | `/api/cron/build-status` | every 10 min | Pushes a notification when a Vercel deploy fails |
| Notifications | `/api/cron/notifications` | hourly | Hourly bubble-up across cycle/check-in/insurance/etc evaluators |

All routes require `Authorization: Bearer $CRON_SECRET`. Unauth GETs
return `401`.

## 2. Common alerts

### "Production build failed" push notification

Triggered by `/api/cron/build-status`. Open the inspect URL in the
notification body. If the failure is a flaky test, retry from the
Vercel UI. If it is a real regression, decide between rollback (next
section) and a hotfix.

### Sentry exception spike

Sentry currently has `tracesSampleRate: 0` and `replaysSessionSampleRate: 0`,
so what you get are unhandled exceptions only. Triage workflow:

1. Open the issue in Sentry. Look at the breadcrumb trail. Note that
   the PHI scrubber strips request bodies, cookies, query strings, and
   identified user fields, so you may need to reproduce locally.
2. Tag with severity. P0 is "core flow broken" (login, save log,
   chat). P1 is "feature broken but workaround exists". P2 is cosmetic.
3. Common false positives:
   - `NEXT_NOT_FOUND` and `NEXT_REDIRECT` are framework control flow,
     not errors. They are filtered in `src/instrumentation-client.ts`
     and `src/lib/observability/log.ts`. If you see them anyway, the
     filter regressed.
   - `AbortError` from a fetch the user navigated away from. Safe to
     ignore.
   - `ChunkLoadError` after a deploy. Usually a stale tab; resolves
     when the user reloads.
4. To silence a noisy issue without losing visibility, add a tag-based
   inbound filter inside Sentry rather than dropping it in the
   scrubber. The scrubber should be reserved for PHI redaction.

### `migration_042_not_applied` from notifications cron

Means migration 042 (notification_categories) has not been applied to
production. Apply it (see section 8) and the cron will resume.

### `migration_045_not_applied` from `/api/cron/_health`

Same idea but for the cron audit table. Apply migration 045.

## 3. Failure modes

### Notifications cron stops firing

1. `curl /api/cron/_health` and check `api/cron/notifications`
   `last_run_at`. If it's stale, fall through.
2. Read Vercel cron logs at
   `https://vercel.com/clancy-bonds-projects/lanaehealth/deployments`
   under the Crons tab. Look for the hourly entries.
3. If Vercel is firing but the cron is failing, the audit row's
   `error_message` and Sentry capture should tell you why.
4. If Vercel is not firing, confirm `CRON_SECRET` is set in the
   project's env vars (Project Settings -> Environment Variables ->
   Production). A missing secret causes the route to fail-closed
   401 and Vercel does not retry.

### Push notifications never arrive

1. Service worker registered? Open DevTools -> Application -> Service
   Workers in the user's browser. Should show `sw.js` activated.
2. VAPID keys present in env vars? `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_CONTACT`. Without them
   `/api/push/send` returns 500 with `VAPID keys not configured`.
3. The push subscription endpoint may have expired (Apple is
   particularly aggressive). The cron auto-disables subscriptions on
   404/410 responses. Lanae would need to re-enable from the settings
   page.

### Oura sync stale

`/api/sync` runs every 2 hours and calls `runOverdueSyncs()`. If the
Oura token has expired, the sync logs an error and the row is
recorded as `failed` in `cron_runs`. To fix:

1. Open the Oura integration page in the app.
2. Disconnect and reconnect to refresh the token.
3. Hit `/api/sync` once with the bearer to backfill.

## 4. Deploy procedure

The user has authorized routine `git push` and Vercel deploys without
explicit confirmation (see CLAUDE.md "Standing authorizations").

### Hotfix

1. Make the change directly on a fix branch off `main`.
2. `npm run typecheck && npm run test:e2e -- <relevant suite>` if the
   change is meaningful. For trivial doc/copy fixes, skip the e2e.
3. Squash-merge the PR. Vercel auto-deploys the merge.
4. Watch `/api/cron/build-status` (10 min cadence) or the deploy in
   the Vercel UI. Confirm the production URL serves the new commit
   SHA.

### Feature

Same flow but the PR carries a description, the new e2e test is
mandatory, and the merge waits for CI green. The squash commit
message should follow the conventional prefix (`feat:`, `fix:`,
`refactor:`, `chore:`, `feat(v2):`, etc.) since the PR title becomes
the commit subject.

## 5. Rollback procedure

When a deploy is bad and a forward fix is not the fastest path:

### Option A: Vercel instant rollback (preferred)

1. Open `https://vercel.com/clancy-bonds-projects/lanaehealth/deployments`.
2. Find the last green production deploy.
3. Click the three-dot menu -> "Promote to Production". This is
   instant and does not require a new build.

### Option B: Revert commit

1. `git revert <bad-sha>` on a new branch.
2. Open and merge the PR.
3. Vercel auto-deploys the revert. Slower than Option A but leaves an
   audit trail in git history.

Never `git push --force` to `main`. Force push bypasses the PR audit
trail and is only allowed with explicit user request, per CLAUDE.md.

## 6. Database backup recovery

Supabase keeps automatic daily backups for the project. To restore:

1. Open the Supabase dashboard:
   `https://supabase.com/dashboard/project/<ref>/database/backups`.
2. Pick the timestamp closest to the desired restore point.
3. Backups restore to a NEW project, not in place. Do this:
   - Restore the backup to a temporary project.
   - Connect to the temp project with `psql`.
   - Export the affected tables only with `pg_dump --table`.
   - Re-import into production with `psql -f`.
   - Verify counts match expectation.
4. NEVER restore the entire production project in place without first
   confirming with the user. ZERO data loss is the prime directive.

If the issue is "I want to undo a single bad UPDATE I just ran",
prefer the Supabase point-in-time recovery (PITR) UI which lets you
view rows as of a timestamp without restoring the whole DB. Available
on the Pro plan.

## 7. User support workflows

### Reset password

Lanae uses email magic-link auth via Supabase. To trigger a fresh
sign-in link:

1. Open the Supabase Authentication UI for the project.
2. Find the user by email.
3. Send password recovery email (works for magic links too).

### Recover account

If the user has lost access to their email and we need to manually
re-associate, this is a high-care operation. Confirm identity with
the user out of band (phone, in person) BEFORE making any changes.

1. In Supabase Auth UI, edit the user's email field. The next sign-in
   link goes to the new address.
2. Update `health_profile.email` if present so app-level identity
   stays in sync.

### Export user data

`GET /api/data/export` returns a ZIP of all PHI for the signed-in
user. Rate limited to one export per 24 hours per user, audited in
`data_export_log`. Lanae can self-serve from the Settings -> Data
Export page.

## 8. Migration application

This is the persistent guide for applying migrations to production.

Migration files live in `src/lib/migrations/<NNN>_<name>.sql`.
Each ships with a one-shot runner at `run-<NNN>-<name>.mjs` that uses
the service-role key from `.env.local`.

### Local dev (apply against the shared DB)

```bash
node src/lib/migrations/run-<NNN>-<name>.mjs
```

This runs with the same connection string as production because the
project shares one Supabase database with endotracker-lanae. Be
intentional: this affects production data.

### From Supabase SQL editor (preferred for prod)

1. Open `https://supabase.com/dashboard/project/<ref>/sql`.
2. Paste the contents of `<NNN>_<name>.sql`.
3. Click Run. Migrations are written to be idempotent, so re-running
   is safe.

### Migration conventions

- All migrations are pure additive `CREATE TABLE IF NOT EXISTS`,
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, etc.
- No destructive ops (DROP, TRUNCATE) without explicit user sign-off.
- Always include RLS policies that deny anon by default.
- Append a one-paragraph header comment that explains why the
  migration exists, not just what it does.

### Recent migrations

| # | Name | Notes |
|---|------|-------|
| 042 | notification_categories | Adds `enabled_types` + `notification_log`. Required for hourly notifications cron. |
| 043 | passkey_credentials | WebAuthn credentials. |
| 044 | data_export_log | One-export-per-24h enforcement + audit. |
| 045 | cron_runs | Audit table for cron observability. Required for `/api/cron/_health`. |

## 9. Sentry triage

How to read errors in Sentry without burning hours.

### Reading a captured event

1. The PHI scrubber redacts request bodies, query strings, cookies,
   user identity, and known PHI field names. So the breadcrumb trail
   is your primary signal, not the request payload.
2. Look at `tags.context` first. The custom `logError()` helper
   writes a context tag (e.g., `cron/notifications:eval`) that tells
   you exactly where the throw originated.
3. Frame paths point into `src/`. If the stack trace looks minified,
   `SENTRY_AUTH_TOKEN` is missing in the build env so source maps did
   not upload. Fix by adding the token to Vercel and triggering a
   redeploy.

### Common false positives

- `NEXT_NOT_FOUND` / `NEXT_REDIRECT`: framework control flow, not
  errors. Already filtered in our SDK config; if they show up, the
  filter regressed.
- `AbortError` from `fetch`: user navigated away mid-request. Safe to
  ignore unless the rate is unusual.
- `ChunkLoadError`: stale browser tab after a deploy. Resolves on
  reload.
- `ResizeObserver loop limit exceeded`: browser noise; not actionable.

### Silencing without losing visibility

If an error is real but cannot be fixed today, do NOT add it to the
PHI scrubber. Add a Sentry inbound filter (Project Settings ->
Inbound Filters) or an `ignoreErrors` entry in the SDK config. The
scrubber is reserved for PHI redaction; conflating it with noise
suppression makes both jobs harder.

### Verification endpoints

`/api/_health/sentry` (Bearer-gated by `HEALTH_SYNC_TOKEN`) supports
three modes:

```bash
curl -H "Authorization: Bearer $HEALTH_SYNC_TOKEN" \
  https://lanaehealth.vercel.app/api/_health/sentry           # config probe

curl -H "Authorization: Bearer $HEALTH_SYNC_TOKEN" \
  "https://lanaehealth.vercel.app/api/_health/sentry?action=message"  # send test event

curl -H "Authorization: Bearer $HEALTH_SYNC_TOKEN" \
  "https://lanaehealth.vercel.app/api/_health/sentry?action=throw"    # throw real exception
```

After a SDK config change, run all three and confirm the events show
up in Sentry within ~30 seconds.

## Appendix A: env var reference

| Var | Used by | Required? |
|-----|---------|-----------|
| `CRON_SECRET` | every cron route | yes (fail-closed) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CONTACT` | push routes | yes for push |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | build-status cron | yes for build-status |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry SDK | optional, no-ops if unset |
| `SENTRY_AUTH_TOKEN` | sourcemap upload | optional |
| `HEALTH_SYNC_TOKEN` | `/api/_health/*` | yes for Sentry verification |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role server paths | yes |
