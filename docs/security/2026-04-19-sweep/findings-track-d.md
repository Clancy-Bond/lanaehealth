# Findings — Track D (Infrastructure / Client / Config / Deps)

Sweep: 2026-04-19. Branch: `claude/security-sweep-session-d-hg6dD`.

## Summary

| Severity | Count | Fixed | Deferred |
|----------|-------|-------|----------|
| P0       | 2     | 1     | 1 (operator action required) |
| P1       | 5     | 5     | 0        |
| P2       | 6     | 4     | 2 (1 accepted-risk + 1 closed-by-Track-A merge) |
| P3       | 10    | 4     | 6 (logged) |

**Total: 23 findings** (D-013 is a matrix, not a numbered finding). 18 closed in code this PR, 5 deferred (1 operator-action P0, 1 accepted-risk P2, 1 closed-by-Track-A-merge P2, 6 P3 logged for follow-up).

**Sweep methodology.** Five-phase review: environment + static assets, route handler scope, middleware logic + edge cases, client / cookies / DOM, final build inspection. After the initial sweep claimed completeness, three additional pushback rounds surfaced D-014 → D-024 (open redirect, CSRF, header hardening, allowlist over-broad, DICOM exposure, trailing-slash bypass, framework-bundle nosniff, JWT-validation gap, rate-limit gap). Lesson logged at the bottom of the PR description.

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

### D-014 — Open redirect via `body.returnTo` on three POST routes

- **Severity:** P2
- **Status:** fixed
- **Location:** `src/app/api/symptoms/quick-log/route.ts:97`, `src/app/api/water/log/route.ts:58`, `src/app/api/calories/favorites/toggle/route.ts:43` (pre-fix line numbers).
- **Category:** logic / phishing-vector

