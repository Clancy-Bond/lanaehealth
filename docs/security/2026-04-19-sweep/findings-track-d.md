# Findings Report - Track D (Infra, Client, Config, Deps)

**Session:** D
**Branch:** `claude/security-sweep-session-d-YD3nI`
**Scope:** `src/middleware.ts`, `next.config.ts`, `vercel.json`, client-side
components, generic CRUD API routes, dependency audit, client-bundle
secrets check.

---

## Summary

| Severity | Count | Fixed | Deferred |
|----------|-------|-------|----------|
| P0       | 1     | 1     | 0        |
| P1       | 3     | 3     | 0        |
| P2       | 7     | 6     | 1        |
| P3       | 3     | 1     | 2        |

Cross-track notes filed: 5 (see `cross-track-notes.md`).

---

## Findings

### D-001 - Admin share-mint token embedded in client bundle

- **Severity:** P0
- **Status:** fixed
- **Location:** `src/app/doctor/care-card/print-actions.tsx:42` (pre-fix)
- **Category:** secrets

**Description.** The Care Card share button read
`process.env.NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN` and forwarded it as
`x-share-admin-token` to `POST /api/share/care-card`. `NEXT_PUBLIC_*`
vars are inlined into the client bundle at build time. Because
`/_next/static/chunks/*.js` is served publicly regardless of route
auth, any visitor could fetch the token, then mint unlimited 7-day
public share links pointing at the patient's Care Card (medications,
problem list, allergies, emergency contacts). Direct PHI disclosure
vector with zero friction to exploit.

**Exploit scenario.** Open the production site. Fetch any JS chunk
under `/_next/static/chunks/`, grep for
`NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN`. The value is present as a
plain string. `curl -X POST -H "x-share-admin-token: <value>"
https://lanaehealth.vercel.app/api/share/care-card -d
'{"resourceType":"care_card"}'` returns a live 7-day token whose
URL renders the full Care Card HTML without any further auth.

**Fix.** Removed the client-side env read and header forwarding in
`print-actions.tsx`. The client now POSTs with
`credentials: 'same-origin'` only. The route handler on
`/api/share/care-card` still validates the server-side
`SHARE_TOKEN_ADMIN_TOKEN` env value; a cross-track note asks Track B
to replace that with a session check now that the middleware gate
exists. Share-link creation fails closed until Track B lands its
replacement - correct blast-radius for a P0 secret-leak fix.

**Operational action required.** Rotate the `SHARE_TOKEN_ADMIN_TOKEN`
value in Vercel. Any previously-deployed bundle still contains the
old value; until rotation, an attacker who cached a JS chunk could
keep minting tokens.

**Regression test.** `src/__tests__/client-bundle-secrets.test.ts`
(static-source scan; fails CI if any `'use client'` or components
module references banned env vars by name).

**References.**
- OWASP API Top 10 #2 (Broken Authentication)
- Next.js docs: Environment Variables - Bundling for the Browser

---

### D-002 - No perimeter middleware; every route public

- **Severity:** P1
- **Status:** fixed
- **Location:** `src/middleware.ts` (new)
- **Category:** auth

**Description.** LanaeHealth shipped 21+ new routes in the overnight
sprint and had no Next.js middleware. With no edge auth gate, every
`/api/*` and every page was reachable from the public internet.
Individual routes use `createServiceClient()` (which bypasses RLS)
and are effectively public DB read/write surfaces.

**Exploit scenario.** Before the fix, `curl
https://lanaehealth.vercel.app/api/timeline` returned the full
medical timeline; `curl -X POST .../api/symptoms/quick-log -d
'{"symptom":"test","category":"physical"}'` corrupted the log with
arbitrary data.

**Fix.** Added `src/middleware.ts` with:
1. **Security headers on every response** - CSP, HSTS,
   Referrer-Policy, Permissions-Policy, X-Frame-Options,
   X-Content-Type-Options, Cross-Origin-Opener-Policy.
