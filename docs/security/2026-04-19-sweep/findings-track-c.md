# Findings Report — Track C (External Boundary)

---

## Summary

| Severity | Count | Fixed | Deferred |
|----------|-------|-------|----------|
| P0       | 2     | 2     | 0        |
| P1       | 4     | 3     | 1        |
| P2       | 5     | 4     | 1        |
| P3       | 2     | 1     | 1        |

"Deferred" entries have a cross-track note pointing at the owner
(typically Track A for auth).

---

## Findings

### C-001 — Vercel cron endpoints reachable without the cron secret

- **Severity:** P0
- **Status:** fixed
- **Location:**
  - `src/app/api/sync/route.ts` (was: no auth at all)
  - `src/app/api/weather/route.ts` (was: no auth at all)
  - `src/app/api/weather/sync/route.ts` (was: no auth at all)
  - `src/app/api/cron/doctor-prep/route.ts` (was: spoofable
    `x-vercel-cron: 1` fallback)
  - `src/app/api/cron/build-status/route.ts` (was: same)
  - `src/app/api/push/send/route.ts` (was: auth gated only when
    `CRON_SECRET` happened to be set; missing env var fails open)
  - `src/app/api/push/prn-poll/route.ts` (was: same)
- **Category:** auth

**Description.** Every path scheduled under `vercel.json` cron, plus
the closely-related weather and push helpers, was reachable without
proof that the request came from Vercel's cron runner. An attacker on
the public internet could:

- Trigger the doctor-prep pipeline on every request (it calls
  `/api/intelligence/analyze` which invokes Claude).
- Spam push notifications (`/api/push/send`, `/api/push/prn-poll`).
- Force third-party syncs (`/api/sync` → Oura, weather).
- Walk weather cache into Open-Meteo.

**Exploit scenario.** `curl https://lanaehealth.vercel.app/api/sync -X POST`
ran every integration sync. `curl -I ... /api/cron/doctor-prep`
returned 200 without auth.

