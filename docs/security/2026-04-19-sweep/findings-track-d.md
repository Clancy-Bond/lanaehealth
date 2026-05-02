# Findings — Track D (Infrastructure / Client / Config / Deps)

Sweep: 2026-04-19. Branch: `claude/security-sweep-session-d-hg6dD`.

## Summary

| Severity | Count | Fixed | Deferred |
|----------|-------|-------|----------|
| P0       | 1     | 1     | 0        |
| P1       | 4     | 4     | 0        |
| P2       | 2     | 1     | 1 (accepted-risk) |
| P3       | 5     | 0     | 5 (logged) |

---

## Findings

### D-001 — `NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN` shipped to the browser bundle

- **Severity:** P0
- **Status:** fixed (client) + cross-track to Track B (server)
- **Location:** `src/app/doctor/care-card/print-actions.tsx:42` (pre-fix)
- **Category:** secrets

**Description.** `print-actions.tsx` was reading `process.env.NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN` and forwarding it as `x-share-admin-token` on POSTs to `/api/share/care-card`. Any value in a `NEXT_PUBLIC_*` env var is inlined into the client bundle by Next.js at build time. So the "admin token" the share-mint endpoint trusted as proof of authorization was readable by anyone who fetched a JS chunk from the production site. The endpoint mints 7-day public share URLs for the Care Card, which contains diagnoses, medications, and active problems.

**Exploit scenario.** An attacker fetches `https://lanaehealth.vercel.app/_next/static/chunks/<id>.js`, greps for `x-share-admin-token`, recovers the token, then POSTs to `/api/share/care-card` to mint share links. Each link returns the patient's full Care Card without further auth.

**Fix.** Removed the `NEXT_PUBLIC_*` reference and the `x-share-admin-token` header from the client. The client now relies on the request's session cookie / middleware auth; the server-side guard should be replaced by `requireUser()` (cross-track to Track B which owns `src/app/api/share/**`). If the leaked token value was ever set in production, **it must be rotated** because it has been part of the public bundle.

**Regression test.** `src/__tests__/no-public-share-admin-token.test.ts` asserts the symbol no longer appears in the executable code of the file (block / line comments stripped first so the historical-context note remains).

**References.**
- OWASP API Top 10 #2 — Broken Authentication
- Next.js docs: env vars with the `NEXT_PUBLIC_` prefix are inlined into the browser bundle.

---

### D-002 — Every API route open to the public internet (no edge auth)

- **Severity:** P1
- **Status:** fixed
- **Location:** every route under `src/app/api/**` prior to this sweep had no auth middleware in front of it.
- **Category:** auth

**Description.** The app shipped with no Next.js middleware. Routes that mutate or read PHI (`/api/symptoms/quick-log`, `/api/cycle/bbt`, `/api/migraine/attacks`, `/api/timeline`, `/api/expenses`, etc.) accepted unauthenticated POSTs from anywhere on the public internet and wrote into Lanae's database via the service-role Supabase client. Same surface allowed PHI reads.

**Exploit scenario.** `curl -X POST https://lanaehealth.vercel.app/api/symptoms/quick-log -H 'content-type: application/json' -d '{"symptom":"x","category":"physical"}'` writes a row into `symptoms` linked to today's `daily_logs`. Any internet host can corrupt the patient's history; the same endpoints leak whatever the GET handler returns.

