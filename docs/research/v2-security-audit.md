# LanaeHealth v2 Security Audit
Date: 2026-04-24
Branch: claude/v2-security-hardening
Scope: Production-readiness gate per user direction "anything in the public needs to get privatized."

## Methodology

- Enumerated 114 route.ts files under src/app/api
- For each: grepped for auth helpers (requireAuth, isVercelCron, hasServiceAuth), rate-limit helpers (rateLimit, checkRateLimit), and zod validation (.parse, safeParse)
- Read PHI-bearing routes manually to confirm grep results
- Checked middleware.ts gate posture, supabase client exposure, console logging surface, CSP, CORS, open redirects
- Ran npm audit for dep vulnerabilities

## Severity counts

- CRITICAL: 5
- HIGH: 4
- MEDIUM: 6
- LOW: 4
Total: 19 findings

---

## CRITICAL

### C-1. Middleware auth gate is OFF by default in production
File: src/middleware.ts L136-138
Risk: Every PHI route is reachable from the public internet because LANAE_REQUIRE_AUTH defaults to OFF and most route handlers do not have their own auth gate.
Mitigation: Enable LANAE_REQUIRE_AUTH=true at the env level (Vercel + .env.local) so the middleware refuses unauthenticated requests to non-public paths.

### C-2. PHI-bearing API routes with no route-level auth
Files (counted above as A=0 in audit grep):
- src/app/api/timeline/route.ts (GET returns full medical timeline; POST writes events)
- src/app/api/medications/today/route.ts (GET returns today's doses)
- src/app/api/medications/adherence/route.ts (GET medication adherence stats)
- src/app/api/medications/reminders/route.ts (GET/POST reminders)
- src/app/api/imaging/route.ts (POST writes imaging studies + timeline event)
- src/app/api/medication-timeline/route.ts (GET returns medication change history)
- src/app/api/labs/route.ts (POST writes lab results, no auth)
- src/app/api/cycle/log/route.ts (POST writes cycle entries)
- src/app/api/symptoms/quick-log/route.ts (POST writes symptoms)
- src/app/api/orthostatic/route.ts, /tests/route.ts (vitals)
- src/app/api/migraine/attacks/route.ts (POST writes attacks)
- src/app/api/mood/log/route.ts, hr/log, bp/log, weight/log, water/log
- src/app/api/intelligence/{cycle,vitals,exercise,nutrition,prn,food-symptoms}/route.ts
- src/app/api/oura/{sleep-stages,sync,authorize,disconnect}/route.ts
- src/app/api/integrations/[integrationId]/{authorize,disconnect,sync}/route.ts
- src/app/api/import/{history,apple-health,natural-cycles,mynetdiary,universal,myah}/route.ts
- src/app/api/clinical-scales/log, prn-doses/{open,record,respond}, log/prefill, micro-care, search, calories/* (~25 routes)
Risk: When middleware is enabled these become 401-protected. When middleware is OFF (current default) all of the above leak Lanae's PHI to anyone who can reach the URL. Defense-in-depth requires both gates.
Mitigation: Set LANAE_REQUIRE_AUTH=true (covers all of them). Tracked: route-level requireAuth() rollout is a follow-up sweep.

### C-3. /api/labs/route.ts catches DB error and reflects raw error.message
File: src/app/api/labs/route.ts L66 and L102 (uses jsonError which strips in prod, but the custom code-path here at L66 reflects studyError.message directly)
Risk: Database column names, constraint names, RLS policy errors leak schema in production responses.
Mitigation: Already use jsonError elsewhere; replace one-off Response.json(`Failed to insert imaging study: ${studyError.message}`) with jsonError so prod hides the detail.

### C-4. /api/imaging POST returns raw err.message in catch block
File: src/app/api/imaging/route.ts L102-107
Risk: Stack-trace / unknown-error message reflection in production.
Mitigation: Switch to jsonError.

### C-5. Open redirect: /api/symptoms/quick-log echoes returnTo unsanitized
File: src/app/api/symptoms/quick-log/route.ts L92-93
Risk: Attacker-supplied returnTo like //evil.com or /\evil.com causes 303 redirect to off-site URL after a forged form POST. Same vector PR #54 fixed in food/log.
Mitigation: Apply the same parseReturnTo() sanitizer pattern.

---

## HIGH

### H-1. Open redirect: /api/water/log accepts arbitrary returnTo
File: src/app/api/water/log/route.ts L24, L68
Risk: Same open-redirect class as C-5.

### H-2. Open redirect: /api/calories/favorites/toggle accepts arbitrary returnTo
File: src/app/api/calories/favorites/toggle/route.ts L17, L53
Risk: Same open-redirect class as C-5.

### H-3. /api/medications/today logs raw Supabase error
File: src/app/api/medications/today/route.ts L27
Risk: Raw error logged to operator console (acceptable). Response body returns generic 'query_failed' (good). No PHI leak in response. Severity HIGH only because the route is unauthenticated.

### H-4. CSP allows 'unsafe-inline' and 'unsafe-eval' on script-src
File: src/middleware.ts L50
Risk: A successful XSS gains arbitrary script execution. Documented as a P2 follow-up in src/middleware.ts. Tracked as a known accepted risk; deferred - switching to nonce-based CSP requires nonce wiring on every inline script in Next.js 16 App Router.

---

## MEDIUM (defer to follow-up PR)

- M-1. Most write routes accept JSON without zod schemas (use ad-hoc string/number coercion). Code is defensive but a single typo could allow column overwrite. Recommend incremental migration to zod.
- M-2. /api/timeline GET has no pagination (loads full medical_timeline).
- M-3. /api/labs POST has no rate limit (cheap to spam ingest).
- M-4. /api/sync, /api/profile, /api/preferences all have auth but no rate limit.
- M-5. console.error('Timeline insert error:', timelineError.message) in src/app/api/imaging/route.ts L98 logs DB error message to ops logs (acceptable but tighten to jsonError-style logging helper).
- M-6. Per-day-chunk vector search returns embeddings JSON to chat clients; should add a max document count cap to bound payload size.

## LOW (defer)

- L-1. npm audit: 3 moderate vulnerabilities (next < latest, postcss < latest, sentry transitive). Next.js 16 + Sentry latest already include the fix path; needs major-version bump tracked separately.
- L-2. /api/_health/sentry intentionally throws to test Sentry - fine for ops, but should require auth to prevent error-event spam.
- L-3. Service role key reach is contained to server-side files; no client bundle exposure detected. Keep this property by adding ESLint rule.
- L-4. Cookie hygiene on session is correct (httpOnly, secure in prod, sameSite strict, 30d). 'lanae_session' legacy cookie still accepted by middleware.

---

## What this PR ships (CRITICAL + quick HIGH)

1. C-1: enable LANAE_REQUIRE_AUTH at the application level - change the default in src/middleware.ts from OFF to ON unless explicitly disabled (LANAE_REQUIRE_AUTH=false) so production deploys are fail-safe even if env var is missing.
2. C-3, C-4: route both ad-hoc Response.json error reflections in /api/labs and /api/imaging through jsonError so prod returns generic codes.
3. C-5, H-1, H-2: extract parseReturnTo() into a shared util and apply it to symptoms/quick-log, water/log, calories/favorites/toggle.
4. L-2: add requireAuth() to /api/_health/sentry to gate error-spam vector.

Deferred to follow-up:
- Adding requireAuth() inside every PHI route (C-2 sweep) - middleware default flip protects the URL surface; per-route gate is defense-in-depth.
- CSP tightening (H-4).
- All MEDIUM items.
- npm audit major-version upgrades.