**Fix.** Added `src/lib/cron-auth.ts` which validates
`Authorization: Bearer $CRON_SECRET` via `crypto.timingSafeEqual` and
fails closed when the env var is not configured (no more "open when
misconfigured" path). The spoofable `x-vercel-cron: 1` fallback is
removed. Every cron-reachable route now calls `requireCronAuth(req)`
(or `isVercelCron(req)` where it was already wrapping auth in a local
helper) at the top of every HTTP method handler.

Rotation procedure documented in
`docs/security/2026-04-19-sweep/cron-secret-rotation.md`.

**Regression test.** `src/__tests__/security/cron-auth.test.ts`
exercises each cron route: no header → 401, wrong bearer → 401,
missing env var → 401.

**References.**
- https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
- OWASP API Top 10 #2 (Broken Authentication)

---

### C-002 — `/api/health-sync` lacked timing-safe auth, size cap, rate limit, and schema validation

- **Severity:** P0
- **Status:** fixed
- **Location:** `src/app/api/health-sync/route.ts`
- **Category:** auth + injection + dos

**Description.** The iOS Shortcut JSON ingestion route shipped with
string-equality bearer comparison (timing side channel), no body-size
cap, no schema validation (the payload type was a TypeScript
interface only), no rate limit, and error branches that echoed raw
Supabase messages (which contain dates and table context) back to the
caller.

**Exploit scenario.** An attacker with network reach could:
1. Leak the bearer token one byte at a time via response-time
   analysis.
2. POST a 50 MB JSON body and force a long parse + DB loop.
3. Post malformed structures to exfiltrate internal field names via
   echoed error strings.

**Fix.**
- `timingSafeEqualStrings()` (`src/lib/constant-time.ts`) for the
  bearer check; `HEALTH_SYNC_TOKEN` missing now returns 503
  "unconfigured" (fail-closed).
- Explicit 1 MB request-body cap enforced pre-parse (413 on breach).
- Zod schemas for every sub-array. Shortcut forward compatibility
  preserved via `.passthrough()` on object shapes, but value-level
  violations return opaque `400 invalid_payload`.
- 60 req / min / caller in-memory rate limit
  (`src/lib/rate-limit.ts`). Key is a hash of the bearer so
  attackers without the token share the `anon`/IP bucket.
- Errors never echo payload. Supabase messages are logged server-side;
  response carries `{ error: 'write_failed' }`.

**Regression test.** `src/__tests__/security/health-sync.test.ts`
covers: no header → 401, wrong bearer → 401, oversized body → 413,
invalid JSON → 400, invalid schema → 400, happy path → 200.

**References.**
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP API Top 10 #4 (Unrestricted Resource Consumption)

---

### C-003 — OAuth callbacks accept any returned `state` (CSRF)

- **Severity:** P1
- **Status:** fixed
- **Location:**
  - `src/app/api/oura/authorize/route.ts` (was: hardcoded
    `state=lanaehealth`)
  - `src/app/api/oura/callback/route.ts` (was: no state check)
  - `src/app/api/integrations/[integrationId]/callback/route.ts` (was:
    cookie set by authorize but never validated by callback)
- **Category:** csrf

**Description.** None of the OAuth callback routes matched the
returned `state` against the cookie the authorize route set. Oura
specifically used the literal constant `lanaehealth` as its state.
An attacker could start an OAuth flow under their own Oura account,
craft a `code` link, trick the patient into clicking it, and cause
the callback to exchange the attacker's code into the patient's
token storage.

**Exploit scenario.** Attacker visits the authorize URL themselves,
captures the Oura `code`, sends
`https://lanaehealth.vercel.app/api/oura/callback?code=<attacker_code>`
to the patient. Old code: callback exchanges the code, writes tokens
into `oura_tokens`, integration now pulls attacker data.

**Fix.**
- Oura authorize generates `randomBytes(32).toString('base64url')` and
  stores it in a httpOnly, sameSite=lax, 10-minute cookie.
- Both Oura and generic-integration callbacks require the query-param
  `state` to match the cookie via `timingSafeEqualStrings`. Mismatched
  state redirects to `/settings?error=state_mismatch`.
- State cookie deleted on every exit path (success or failure) to
  prevent replay.

**Regression test.** `src/__tests__/security/oauth-state.test.ts`.

**References.**
- https://datatracker.ietf.org/doc/html/rfc6749#section-10.12

---

### C-004 — File-upload / import endpoints had no size cap or rate limit

- **Severity:** P1
- **Status:** fixed (DoS / cost vector only; see C-005 for auth)
- **Location:**
  - `src/app/api/import/apple-health/route.ts`
  - `src/app/api/import/universal/route.ts`
  - `src/app/api/import/mynetdiary/route.ts`
  - `src/app/api/import/natural-cycles/route.ts`
  - `src/app/api/import/myah/route.ts`
  - `src/app/api/imaging/route.ts`
  - `src/app/api/labs/scan/route.ts`
  - `src/app/api/food/identify/route.ts`
  - `src/app/api/food/barcode/route.ts`
- **Category:** dos + cost

**Description.** Any caller could post an unbounded body; Apple
Health / universal importers would then churn in-memory. Food-identify
and labs-scan additionally call Claude Vision; an unbounded loop of
requests would drain the Anthropic budget in minutes.

**Fix.**
- Added `src/lib/upload-guard.ts` (`enforceDeclaredSize`,
  `enforceActualSize`, `guardUpload`) + `src/lib/rate-limit.ts`.
- Apple Health / universal: 50 MB cap, 5 req / min / caller.
- mynetdiary / natural-cycles / myah: 25 MB cap, 5 req / min.
- imaging / labs scan / food identify: 15 MB cap (base64 overhead),
  10 req / min (default).
- food barcode: input now strictly numeric 6-32 chars, 60 req / min.

**Regression test.** `src/__tests__/security/upload-guards.test.ts`.

**References.**
- OWASP API Top 10 #4

---

### C-005 — File-upload / import endpoints are unauthenticated

- **Severity:** P0
- **Status:** deferred (Track A dependency)
- **Location:** same list as C-004
- **Category:** auth

**Description.** No session check means any caller can push rows into
Lanae's DB or burn the Anthropic budget. Track C cannot land a clean
fix until Track A ships `requireUser()`; C-004's rate limit and size
caps are the interim mitigation. Cross-track note filed.

**Fix (planned).** Add `await requireUser(req)` at the top of each
POST handler once Track A merges.

**References.** OWASP API Top 10 #1, #2.

---

### C-006 — Outbound third-party fetches had no timeout or size cap

- **Severity:** P2
- **Status:** fixed
- **Location:**
  - `src/lib/oura.ts`
  - `src/lib/weather.ts` (legacy `fetchFromEndpoint` path)
  - `src/lib/integrations/oauth-manager.ts`
- **Category:** ssrf + dos

**Description.** Every outbound call ran with no timeout and no
response-size cap. A hanging upstream (or a hostile redirect target
from a misconfigured proxy) could tie up Vercel function slots.

**Fix.** Introduced `src/lib/safe-fetch.ts` which wraps `fetch` with:
- `AbortController`-backed timeout (default 30 s; Oura and OAuth use
  tighter 20 s; weather 15 s).
- Hard response-size cap (10 MB default; Oura 5 MB; OAuth 128 KB).
- Content-type allowlist (JSON for every call site covered here).
- Error messages never leak request bodies.

Call sites switched from `fetch(...)` to `safeFetch(...)`. The
`fetchDailyWeather` helper accepts a `fetchImpl` injection for tests
and was left untouched.

**Regression test.** `src/__tests__/security/safe-fetch.test.ts`.

**References.**
- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

---

### C-007 — Health-sync errors echoed Supabase messages

- **Severity:** P2
- **Status:** fixed
- **Location:** `src/app/api/health-sync/route.ts`
- **Category:** phi-leak

**Description.** The response body on a DB failure was
`nc_imported 2026-04-18: <supabase msg>`. Dates leak. Fixed alongside
C-002; response is now opaque `write_failed` and context is logged
server-side only.

**Regression test.** Covered by `src/__tests__/security/health-sync.test.ts`.

---

### C-008 — OAuth redirect URI derived from a mutable request origin

- **Severity:** P1
- **Status:** accepted-risk (see `accepted-risks.md` — pending)
- **Location:** `src/app/api/integrations/[integrationId]/authorize/route.ts:26`
- **Category:** oauth

**Description.** `redirectUri` composes from `req.nextUrl.origin`,
which reflects the `Host` / `X-Forwarded-Host` headers. On most
deployments Vercel rewrites these correctly, but if a proxy is ever
misconfigured the header is attacker-controlled. Most OAuth providers
reject unrecognized redirect URIs at the registration layer, so the
blast radius is narrow.

**Fix (planned).** Pin to `process.env.NEXT_PUBLIC_SITE_URL` (or
`VERCEL_URL`) with a localhost fallback. Track D owns the middleware
that can validate `Host` centrally; better to implement there once
the middleware lands.

**References.** https://datatracker.ietf.org/doc/html/rfc6749#section-10.6

---

### C-009 — `/api/push/subscribe` accepts any endpoint + keys

- **Severity:** P2
- **Status:** deferred (Track A dependency)
- **Location:** `src/app/api/push/subscribe/route.ts`
- **Category:** authz

**Description.** Anyone with the endpoint URL could register a
subscription and then receive every push sent to the global
subscriber list. Cross-track note filed.

---

### C-010 — VAPID private key confirmed server-only

- **Severity:** P3
- **Status:** verified
- **Location:** `src/app/api/push/send/route.ts`, `src/app/api/cron/build-status/route.ts`

**Description.** `VAPID_PRIVATE_KEY` is read via `process.env` in
Node-runtime files only; a repo-wide grep confirms no client import.
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` is the only client-exposed VAPID value.
No fix needed.

---

### C-011 — In-memory rate limiter is per-instance

- **Severity:** P3
- **Status:** accepted-risk
- **Location:** `src/lib/rate-limit.ts`

See `accepted-risks.md` (c-013). On Vercel each lambda instance owns
its own Map. Hard ceiling is `limit * concurrent_instances`.
Acceptable for a single-patient app; upgrade to Upstash Redis if we
ever go multi-tenant.

---

### C-012 — CSV formula injection risk on import → export round-trip

- **Severity:** P2
- **Status:** deferred (Track B)
- **Location:** `src/lib/importers/natural-cycles.ts` and any Track B
  export path that echoes imported text.
- **Category:** injection

**Description.** Imported rows can carry cells starting with
`=`, `+`, `-`, `@`. On export to CSV those become Excel formulas.
Cross-track note filed with Track B.
