# Findings Report — Track A (Auth, Authorization, Database, RLS)

**Branch:** `security/track-a-auth-database`
**Session:** Claude Code (web)
**Date:** 2026-04-19

---

## Summary

| Severity | Count | Fixed | Deferred |
|----------|-------|-------|----------|
| P0       | 2     | 1     | 1        |
| P1       | 4     | 4     | 0        |
| P2       | 3     | 2     | 1        |
| P3       | 1     | 0     | 1        |

All P1 findings fixed on this branch. One P0 requires a component
refactor that is too large for this sweep and is handed off to Track
D via `cross-track-notes.md`. Full test suite green: 1056 passing, 53
skipped (unchanged skip count from baseline).

---

## Findings

### A-001 — /api/admin/peek allowed unauthenticated dump of any Supabase table

- **Severity:** P0
- **Status:** fixed
- **Location:** `src/app/api/admin/peek/route.ts` (deleted)
- **Category:** auth

**Description.** GET `/api/admin/peek?table=<name>` used the service
client to select the first five rows plus an exact row count of any
table. No auth check. The production Vercel URL served it to the
public internet.

**Exploit scenario.** `curl https://lanaehealth.vercel.app/api/admin/peek?table=cycle_entries`
returned JSON rows and a row count. An attacker could enumerate table
names (obvious from the open-source code) and read patient data
without any credential.

**Fix.** Route deleted. Equivalent ad-hoc DB inspection is available
through the Supabase dashboard, which is behind Supabase's own auth.

**Regression test.** No test for a deleted route; its removal is
asserted by the absence of the file in git.

**References.** OWASP API Top 10 #1 (BOLA).

---

### A-002 — Three `'use client'` components invoke `createServiceClient()`

- **Severity:** P0 (architecture risk) / P1 (runtime)
- **Status:** deferred — handed off to Track D
- **Location:**
  - `src/components/log/WorkoutCard.tsx:82`
  - `src/components/log/VitalsCard.tsx` (same pattern)
  - `src/components/log/TiltTableTest.tsx` (same pattern)
- **Category:** misconfig / architecture

**Description.** Three client components call `createServiceClient()`
at runtime from the browser. Next.js strips server-only env vars from
the client bundle, so the service-role key string itself is NOT
leaked today (Track D will verify via bundle grep). But the pattern
is broken: either the function throws at runtime because
`process.env.SUPABASE_SERVICE_ROLE_KEY` is `undefined` on the client,
or an undocumented exposure path exists. Either possibility is a
problem.

**Exploit scenario.** Any future Next.js or bundler change that
exposes non-public env vars would bundle the service-role key into a
public asset. Total Supabase compromise.