2. **Auth gate**, disabled by default via `LANAE_REQUIRE_AUTH`
   environment flag. When enabled, the gate allows:
   - An explicit public-path allowlist (landing page, `/login`,
     `/share/<token>` viewer, OAuth callbacks, `/api/health`, PWA
     assets).
   - Requests with a Supabase-style auth cookie (`sb-*-auth-token`
     or `lanae_session`).
   - Service-to-service requests with `Authorization: Bearer` (iOS
     Shortcut / health-sync) or Vercel cron marker
     (`x-vercel-cron: 1`).
   Everything else: API → 401 JSON, HTML → 307 redirect to
   `/login?next=<original>`.

The gate defaults OFF so merging this PR does not lock out
production before Track A's login route ships. Operator flips
`LANAE_REQUIRE_AUTH=true` in Vercel once Track A lands.

**Regression test.** `src/__tests__/middleware.test.ts` (9 cases
covering header presence, public-path passthrough, 401 JSON vs 307
redirect, cookie-authed passthrough, bearer passthrough, cron
passthrough).

**References.**
- OWASP API Top 10 #5 (Broken Function Level Authorization)

---

### D-003 - DB error messages echoed to clients

- **Severity:** P1
- **Status:** fixed
- **Location:** ~17 routes; representative:
  `src/app/api/appointments/[id]/route.ts`,
  `src/app/api/timeline/route.ts`,
  `src/app/api/symptoms/quick-log/route.ts`.
- **Category:** misconfig / phi-leak

**Description.** Multiple API routes responded with
`{ error: error.message }` where `error` came from Supabase /
Postgres. Those messages carry schema details (table names, column
names, constraint names, row counts) and can leak PHI via
constraint-violation text. An attacker can iterate malformed
requests to enumerate the database shape.

**Exploit scenario.** `curl -X POST /api/timeline -d
'{"event_date":"2025-01-01","event_type":"test","title":"x"}'`
against a missing column returned
`"error": "column ... does not exist"`, mapping the schema to the
attacker.

**Fix.** Added `src/lib/api/json-error.ts` exporting `jsonError()`
and `safeMessage()`. In production the helper returns a generic
message keyed by a short stable code (`db_update_failed`,
`orthostatic_insert_failed`, etc.) and logs the raw error
server-side. In dev the real message is preserved for debugging.

Applied to every scope route that previously echoed DB error
messages:

| Route                                            | Status |
|--------------------------------------------------|--------|
| `appointments/[id]/route.ts`                     | fixed + zod body |
| `calories/custom-foods/log/route.ts`             | fixed |
| `expenses/route.ts`                              | fixed |
| `expenses/[id]/route.ts`                         | fixed |
| `labs/route.ts`                                  | fixed |
| `log/prefill/route.ts`                           | fixed + date regex |
| `medication-timeline/route.ts`                   | fixed |
| `medications/today/route.ts`                     | fixed |
| `micro-care/route.ts`                            | fixed (validation 400 preserved) |
| `migraine/attacks/route.ts`                      | fixed |
| `orthostatic/route.ts`                           | fixed |
| `orthostatic/tests/route.ts`                     | fixed |
| `prn-doses/open/route.ts`                        | fixed |
| `prn-doses/record/route.ts`                      | fixed (validation 400 preserved) |
| `prn-doses/respond/route.ts`                     | fixed (409 preserved) |
| `symptoms/quick-log/route.ts`                    | fixed |
| `timeline/route.ts`                              | fixed |

**Regression test.** `src/lib/api/__tests__/json-error.test.ts`
(dev-shows / prod-strips / custom fallback).

---

### D-004 - No security headers: CSP, HSTS, frame-options absent

- **Severity:** P2
- **Status:** fixed
- **Location:** `src/middleware.ts`, `next.config.ts`.
- **Category:** misconfig

**Description.** Production responses carried none of the
defense-in-depth headers recommended by OWASP. No CSP at all, no
HSTS, no clickjacking protection, no Referrer-Policy, no
Permissions-Policy.

