# Track A - Auth, Authorization, Database, RLS

**Owner:** Session A (web Claude Code recommended - long-running, no visual needed)
**Branch:** `security/track-a-auth-database`
**Depends on:** nothing. Track A ships first.
**Other tracks depend on:** Track A's `src/lib/auth/require-user.ts` helper.

---

## Mission

Establish the authentication / authorization foundation for LanaeHealth
and audit every database access pattern. Today, most API routes have no
auth at all, the Supabase public client is imported directly, and the
service-role key is used ad hoc. Track A makes auth explicit and
consistent, audits RLS on every existing table, and closes admin routes.

## Scope - files you MAY edit

- `src/lib/supabase.ts`
- `src/lib/auth/**` (new directory - create)
- `src/lib/migrations/*.sql` (new additive migrations only - never edit
  existing migration files)
- `src/app/api/admin/**`
- `src/app/api/profile/**`
- `src/app/api/onboarding/**`
- `src/app/api/preferences/**`
- `src/app/api/privacy-prefs/**`
- `src/app/api/context/**` (auth + DB hardening only; AI prompt content
  is Track B's responsibility)
- `src/app/api/health/route.ts`
- Additive entries in `src/lib/types.ts`
- New tests under `src/__tests__/` or `src/lib/__tests__/`

## Out of scope (cross-track if you find something)

- `src/app/api/integrations/**`, `/oura/**`, `/import/**`, `/cron/**`,
  `/push/**`, `/weather/**`, `/health-sync/**`, `/sync/**` → Track C
- `src/app/api/chat/**`, `/analyze/**`, `/intelligence/**`, `/narrative/**`,
  `/transcribe/**`, `/reports/**`, `/export/**`, `/share/**` → Track B
- `next.config.ts`, `vercel.json`, `src/middleware.ts`, deps → Track D

If you find a P0/P1 in another track's scope, record in
`cross-track-notes.md` and keep moving.

## Deliverable 1: Auth primitive

Create `src/lib/auth/require-user.ts` exporting a synchronous-style
helper usable from any API route:

```ts
// Example shape (adjust to actual auth model once decided)
export async function requireUser(
  req: Request,
): Promise<{ userId: string; email: string } | Response> {
  // Returns a Response (401) on failure; a user object on success.
}
```

Key decisions you must make and document in the helper file:

1. **Auth model.** This is a single-patient app. Options:
   - Shared secret in `Authorization: Bearer <token>` env-configured.
   - Supabase Auth (magic link) on a single allowlisted email.
   - Vercel-level protection (password-protect deployment via
     `VERCEL_AUTOMATION_BYPASS_SECRET` + Vercel Password Protection)
     + a light in-app check.
   Recommend the simplest-secure option. A single-patient app does NOT
   need row-scoped RLS per user but DOES need a perimeter.

2. **Public vs authenticated routes.** The helper should make the
   default deny. An allowlist (health check, OAuth callbacks,
   well-known PWA endpoints) should be explicit.

3. **CSRF stance.** If the auth token is a cookie, every state-changing
   endpoint needs a CSRF check (double-submit token or
   `SameSite=Strict`). If the auth token is a header (Bearer), CSRF
   is a non-issue but clients must attach the header on every request.

Ship a short ADR alongside the helper:
`docs/security/2026-04-19-sweep/adr-auth-model.md` - one page, 10 min
read.

## Deliverable 2: Apply auth to your scoped routes

Wrap every route handler in `src/app/api/{admin,profile,onboarding,preferences,privacy-prefs,context,health}` with
`requireUser()`. Ship a regression test per route that asserts a 401
without credentials and a 200 with.

## Deliverable 3: Admin route audit

`src/app/api/admin/**` runs DDL and data-ops. Specifically:

- `apply-migration-011/route.ts`
- `apply-migration-013/route.ts`
- `peek/route.ts`

Read each. For each, verify:

- It cannot be called unauthenticated.
- It cannot be called with a simple GET if it mutates state.
- It does not echo service-role key, DB URL, or PHI in responses.
- `peek` is either removed (if dev-only) or gated behind dev-only env
  check AND auth.

## Deliverable 4: Supabase client audit

Open `src/lib/supabase.ts`. Today it exports:

1. A `supabase` proxy backed by the public anon client - used in client
   components and most API routes.
2. `createServiceClient()` - service-role key, used for "admin
   operations."

Audit every `createServiceClient()` caller across the repo. For each,
answer in `findings-track-a.md`:

- Does this call really need service role, or would the anon client
  work with RLS?
- Is the service-role result ever returned to a client (response body,
  leaked in error message, cached in a client-readable place)?
- Could the call be moved behind `requireUser()` so even if RLS is
  imperfect, only the authenticated patient can trigger it?

Additionally verify `SUPABASE_SERVICE_ROLE_KEY` is never referenced from
code under `src/app/` client components or `src/components/`. Grep
for it.

## Deliverable 5: RLS audit

Run (or ask the user to run) in Supabase:

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

For every table listed in CLAUDE.md (existing) and every new table
(context_summaries, session_handoffs, health_profile, medical_narrative,
medical_timeline, active_problems, imaging_studies, correlation_results,
health_embeddings, medical_expenses, push_subscriptions, weather_daily,
cycle_engine_state, user_nutrient_targets, micro_care_completions,
lite_log_activities, orthostatic_tests, headache_attacks,
integration_tokens, import_history, user_preferences, privacy_prefs,
custom_trackables, nc_imported, food_nutrient_cache, oura_tokens,
api_cache, analysis_runs, analysis_findings, medical_identifiers,
chat_messages, daily_logs, pain_points, symptoms, cycle_entries,
food_entries, oura_daily, lab_results, appointments, documents):

- Is `rowsecurity = true`?
- Is there a policy for SELECT, INSERT, UPDATE, DELETE?
- Does the policy adequately restrict to the patient (if multi-patient)
  or to service-role / authenticated role (if single-patient)?

Ship a single additive migration `027_rls_sweep.sql` that enables RLS
and adds a deny-by-default policy (authenticated role only) for every
table currently missing it. Test via a temporary anon-key query that
the policies deny. Do not modify any existing data.

## Deliverable 6: Credential hygiene audit

Grep (`git log --all -p`) for any committed secrets:

```
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
VOYAGE_API_KEY
OURA_CLIENT_SECRET
OPENAI_API_KEY
```

If any are found in git history, file a P0 with rotation instructions.

Grep the current tree for:

- Hardcoded URLs pointing at production Supabase
- Hardcoded Anthropic/OpenAI/Voyage keys
- `console.log(process.env...)`
- Error messages that echo env vars or stack traces with secrets

## Deliverable 7: Session & token handling

If auth lands on Supabase Auth: verify JWT expiry, refresh handling,
session storage (localStorage vs httpOnly cookie trade-offs).

If auth lands on Bearer env secret: verify comparison is constant-time
(use `crypto.timingSafeEqual`) to avoid timing oracles, and the secret
is rotated documented.

## Checklist

- [ ] `src/lib/auth/require-user.ts` shipped with tests
- [ ] ADR for auth model written
- [ ] Every route in scope wrapped and tested (unauthenticated → 401)
- [ ] Admin routes locked down; `peek` removed or gated
- [ ] Every `createServiceClient()` call justified in findings report
- [ ] No service-role key referenced from client bundle (grep clean)
- [ ] `027_rls_sweep.sql` additive migration shipped + test showing
      anon denies writes
- [ ] Credential git-history sweep documented (clean or rotations
      queued)
- [ ] Findings report complete
- [ ] All fixes land with regression tests
- [ ] `npm test` and `npm run build` green
- [ ] Cross-track notes filed