**Fix.** Refactor each card to POST to a scoped server route. Out of
scope for this sweep (three components, many write paths, touches
Track D's components scope). Filed in `cross-track-notes.md`.

**Regression test.** Track D adds a bundle-output grep for
`SERVICE_ROLE` as a CI gate.

**References.** OWASP API Top 10 #7. Next.js env var docs.

---

### A-003 — Admin migration routes used non-constant-time comparison of service-role key

- **Severity:** P1
- **Status:** fixed
- **Location:**
  - `src/app/api/admin/apply-migration-011/route.ts` POST
  - `src/app/api/admin/apply-migration-013/route.ts` POST
- **Category:** crypto / timing oracle

**Description.** Both POST handlers used
`if (!serviceKey || token !== serviceKey) return 401`. The `!==`
string comparator short-circuits on the first differing byte, which
is a documented timing oracle for remote attackers. They also
conflated the DB superkey (service-role) with an API auth token, so
any leaked log line would have exposed full-Supabase-admin rather
than just the API surface.

**Fix.** Replaced with `requireAuth(req)` from the new
`src/lib/auth/require-user.ts`, which uses
`crypto.timingSafeEqual`. GET now requires auth too; the previous
"GET is open for UI feature-detect" rationale no longer applies
because the UI itself is behind auth.

**Regression test.** `src/__tests__/api-auth-gates.test.ts` covers
both GET and POST on both routes: 401 without credentials, non-401
with a valid Bearer.

**References.** OWASP ASVS 2.4.5 (constant-time compare). CWE-208.

---

### A-004 — Scoped API routes had no auth whatsoever

- **Severity:** P1
- **Status:** fixed
- **Location:**
  - `src/app/api/profile/route.ts` PUT
  - `src/app/api/onboarding/route.ts` GET + POST
  - `src/app/api/preferences/route.ts` GET + PUT
  - `src/app/api/privacy-prefs/route.ts` GET + PATCH (also A-005)
  - `src/app/api/health/route.ts` GET
  - `src/app/api/context/assemble/route.ts` POST
  - `src/app/api/context/core/route.ts` GET
  - `src/app/api/context/dream/route.ts` POST
  - `src/app/api/context/summaries/route.ts` GET + POST
  - `src/app/api/context/sync/route.ts` GET + POST
  - `src/app/api/context/sync-status/route.ts` GET
  - `src/app/api/context/test/route.ts` GET
- **Category:** auth

**Description.** Every route above accepted requests from anyone on
the internet. Impact ranged from reading Lanae's diagnosis profile,
to writing arbitrary onboarding content, to triggering expensive
Anthropic API calls (context dream cycle = 5 minutes of Claude usage
per invocation, billable), to dumping the full permanent-core prompt
that contains medications and diagnoses.

**Fix.** Each handler now calls `requireAuth(req)` at entry. 401 on
missing/invalid credential.

**Regression test.** `src/__tests__/api-auth-gates.test.ts` covers
every listed verb (26 assertions).

**References.** OWASP API Top 10 #2 (Broken Authentication).

---

### A-005 — Privacy-prefs accepted token via query parameter

- **Severity:** P1
- **Status:** fixed
- **Location:** `src/app/api/privacy-prefs/route.ts` PATCH
- **Category:** auth / logging hygiene

**Description.** The PATCH handler accepted the admin token via an
`x-privacy-admin-token` header OR a `?token=<value>` query parameter.
Query-param tokens leak into access logs, Vercel analytics, browser
history, and Referer headers sent to any third-party script. The
comparison also used `!==` rather than constant-time.

**Fix.** Collapsed onto `requireAuth`: Bearer header or session
cookie only, constant-time compare, no query-param path.
`PRIVACY_ADMIN_TOKEN` env var is no longer consulted.

**Regression test.** Covered under A-004's route regression suite.

**References.** CWE-598 (Sensitive Info in Query Strings).

---

### A-006 — No shared auth primitive: every route reinvented the wheel

- **Severity:** P1
- **Status:** fixed
- **Location:** sweep-wide
- **Category:** misconfig

**Description.** Before this sweep, four routes implemented four
different auth patterns and most routes had no auth at all. Security
regressions accumulate faster than they can be reviewed.

**Fix.** Shipped `src/lib/auth/require-user.ts` with
`requireAuth(req)`, `checkAuth(req)`, `isAuthed(req)`, and
`constantTimeEqual(a, b)`. Decision recorded in
`docs/security/2026-04-19-sweep/adr-auth-model.md`. Tracks B, C, D
build on the same primitive.

**Regression test.**
`src/lib/auth/__tests__/require-user.test.ts` — 13 unit tests
covering bearer/cookie/missing/wrong/fail-closed/case/substring.

**References.** Process improvement. CLAUDE.md static/dynamic
boundary discipline, applied to auth.

---

### A-007 — No patient-facing login flow for the browser

- **Severity:** P2
- **Status:** fixed
- **Location:** new
- **Category:** auth

**Description.** The browser had no way to authenticate a session.
Ad-hoc tokens were server-to-server only; the PWA had nothing.

**Fix.** `POST /api/auth/login` accepts `{ password }`, compares
with `APP_AUTH_PASSWORD` constant-time, and sets an
`HttpOnly; Secure; SameSite=Strict` cookie named `lh_session` that
carries `APP_AUTH_TOKEN` with a 30-day TTL. `POST /api/auth/logout`
zeroes the cookie. Track D's middleware will redirect unauthenticated
browser traffic to a login page (future work).

**Regression test.** `src/app/api/auth/__tests__/login.test.ts` —
5 tests for correct/wrong password, missing field, misconfigured
server, cookie attributes.

**References.** OWASP Session Management Cheat Sheet.

---

### A-008 — RLS inconsistent across app-owned tables

- **Severity:** P2
- **Status:** fixed (migration authored; apply pending via dashboard)
- **Location:** `src/lib/migrations/027_rls_sweep.sql`
- **Category:** authz / defense-in-depth

**Description.** RLS is the second-line defense for the single-patient
app. Prior migrations toggled RLS inconsistently.

**Fix.** Additive migration `027_rls_sweep.sql` enables RLS on every
app-owned table (idempotent `IF NOT EXISTS` guards, zero data
mutation) and adds a deny-anon + allow-authenticated policy pair per
table. Service-role continues to bypass RLS, so existing server-side
code keeps working unchanged.

**Regression test.** The verification SQL is embedded at the bottom
of the migration file as a comment for the operator to run
post-apply.

**References.** Supabase RLS docs.

---

### A-009 — Git history audit

- **Severity:** P3
- **Status:** accepted (clean)
- **Location:** full git history
- **Category:** secrets

**Description.** Ran `git log --all -p -S` for `SUPABASE_SERVICE_ROLE_KEY=`,
`ANTHROPIC_API_KEY=`, `OURA_CLIENT_SECRET=`, `OPENAI_API_KEY=`. No
matches. No secrets were committed to history.

**Fix.** None needed.

**References.** N/A.

---

### A-010 — Widespread `createServiceClient()` usage not individually justified

- **Severity:** P2
- **Status:** deferred (cross-track)
- **Location:** 169 files (see `cross-track-notes.md` for handoff)
- **Category:** authz

**Description.** `createServiceClient()` is imported in 169 files,
most of them API routes. Many of these probably do not need
service-role privileges; the anon client under RLS would be
safer. A systematic per-call audit is too large for this sweep.

**Fix.** Deferred. Track B (AI routes), Track C (external-boundary
routes), and Track D (generic CRUD) each audit their own scope
during their sweep. Migration 027 provides defense-in-depth while
the audit continues.

**References.** Principle of least privilege.

---

## Files changed

### Added

- `src/lib/auth/require-user.ts`
- `src/lib/auth/__tests__/require-user.test.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/__tests__/login.test.ts`
- `src/__tests__/api-auth-gates.test.ts`
- `src/lib/migrations/027_rls_sweep.sql`
- `docs/security/2026-04-19-sweep/adr-auth-model.md`
- `docs/security/2026-04-19-sweep/findings-track-a.md`

### Modified

- `src/app/api/admin/apply-migration-011/route.ts`
- `src/app/api/admin/apply-migration-013/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/onboarding/route.ts`
- `src/app/api/preferences/route.ts`
- `src/app/api/privacy-prefs/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/context/assemble/route.ts`
- `src/app/api/context/core/route.ts`
- `src/app/api/context/dream/route.ts`
- `src/app/api/context/summaries/route.ts`
- `src/app/api/context/sync/route.ts`
- `src/app/api/context/sync-status/route.ts`
- `src/app/api/context/test/route.ts`
- `src/app/api/context/__tests__/sync-status.test.ts` (test updated
  to pass authenticated `Request`)

### Deleted

- `src/app/api/admin/peek/route.ts`

---

## Required environment variables (deploy checklist)

Before merging this PR, set in Vercel (Production + Preview):

| Var                       | Purpose                       | Generate with             |
|---------------------------|-------------------------------|---------------------------|
| `APP_AUTH_TOKEN`          | Shared secret all routes accept | `openssl rand -base64 32` |
| `APP_AUTH_PASSWORD`       | Browser login password        | any strong passphrase     |
| `APP_SESSION_COOKIE_NAME` | Optional cookie name override | skip (default lh_session) |

Missing either of the first two fails every auth check with 500 and
blocks login entirely. This is intentional fail-closed behavior.

After the PR merges:

1. Apply migration 027 via the Supabase dashboard SQL editor (paste
   `src/lib/migrations/027_rls_sweep.sql`).
2. Update the iOS Shortcut to send `Authorization: Bearer $APP_AUTH_TOKEN`.
3. Log in via the browser to obtain the `lh_session` cookie.