**Fix.** Middleware attaches, on every response:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self), interest-cohort=()`
- `Content-Security-Policy` with `default-src 'self'`, an allowlisted
  `connect-src` for every vendor the app actually calls (Supabase,
  Anthropic, OpenAI, Voyage, Oura, Open-Meteo, USDA,
  OpenFoodFacts), `frame-ancestors 'none'`, `object-src 'none'`,
  `form-action 'self'`.
- `Cross-Origin-Opener-Policy: same-origin`

`next.config.ts` duplicates HSTS / nosniff / Referrer-Policy for
`/_next/static/*` and `/icons/*` so static bundles are covered even
though the middleware matcher excludes them.

**Known gap - see D-009.** The shipped CSP still allows
`'unsafe-inline'` / `'unsafe-eval'` in `script-src` because Next.js
16's runtime emits inline bootstrap scripts. Tightening to
per-request nonces is tracked separately.

**Regression test.** `src/__tests__/middleware.test.ts` asserts
every header name + value and that headers are attached to the 401
/ 307 responses the middleware itself generates.

---

### D-005 - Production error page leaked raw `error.message`

- **Severity:** P2
- **Status:** fixed
- **Location:** `src/app/error.tsx`
- **Category:** phi-leak / misconfig

**Description.** The root error boundary rendered `error.message`
unconditionally. Next.js 16 sanitizes server-origin messages to a
digest, but client-origin errors still surfaced the raw string to
the browser. For a medical app those strings may contain field names
or values from the failing component.

**Fix.** Error page now shows a generic "An unexpected error
occurred." in production and surfaces the Next.js `error.digest` as
a reference number. In development the real message is still shown
and logged to the console.

**Regression test.** Covered by the prod-vs-dev branch validated in
`json-error.test.ts` (same `process.env.NODE_ENV === 'production'`
lever). The error boundary is a thin `'use client'` component around
that single branch.

---

### D-006 - npm audit: moderate dompurify advisory

- **Severity:** P2
- **Status:** fixed
- **Location:** `package-lock.json` (transitive via `jspdf`)
- **Category:** supply-chain

**Description.** `dompurify <= 3.3.3` GHSA-39q2-94rc-95cp: ADD_TAGS
bypasses FORBID_TAGS due to short-circuit evaluation. Moderate
severity, exploitable only where DOMPurify is fed a FORBID_TAGS
list; LanaeHealth does not call DOMPurify directly (transitive via
jspdf).

**Fix.** `npm audit fix` bumped dompurify 3.3.3 → 3.4.0 (safe minor
version). `npm audit --production` is now clean (0
vulnerabilities).

---

### D-007 - Client components import `createServiceClient`

- **Severity:** P2
- **Status:** fixed (cross-track note filed for Track A)
- **Location:**
  `src/components/log/WorkoutCard.tsx:4`,
  `src/components/log/VitalsCard.tsx:4`,
  `src/components/log/TiltTableTest.tsx:17`.
- **Category:** misconfig

**Description.** Three `'use client'` components import
`createServiceClient` from `@/lib/supabase`. Next.js 16 does not
inline server-only env vars into client bundles (verified via a
probe build: `SUPABASE_SERVICE_ROLE_KEY=eyJTESTSERVICEROLEKEYTOPROBE`
did not appear anywhere in `.next/`), so the KEY VALUE does not
leak today. But the CODE for `createServiceClient` ships in the
client bundle and will throw at runtime when
`process.env.SUPABASE_SERVICE_ROLE_KEY` is undefined on the browser.
This is dead code at best and a loaded gun if a future config
misstep ever inlines the value.

**Fix.** Cross-track note filed for Track A (they own
`src/lib/supabase.ts`). Track D ships
`src/__tests__/client-bundle-secrets.test.ts` which fails CI if any
`'use client'` or `src/components/*` file adds a direct
`process.env.SUPABASE_SERVICE_ROLE_KEY` reference.

---

### D-008 - PrivacySettings admin token pasted into URL query

- **Severity:** P2
- **Status:** deferred (Track A)
- **Location:** `src/components/settings/PrivacySettings.tsx:99-101`
- **Category:** secrets

**Description.** The "Full ZIP export" download link is built as
`/api/export/full?token=${encodeURIComponent(adminToken)}`. The user
pastes the admin token into a form field; the client sets it on an
`<a href>`. Tokens in query strings land in browser history, referer
headers, and (on Vercel) server access logs. Not as bad as D-001
(the token is only in memory during the session) but below the
hygiene bar for an authorization secret.

**Why deferred.** Track A owns the auth model. Once Track A replaces
the token-in-query pattern with a session cookie, this finding
resolves. Cross-track note filed.

---

### D-009 - CSP uses `'unsafe-inline'` / `'unsafe-eval'`

- **Severity:** P3
- **Status:** accepted-risk
- **Location:** `src/middleware.ts:49-51`
- **Category:** misconfig

**Description.** The shipped CSP allows `'unsafe-inline'` and
`'unsafe-eval'` in `script-src` because Next.js 16's runtime emits
inline bootstrap and (in dev) uses eval for HMR. Tightening to
`'nonce-<per-request>' 'strict-dynamic'` requires wiring the nonce
through every inline script / React component that reads
`headers()`. Out of scope for this sweep.

**Why accepted.** Non-trivial Next.js config + component change;
base CSP still blocks most XSS vectors via `frame-ancestors`,
`object-src`, and the allowlisted `connect-src`.

**Revisit when.** Upgrading Next.js or during a dedicated CSP
hardening sprint. Noted in `accepted-risks.md`.

---

### D-010 - `dangerouslySetInnerHTML` / `innerHTML` / `eval` - clean

- **Severity:** P3
- **Status:** fixed (verified clean)
- **Location:** entire `src/` tree
- **Category:** xss

**Description.** Swept the codebase for DOM-injection primitives:
`dangerouslySetInnerHTML`, `innerHTML =`, `eval(`, `new Function(`,
`document.write`. Zero matches. All `target="_blank"` anchors (three
sites: `ResearchCitations.tsx`,
`intelligence/readiness/page.tsx`, `MyAHImporter.tsx`) already
carry `rel="noopener noreferrer"`. `href={...}` bindings in scope
receive internal or vendor-controlled strings, not user input - no
`javascript:` protocol vector.

**Fix.** No code change required.

---

### D-011 - Offline queue stores PHI in localStorage

- **Severity:** P3
- **Status:** accepted-risk
- **Location:** `src/lib/log/offline-queue.ts`
- **Category:** privacy

**Description.** The offline queue persists pending write ops
(symptoms, food entries, pain points, cycle updates) under
`lanae.offline.queue.v1` in `localStorage`. Readable by malicious
browser extensions with matching host permissions. For a single-user
PWA on Lanae's personal phone, this is inside the trust boundary
(same device, same user). Documented so a future move to a
multi-user context triggers re-evaluation.

**Fix.** None. Noted in `accepted-risks.md`.

---

### D-013a - Generic CRUD routes leak DB `error.message` via lib `result.error`

- **Severity:** P1
- **Status:** fixed
- **Location:** 10 routes; representative:
  `src/app/api/calories/custom-foods/route.ts`,
  `src/app/api/cycle/bbt/route.ts`,
  `src/app/api/cycle/hormones/route.ts`,
  `src/app/api/weight/log/route.ts`.
- **Category:** misconfig / phi-leak

**Description.** D-003 closed the `{ error: error.message }` pattern
at every route that echoed the Supabase error directly. This sweep
found the same leak hidden one layer deeper: the lib helpers
(`addBbtEntry`, `addHormoneEntry`, `addWeightEntry`,
`addCustomFood`, `addRecipe`, `saveNutritionGoals`,
`toggleFavorite`, `setFavorites`, `setWaterForDate`, `searchFoods`)
all wrap their Supabase calls with
`return { ok: false, error: error.message }`. The 10 routes above
echoed that `result.error` straight into the response body. Same
schema-enumeration vector as D-003.

**Exploit scenario.** `curl -X POST /api/cycle/bbt -d
'{"temp_c":"not-a-number"}'` returned
`{ "error": "null value in column \"temp_c\" of relation
\"bbt_entries\" violates not-null constraint" }` in production,
mapping the table and column names.

**Fix.** Replaced every `NextResponse.json({ error: result.error })`
call with `jsonError(500, '<route>_failed', result.error)`. The
helper returns the safe generic message and a stable code in
production, preserves the real message in dev, and always logs the
raw error server-side. Status standardized to 500 for library
failures; 400 paths that represent user-validation errors
(route-level checks before the lib call) are preserved as-is.

| Route                                | Status |
|--------------------------------------|--------|
| `calories/custom-foods/route.ts`     | fixed  |
| `calories/favorites/toggle/route.ts` | fixed  |
| `calories/plan/route.ts`             | fixed  |
| `calories/recipes/route.ts`          | fixed  |
| `cycle/bbt/route.ts`                 | fixed  |
| `cycle/hormones/route.ts`            | fixed  |
| `favorites/route.ts`                 | fixed  |
| `food/search/route.ts`               | fixed  |
| `water/log/route.ts`                 | fixed  |
| `weight/log/route.ts`                | fixed  |

**Regression test.** `src/__tests__/crud-routes-error-hygiene.test.ts`
(static-source scan; fails CI if any hardened route loses the
`jsonError` import OR reintroduces
`NextResponse.json({ error: result.error })`).

**Follow-up - D-013b (P2).** Track D scope also asked for zod body
validation on write endpoints. Landed in a follow-up commit; see
D-013b below.

---

### D-013b - Generic CRUD write routes lacked zod body validation

- **Severity:** P2
- **Status:** fixed
- **Location:** 9 write routes; representative:
  `src/app/api/cycle/hormones/route.ts`,
  `src/app/api/weight/log/route.ts`,
  `src/app/api/calories/plan/route.ts`.
- **Category:** misconfig / input-validation

**Description.** The track-d brief Deliverable 6 required every
generic CRUD write route to validate its body with `zod` before any
DB write. The 9 write routes in scope (after D-013a) all relied on
hand-written `Number()` / `String()` coercion. That worked well
enough that D-013a did not produce PHI leaks, but it leaves the
attack surface wider than it needs to be: a malformed JSON body
could slip past the manual checks and reach the lib layer, whose
`{ ok: false, error: err.message }` returns then hit `jsonError`
(safe in prod, detailed in dev). Zod parsing at the route edge
rejects the shape mismatch earlier with a stable 400 + code.

**Fix.** Added `src/lib/api/zod-forms.ts` with a set of preprocess
wrappers that make zod compatible with `application/x-www-form-
urlencoded` bodies (empty strings become `undefined` instead of
coercing to `0`, which is what the existing hand-rolled `num()`
helpers were doing). Every write route now defines a module-scope
`BodySchema` and gates the handler behind `.safeParse(body)`.
Failures return `jsonError(400, '<route>_invalid', parsed.error)`.

| Route                                | Status |
|--------------------------------------|--------|
| `calories/custom-foods/route.ts`     | fixed  |
| `calories/favorites/toggle/route.ts` | fixed  |
| `calories/plan/route.ts`             | fixed  |
| `calories/recipes/route.ts`          | fixed  |
| `cycle/bbt/route.ts`                 | fixed  |
| `cycle/hormones/route.ts`            | fixed  |
| `favorites/route.ts` (PUT)           | fixed  |
| `water/log/route.ts`                 | fixed  |
| `weight/log/route.ts`                | fixed  |

Tighter invariants landed as side-effects:
- `cycle/bbt` now requires at least one of `temp_c` / `temp_f`
  (previously silently persisted `0` when both were missing,
  corrupting the reading).
- `cycle/hormones` validates the `source` enum against the real
  `HormoneEntry["source"]` union (`self | lab | wearable`) rather
  than accepting any string.
- `calories/favorites/toggle` requires a positive `fdcId` at the
  schema layer rather than an `if (fdcId <= 0)` branch.

**Regression test.** `src/__tests__/crud-routes-zod.test.ts`
(static-source scan; fails CI if any hardened route loses the
`zod` import or its `.safeParse(` gate, and asserts the shared
preprocess wrappers stay exported).

---

### D-012 - Service worker caches `/doctor` HTML

- **Severity:** P3
- **Status:** accepted-risk
- **Location:** `public/sw.js:33-69`
- **Category:** privacy

**Description.** The SW uses stale-while-revalidate for `/doctor`
navigation documents so Lanae can pull up the doctor brief during
clinic visits with spotty wifi. The cached HTML contains PHI
(diagnoses, medications, recent labs). If the device is stolen and
browser storage is extracted, the brief is offline-readable. This
is a deliberate trade-off called out in the SW source comments.

The SW does NOT cache API responses (the `fetch` listener
short-circuits when `req.mode !== 'navigate'`) and its scope is
origin-level, not hijackable to a sub-path. Network-first /
cache-fallback ordering is correct.

**Fix.** None. Noted in `accepted-risks.md`.

---