**Fix.** Shipped `src/middleware.ts` which:
- Maintains an explicit allowlist (`/api/health`, OAuth callbacks, Vercel cron paths gated by Track C's `CRON_SECRET`, the public share viewer, static / PWA assets) and 401s everything else absent a Supabase auth-token cookie or matching `APP_ACCESS_TOKEN` Bearer.
- Returns 404 for scraper-shaped requests so we don't leak path existence to bots.
- Attaches HSTS, CSP (per-request nonce), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, and COOP on every response (including 401s).
- Honors `LANAEHEALTH_AUTH_DISABLED=1` as an explicit transition flag (see `accepted-risks.md`) so the live deployment can ship middleware before Track A's sign-in flow is wired through end-to-end. The bypass attaches an `X-Lanae-Auth-Bypass: 1` header so it is detectable in logs.

Also added per-route `requireUser()` defense-in-depth at every in-scope handler so a misconfigured matcher cannot expose data on its own.

**Regression test.** `src/__tests__/middleware.test.ts` (22 cases) covers allowlist, scraper 404, cookie auth, bearer auth, header attachment on success and on 401, per-request nonce uniqueness, CSP locking down `frame-ancestors`/`object-src`/`base-uri`/`form-action`, and connect-src vendor allowlist. `src/lib/api/__tests__/require-user.test.ts` covers the per-route helper.

**References.**
- OWASP API Top 10 #1 — Broken Object Level Authorization (single-patient variant)
- Internal: `docs/security/2026-04-19-sweep/README.md` threat-model row "Public internet probing of open endpoints".

---

### D-003 — No security headers on any response (HSTS, CSP, XFO, etc.)

- **Severity:** P1
- **Status:** fixed
- **Location:** `next.config.ts` was empty; no `headers()` function, no middleware.
- **Category:** misconfig

**Description.** Production responses carried no `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy`. Any reflected-XSS or third-party-script compromise would have unmitigated reach in the browser; the app could be iframed for clickjacking; HSTS stripping was possible.

**Fix.** Middleware now attaches all six headers to every response. CSP is built per-request with a fresh nonce (`'self' 'nonce-...' 'strict-dynamic'`) so `unsafe-inline` is not needed for scripts. `connect-src` is allowlisted to the exact upstream APIs the app calls (Supabase, Anthropic, OpenAI, Voyage, Oura, Open-Meteo, USDA, Open Food Facts, NCBI). `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. HSTS is `max-age=63072000; includeSubDomains; preload`.

**Regression test.** `src/__tests__/middleware.test.ts` "middleware security headers" suite.

**References.**
- OWASP Secure Headers Project
- Next.js CSP docs (per-request nonce pattern via middleware request header).

---

### D-004 — API error responses leak Postgres / Supabase internals in production

- **Severity:** P1
- **Status:** fixed
- **Location:** 17 route handlers echoed `error.message` from Supabase / Postgres into the JSON response (`src/app/api/{appointments,expenses,labs,log,medication-timeline,medications,micro-care,migraine,orthostatic,prn-doses,timeline}/...`).
- **Category:** misconfig

**Description.** Postgres / PostgREST messages leak column names, constraint names, RLS policy names, and table identifiers. Returning them to the client gives an attacker a free schema map and confirms which queries are possible. Some routes also surfaced raw `err.message` from arbitrary throws, leaking stack-frame hints.

**Fix.** Added `src/lib/api/safe-error.ts` with `safeErrorMessage(err, fallback)` (returns the fallback string in production, the real message in dev) and `safeErrorResponse(err, fallback)` (one-stop response that maps `UnauthorizedError → 401` and everything else to a sanitized 500). Replaced every `error.message` echo across the in-scope routes. Same pattern applied to `src/app/error.tsx` so the user-facing error boundary no longer prints the raw error in prod.

**Regression test.** `src/lib/api/__tests__/safe-error.test.ts` covers both modes plus the `UnauthorizedError → 401` mapping and the case where a non-Error value (`string`, plain object, `undefined`) is thrown.

**References.**
- OWASP API Top 10 #8 — Security Misconfiguration (improper error handling).

---

### D-005 — Per-route `requireUser()` defense-in-depth missing

- **Severity:** P1
- **Status:** fixed (placeholder; Track A's canonical helper to replace)
- **Location:** every in-scope route handler.
- **Category:** auth

**Description.** Even with edge middleware, a per-route auth assertion is the second line of defense if the matcher misconfigures. Without it, any future regression that broadens the allowlist or moves a route under a path the matcher excludes would silently expose PHI.

**Fix.** Created `src/lib/api/require-user.ts` placeholder that re-asserts the same Supabase-auth-cookie / `APP_ACCESS_TOKEN` invariant as the middleware (constant-time bearer compare). Added `await requireUser(req)` at the top of every in-scope handler under a `try/catch` that delegates to `safeErrorResponse(err)` (returns 401 on `UnauthorizedError`). When Track A's canonical `requireUser()` ships at `src/lib/auth/require-user.ts`, the imports should be swapped (cross-track note filed).

**Regression test.** `src/lib/api/__tests__/require-user.test.ts` (8 cases). Existing route tests pass with `LANAEHEALTH_AUTH_DISABLED=1` set in the vitest setup file, which preserves their original semantics while still exercising the new code path.

**References.**
- OWASP — defense in depth.

---

### D-006 — Client bundle secrets grep results

- **Severity:** P0 (potential) → no actual key value leak observed
- **Status:** fixed (`NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN` — see D-001); rest clean
- **Location:** `.next/static/chunks/*.js`
- **Category:** secrets

**Description.** Ran `grep -r SUPABASE_SERVICE_ROLE_KEY .next/static`, `... ANTHROPIC_API_KEY ...`, `eyJ...`, `sk-ant-...`, `sk-...`, `VOYAGE_API_KEY`, `PINECONE_API_KEY`, `VAPID_PRIVATE`, `DATABASE_URL`, `POSTGRES_URL` against the production build output. The only matches were:
1. `SUPABASE_SERVICE_ROLE_KEY` as an unmodified `process.env.X` literal in the unminified `@supabase/auth-js` chunk. The *value* is not inlined (Next.js only inlines `NEXT_PUBLIC_*` env vars), so at runtime in the browser it resolves to `undefined`. No secret leak — but the helper that *uses* this var is bundled with the client because `createServiceClient` lives next to the public `supabase` proxy in `src/lib/supabase.ts`. Defense-in-depth concern; **cross-track to Track A** (owns `src/lib/supabase.ts`) to split the module so service-role code can never be reached from a client component import.
2. `NEXT_PUBLIC_SHARE_TOKEN_ADMIN_TOKEN` — see D-001. Fixed.
3. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — expected, those are public by design (anon key is RLS-bound).
4. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — expected (web-push public key is meant to ship to browsers).

No `eyJ...` JWT, no `sk-ant-...` Anthropic key, no `sk-...` OpenAI key, no Voyage / Pinecone / VAPID-private / Postgres URL appeared in any chunk.

**Fix.** D-001 fixed in this PR. The `createServiceClient` co-bundling concern is filed as a cross-track note for Track A.

**Regression test.** Manual grep recipe documented in this file. A future iteration could add a CI step that fails the build on any of the canonical secret-shaped strings appearing under `.next/static/`.

**References.**
- OWASP API Top 10 #8.

---

### D-007 — `dangerouslySetInnerHTML`, `eval`, `document.write`, `.innerHTML =`

- **Severity:** P3 (clean)
- **Status:** logged
- **Location:** `src/`
- **Category:** xss

**Description.** Greps for `dangerouslySetInnerHTML` and `eval(`, `new Function(`, `document.write`, `.innerHTML =` returned zero matches in `src/`. All three `target="_blank"` anchors (`src/app/intelligence/readiness/page.tsx:259`, `src/components/topics/ResearchCitations.tsx:95`, `src/components/import/MyAHImporter.tsx:539`) carry `rel="noopener noreferrer"`. Dynamic `href={...}` patterns are either internal navigation paths or URLs from controlled sources (citations, integration metadata).

**Fix.** None needed.

**References.** OWASP XSS prevention cheat sheet.

---

### D-008 — `npm audit` baseline

- **Severity:** P2
- **Status:** accepted-risk
- **Location:** transitive dep `dompurify` <= 3.3.3 via `jspdf`.
- **Category:** supply-chain

**Description.** `npm audit --production` returns 1 moderate-severity advisory: `GHSA-39q2-94rc-95cp` against `dompurify` <= 3.3.3 (ADD_TAGS bypasses FORBID_TAGS via short-circuit eval). LanaeHealth pulls dompurify only transitively via `jspdf` for client-side PDF generation of the Doctor Brief / Care Card. Upgrade is not a one-line bump; `jspdf` would need to release a new version pinning a fixed `dompurify`. CVSS score is 0 (no CVSS vector published). Practical exploitability requires attacker-controlled HTML reaching jspdf's HTML rendering path — none of our PDF-generation paths feed user-supplied HTML.

**Fix.** Logged in `accepted-risks.md`. Revisit when `jspdf` ships an updated dependency.

**References.** GHSA-39q2-94rc-95cp.

---

### D-009 — Service worker review

- **Severity:** P3 (clean)
- **Status:** logged
- **Location:** `public/sw.js`
- **Category:** privacy

**Description.** SW caches only `/doctor` HTML on `req.mode === 'navigate'` (stale-while-revalidate). API JSON, fetches, and cross-origin requests pass through. SW scope is the origin (no sub-path hijack). Cache is cleared on activate when `CACHE_NAME` rotates. Push handler accepts JSON or text payload, falls back to a no-PHI default (`'LanaeHealth'` title). Notification click navigates to in-app `/log` only — no open-redirect.

**Caveat.** The `/doctor` page contains active problems, current medications, and red-flag summaries. A cached entry persists offline on the device. Acceptable for the single-patient PWA model (the device belongs to Lanae) but documented here so any future multi-tenant pivot remembers to re-evaluate.

**Fix.** None.

---

### D-010 — Client storage audit

- **Severity:** P3
- **Status:** logged
- **Location:** `src/lib/log/offline-queue.ts`, `src/lib/notifications.ts`, `src/components/log/{BBTRow,HydrationRow,OrthostaticRow,QuickMealLog,MedicationEntry,CheckInReminders}.tsx`
- **Category:** privacy

**Description.** localStorage usage inventory:
- `lanae.offline.queue.v1` — pending writes (kind + payload). Can contain PHI shapes (symptom names, food entries) but no credentials.
- `lanaehealth_med_reminders` — medication reminder schedules (medication name is PHI).
- BBT, hydration, orthostatic per-day pre-submit drafts — PHI metric values.
- Recent meals / medication shortcuts — PHI labels.

No tokens, no API keys, no Supabase session material in localStorage. Supabase auth (when Track A's flow ships) will use httpOnly cookies, not localStorage.

The offline queue is not currently drained on auth change. Single-patient app — irrelevant in the current threat model — but documented here in case the multi-tenant pivot ever happens.

**Fix.** None this sweep.

---

### D-011 — Error page no longer leaks raw error message in production

- **Severity:** P2
- **Status:** fixed
- **Location:** `src/app/error.tsx`
- **Category:** misconfig

**Description.** The Next.js error boundary rendered `{error.message || "An unexpected error occurred."}` in production, surfacing Supabase / Postgres / framework messages directly to the user.

**Fix.** Conditioned on `process.env.NODE_ENV !== 'production'`. Production users see the generic copy; dev keeps the underlying message for debugging.

**Regression test.** Implicit via `safe-error.test.ts` (same redaction pattern); a richer end-to-end test would require Playwright which is out of scope.

---

### D-012 — `.gitignore` coverage

- **Severity:** P3 (clean)
- **Status:** logged
- **Location:** `.gitignore`
- **Category:** misconfig

**Description.** `.gitignore` already covers `.env*`, `.vercel`, `.next/`, `*.tsbuildinfo`, `coverage/`, `tmp_*` patterns. No `tmp_*.mjs` / `tmp_*.ts` / `tmp_*.js` files remain in the repo. No `.env*` files are tracked. Added explicit `.env.local`, `.env.development`, `.env.production` lines for clarity (some tooling matches the wildcard differently).

**Fix.** None functionally; one cosmetic addition.

---

### D-013 — Generic CRUD route hardening matrix

| Route                                          | Auth | Validation | Error-safe | Notes |
|------------------------------------------------|------|------------|------------|-------|
| /api/appointments/[id] (PATCH)                | yes  | manual     | yes        | requireUser + safeErrorMessage |
| /api/calories/custom-foods (POST)             | yes  | manual     | yes        | |
| /api/calories/custom-foods/log (POST)         | yes  | manual     | yes        | |
| /api/calories/favorites/toggle (POST)         | yes  | manual     | yes        | |
| /api/calories/plan (POST)                     | yes  | manual     | yes        | |
| /api/calories/recipes (POST)                  | yes  | manual     | yes        | |
| /api/cycle/bbt (POST)                         | yes  | manual     | yes        | |
| /api/cycle/hormones (POST)                    | yes  | manual     | yes        | |
| /api/expenses (GET, POST)                     | yes  | manual     | yes        | |
| /api/expenses/[id] (PATCH, DELETE)            | yes  | whitelist  | yes        | |
| /api/favorites (GET, PUT)                     | yes  | manual     | yes        | |
| /api/food/log (POST)                          | yes  | manual     | yes        | |
| /api/food/search (GET)                        | yes  | manual     | yes        | |
| /api/labs (POST)                              | yes  | manual     | yes        | batch + single |
| /api/log/prefill (GET)                        | yes  | n/a        | yes        | |
| /api/medication-timeline (POST)               | yes  | manual     | yes        | |
| /api/medications/adherence (GET)              | yes  | manual     | yes        | |
| /api/medications/today (GET)                  | yes  | n/a        | yes        | |
| /api/micro-care (GET, POST)                   | yes  | manual     | yes        | |
| /api/migraine/attacks (POST)                  | yes  | manual     | yes        | |
| /api/orthostatic (GET, POST)                  | yes  | manual     | yes        | |
| /api/orthostatic/tests (POST)                 | yes  | manual     | yes        | |
| /api/prn-doses/open (GET)                     | yes  | manual     | yes        | |
| /api/prn-doses/record (POST)                  | yes  | manual     | yes        | |
| /api/prn-doses/respond (POST)                 | yes  | manual     | yes        | |
| /api/search (GET)                             | yes  | manual     | yes        | ilike escapes wildcards |
| /api/symptoms/quick-log (POST)                | yes  | manual     | yes        | |
| /api/timeline (GET, POST)                     | yes  | manual     | yes        | |
| /api/water/log (POST)                         | yes  | manual     | yes        | |
| /api/weight/log (POST)                        | yes  | manual     | yes        | |

`zod` is not used in this sweep. Every in-scope route already has bounded manual validation. Migrating to `zod` is a P3 hardening follow-up, not a security defect.

---

## What I did NOT fix (deferred / out of scope)

- `src/app/api/share/care-card/route.ts` (server-side admin-token gate) — owned by Track B (`src/app/api/share/**`). Cross-track note filed.
- `src/lib/supabase.ts` co-bundling of `createServiceClient` with the client-facing `supabase` proxy — owned by Track A. Cross-track note filed.
- `src/app/api/admin/peek` and `src/app/api/admin/apply-migration-*` — owned by Track A (admin endpoints). Out of my scope.
- Migrating route validation to `zod` — P3 follow-up.
- A real Supabase Auth sign-in flow — owned by Track A.