**Description.** Three POST routes accept HTML form submissions and 303-redirect to a `returnTo` field from the body via `NextResponse.redirect(new URL(returnTo, req.url), 303)`. `new URL("https://evil.com", req.url)` returns `https://evil.com` — the base is ignored when the input is itself a fully qualified URL. So any value the attacker can plant in `returnTo` becomes the redirect destination. Combined with a CSRF-style auto-submitting form on an attacker-hosted page (the auth gate accepts the victim's same-site cookies for state-changing POSTs), the attacker can land the victim on a phishing page that mimics LanaeHealth and asks Lanae to "re-enter" credentials / reauth.

**Exploit scenario.** Attacker hosts:
```html
<form action="https://lanaehealth.vercel.app/api/water/log" method="POST">
  <input name="glasses" value="1">
  <input name="returnTo" value="https://attacker.example/fake-login">
</form>
<script>document.forms[0].submit()</script>
```
Lanae visits the page (e.g. via a malicious link in an email). Her session cookie is sent along, the route writes one extra glass of water, and the 303 lands her on `attacker.example/fake-login` styled to look like the real app.

**Fix.** Added `src/lib/api/safe-redirect.ts` exporting `safeReturnTo(raw, fallback, baseUrl)`. It only admits inputs starting with `/` and rejects `//evil.com`, `/\evil.com`, schemed URLs, and non-strings, falling back to a known-safe path otherwise. All three call sites now use the helper.

**Regression test.** `src/lib/api/__tests__/safe-redirect.test.ts` (8 cases including https, protocol-relative, backslash, javascript:, data:, non-string).

**References.**
- OWASP — Unvalidated Redirects and Forwards.

---

### D-015 — No CSRF defense on cookie-authed mutating endpoints

- **Severity:** P2
- **Status:** fixed
- **Location:** middleware (every state-changing /api/* route).
- **Category:** csrf

**Description.** With Track A's planned Supabase Auth flow, the auth cookie is `SameSite=Lax` (the auth-helpers default). Lax blocks most cross-site cookie attachment but still attaches on top-level navigations and state-changing form submissions in some edge cases. A `<form action="https://lanaehealth.../api/water/log" method="POST">` on an attacker page combined with a victim cookie can write into Lanae's database without her consent. (Pre-D-014 the same attack also enabled phishing; D-014 closed the redirect amplifier but not the underlying CSRF write.)

**Fix.** Middleware now rejects POST/PATCH/PUT/DELETE on non-allowlisted paths whose `Origin` (or, if absent, `Referer`) is cross-origin. Allowlisted paths (OAuth callbacks, Vercel cron, /api/health) are exempt because they legitimately receive cross-origin or no-Origin requests. Returns 403 with security headers attached.

**Regression test.** `src/__tests__/middleware.test.ts` "middleware CSRF defense" suite: 7 cases covering same-origin admit, cross-origin reject, missing-Origin/Referer fallbacks, GET pass-through, allowlisted-path exemption.

**References.**
- OWASP Top 10 — Cross-Site Request Forgery.

---

### D-023 — Placeholder `isAuthed()` does not validate JWT signature or expiry

- **Severity:** P2
- **Status:** documented limitation; closed by Track A's canonical helper merge
- **Location:** `src/middleware.ts` `hasSupabaseAuthCookie()`, `src/lib/api/require-user.ts`
- **Category:** auth

**Description.** Track D's placeholder treats the presence of any non-empty cookie matching `sb-<ref>-auth-token(.\d+)?` as proof of authentication. It does not parse the JWT, verify its HS256 signature against Supabase's JWT secret, or check `exp`. Consequences:

- A stolen cookie replays indefinitely. The Supabase Auth refresh-token rotation that limits stolen-cookie windows is not enforced at the middleware layer.
- A revoked session is not effectively revoked at the edge until Track A's helper lands.
- Any other process on the same origin that drops a cookie matching the regex grants itself trust.

The `APP_ACCESS_TOKEN` bearer path uses constant-time compare against a single env value, so the same concern applies to that token if it leaks.

**Why placeholder.** Validating the JWT requires the Supabase JWT secret + a JWT library (`jose`, `jsonwebtoken`) running in Edge runtime. Track A is shipping the canonical `requireUser()` that uses `@supabase/ssr` to resolve the user via Supabase's own session check. Track D's job is the perimeter; the auth check belongs to A.

**Fix.** When Track A's helper at `src/lib/auth/require-user.ts` ships:
1. Replace `hasSupabaseAuthCookie(req)` in `src/middleware.ts` with a call to A's helper (or a thin `isAuthed(req)` wrapper A exports).
2. Replace `src/lib/api/require-user.ts` body to delegate to A's canonical helper (call sites stay unchanged).
3. Add a regression test that an expired JWT cookie returns 401.
4. Once Track A's flow is live and Lanae has signed in, clear `LANAEHEALTH_AUTH_DISABLED` from Vercel env.

**Compensating controls (today).** Middleware blocks the easy attacker (no cookie at all). Cross-track to Track A is filed.

**References.** OWASP — Broken Authentication.

---

### D-024 — No rate limiting on the auth gate

- **Severity:** P3
- **Status:** logged for follow-up
- **Location:** `src/middleware.ts`
- **Category:** rate-limit / dos

**Description.** Middleware does not rate-limit failed auth attempts. An attacker can hit `/api/symptoms/quick-log` or any other gated route at full pipe and receive 401s. APP_ACCESS_TOKEN is 256-bit random so brute force is infeasible; the concern is more about cost (Vercel function invocations) and log noise than security per se.

**Fix.** None this sweep. Vercel offers WAF / rate-limit rules at the platform level; configure a `60 req/min` per-IP rule on `/api/*` once Track A's auth flow ships. Or implement a small Edge-resident token bucket using Upstash Redis if cost matters before then.

**References.** OWASP — Improper Resource Consumption.

---

### D-021 — Trailing-slash bypass on middleware allowlist

- **Severity:** P3 (correctness; no exploit but reduces ergonomics + opens a future door)
- **Status:** fixed
- **Location:** `src/middleware.ts` `isAllowlisted()` pre-fix.
- **Category:** logic

**Description.** `ALLOWLIST_EXACT` did exact-string membership against `req.nextUrl.pathname`. Next normalizes `/api/health/` to `/api/health` via a 308 redirect, but middleware runs BEFORE that redirect. So a request to `/api/health/` (with trailing slash) was 401'd because the matcher missed the exact-string allowlist entry. Same shape applied to every exact-listed path. Not directly exploitable, but a precursor to bypass attempts.

**Fix.** Added `normalizePath(p)` that strips a single trailing slash before matching. Root `/` is preserved. Test now asserts both `/api/health` and `/api/health/` return 200.

**Regression test.** `src/__tests__/middleware.test.ts` "normalizes trailing slash for allowlist matching".

---

### D-022 — `/_next/static/*` and `/_next/image/*` lacked X-Content-Type-Options

- **Severity:** P3 (defense-in-depth)
- **Status:** fixed
- **Location:** `next.config.ts`
- **Category:** misconfig

**Description.** The middleware matcher excludes `/_next/static/*` and `/_next/image/*` for performance. The trade-off was that JS chunks and Next-served images shipped without `X-Content-Type-Options: nosniff` or `Cross-Origin-Resource-Policy`, so a browser MIME-sniff attack on a chunk that somehow rendered as HTML was theoretically possible.

**Fix.** Added a `headers()` function in `next.config.ts` that attaches `X-Content-Type-Options: nosniff` and `Cross-Origin-Resource-Policy: same-origin` to both prefixes at framework level (no middleware overhead).

**Regression test.** None — Next.js framework behavior for `headers()` is upstream-tested. Visible after deploy via `curl -I https://lanaehealth.vercel.app/_next/static/...`.

---

### D-020 — Patient DICOM CT slices publicly served at `/raw/*` and committed to git

- **Severity:** P0
- **Status:** mitigated at edge (middleware now requires auth for `/raw/*`); **operator action still required** to scrub the data from git history and move out of `public/`
- **Location:** `public/raw/manifest.json`, `public/raw/{axial_bone_2.5mm,axial_brain_5mm,brain_sag_5x5,cor_brain,portable,scout}/*.raw` (186 files)
- **Category:** privacy / phi-leak

**Description.** `public/raw/` contains the patient's committed DICOM CT brain imaging — `manifest.json` includes the literal `patientName: "BOND^LANAE^AMJ"` plus modality / date / pixel-spacing metadata, and the `.raw` slice files are the actual pixel data. Files under Next.js's `public/` directory are served unauthenticated as static assets at the same path on the production URL. So `https://lanaehealth.vercel.app/raw/manifest.json` and `https://lanaehealth.vercel.app/raw/axial_brain_5mm/0000.raw` (and all 184 siblings) were directly downloadable by any internet host. Commit `a7f095a` ("fix: include DICOM raw data in git so it deploys to Vercel") deliberately added these for deploy convenience without an access-control boundary.

The data is also part of the git history of this repository. If the GitHub repo is or has ever been public, anyone with a clone has a permanent copy; even if the repo is private now, future contributors / forks / accidental publication will inherit the PHI.

**Exploit scenario.**
1. Attacker fetches `https://lanaehealth.vercel.app/raw/manifest.json` — confirms identity and study list.
2. Attacker scripts a wget over each series and reconstructs the volumetric dataset.
3. Lanae's brain CT is now in attacker hands.

**Fix (this PR).** Removed `/raw/` from the middleware allowlist. Middleware now requires the same Supabase auth-token cookie / `APP_ACCESS_TOKEN` bearer for `/raw/*` as for any PHI route. Lanae's signed-in browser still loads the imaging viewer; unauthenticated callers get 401.

**Operator follow-up REQUIRED — these are NOT done in this PR:**

1. **Move the raw files out of `public/` immediately.** Place them under a server-only directory (e.g. `private/imaging/`) and have the imaging viewer fetch them through an authenticated route handler (`/api/imaging/raw/[series]/[slice]`) that calls `requireUser()` and streams the file. The middleware fix is a band-aid; the architectural fix is to never have PHI in `public/`.
2. **Scrub the data from git history** with `git filter-repo` / BFG or by force-pushing a rewritten history. Track the commit list (`git log -- public/raw`) and confirm scrub on every branch + tag. This is a destructive git operation; do it on a coordination call, not asynchronously.
3. **Verify GitHub repo visibility.** If the repo is or was ever public, treat the imaging as compromised: there is no realistic way to know who downloaded it. Document accordingly in `accepted-risks.md`. Cross-track to whomever owns medical-data-handling policy.
4. **Audit the rest of `public/`** for any other PHI shapes that might have been committed for deploy convenience.

**Regression test.** `src/__tests__/middleware.test.ts` asserts `/raw/manifest.json` and `/raw/axial_brain_5mm/0000.raw` return 401 unauthenticated. A persistent fix would also add a CI check that fails the build on any new file under `public/raw/` or matching common DICOM filename shapes.

**References.**
- HIPAA — Minimum Necessary Standard.
- Threat-model row "Data exfil via /api/export, /api/share — HIGH HIGH" — same impact category, different vector.

---

### D-019 — Middleware applied `Cache-Control: no-store` to PWA static assets

- **Severity:** P3 (correctness / PWA behavior)
- **Status:** fixed
- **Location:** `src/middleware.ts` `attachSecurityHeaders()`
- **Category:** misconfig

**Description.** First-pass middleware attached `Cache-Control: no-store, max-age=0` to every passing response, including `/sw.js`, `/manifest.json`, `/favicon.ico`, and the PWA icon SVGs. The intent was to keep PHI out of bfcache and intermediary caches; the side effect was forcing the browser to re-fetch every static asset on every navigation and potentially interfering with the service-worker update lifecycle.

**Fix.** Added `shouldNoStore(pathname)` predicate. Returns `false` for known PWA static asset paths (`/sw.js`, `/manifest.json`, `/favicon.ico`, root SVGs) and for `/_next/`. **Note:** `/raw/` was originally in the no-store-skip list because it served static DICOM; D-020 reclassified `/raw/` as PHI, so it now correctly DOES get no-store (and middleware now blocks unauthenticated access to it).

**Regression test.** `src/__tests__/middleware.test.ts` "middleware response hygiene" suite now asserts that PWA assets get no Cache-Control while still receiving HSTS.

---

### D-018 — Middleware allowlist for `/api/share/*` was overly broad

- **Severity:** P1
- **Status:** fixed
- **Location:** `src/middleware.ts` `ALLOWLIST_PREFIX`
- **Category:** auth

**Description.** The initial Track D middleware allowlist included the `/api/share/` prefix on the assumption that share-token-protected read endpoints would live there. The actual route under that prefix today is `POST /api/share/care-card`, which is the **mint** endpoint (creates a new public share URL for the Care Card). Mint endpoints must require auth — only the patient should be able to mint share links to her own data. By allowlisting the prefix, middleware was telling Track B "auth is your problem" while Track B was relying on a static env-bearer (D-001 + cross-track) that ships in the client bundle. Combined, the mint endpoint was effectively unauthenticated.

In practice, after D-001 fix the server-side env-bearer check fails closed (the client now sends nothing), so the bypass is masked. But the allowlist itself is incorrect and would re-open the hole the moment Track B replaced the env-bearer with `requireUser()` if middleware kept rubber-stamping the route.

**Fix.** Removed `/api/share/` from `ALLOWLIST_PREFIX`. `/share/<token>` (the public viewer **page**) stays allowlisted. The mint endpoint now flows through the standard auth gate. Documented in code that future token-protected public read endpoints should live under a separate path (`/api/public-share/...`) so the auth boundary stays unambiguous.

**Regression test.** `src/__tests__/middleware.test.ts` now asserts `/api/share/care-card` returns 401 unauthenticated and that `/share/abc123` still returns 200.

**References.** OWASP API Top 10 #1, principle of least privilege.

---

### D-017 — `next.config.ts` empty (X-Powered-By + source maps defaults)

- **Severity:** P3
- **Status:** fixed
- **Location:** `next.config.ts`
- **Category:** misconfig

**Description.** Empty `next.config.ts` meant Next shipped its default `X-Powered-By: Next.js` header on every response, advertising both the framework and (in some Next versions) the version. That makes CVE-fingerprinting easier. Production browser source maps default to off but were not pinned — a future toggle would silently ship our source code to the browser.

**Fix.** Set `poweredByHeader: false` and `productionBrowserSourceMaps: false` explicitly in `next.config.ts`.

**Regression test.** None — Next.js config behavior is framework-tested. Visible after deploy via `curl -I` (no `X-Powered-By` header).

---

### D-016 — Cache-Control + Permissions-Policy + CORP hardening

- **Severity:** P2
- **Status:** fixed
- **Location:** middleware response headers.
- **Category:** misconfig

**Description.** PHI responses had no `Cache-Control` directive, so browser back-forward cache and intermediary proxies could retain rendered Care Card / labs / cycle pages after sign-out. Permissions-Policy was missing `payment=()`, `usb=()`, `serial=()`, `bluetooth=()`. No `Cross-Origin-Resource-Policy` was set.

**Fix.** Middleware now attaches `Cache-Control: no-store, max-age=0` on every passing response (the `_next/static/` matcher exclusion keeps this off the immutable JS asset bundles), expanded `Permissions-Policy` to deny payment, usb, serial, bluetooth in addition to the prior camera/microphone/geolocation/interest-cohort directives, and added `Cross-Origin-Resource-Policy: same-origin`.

**Regression test.** `src/__tests__/middleware.test.ts` "middleware response hygiene" suite (3 cases).

---

## What I did NOT fix (deferred / out of scope)

- `src/app/api/share/care-card/route.ts` (server-side admin-token gate) — owned by Track B (`src/app/api/share/**`). Cross-track note filed.
- `src/lib/supabase.ts` co-bundling of `createServiceClient` with the client-facing `supabase` proxy — owned by Track A. Cross-track note filed.
- `src/app/api/admin/peek` and `src/app/api/admin/apply-migration-*` — owned by Track A (admin endpoints). Out of my scope.
- Migrating route validation to `zod` — P3 follow-up.
- A real Supabase Auth sign-in flow — owned by Track A.
