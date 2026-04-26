# Track D - Infrastructure, Client, Config, Dependencies

**Owner:** Session D
**Branch:** `security/track-d-infra-client`
**Depends on:** Track A's `requireUser()` helper.
**Merge order:** Second (after A).

---

## Mission

Establish the perimeter. Ship Next.js middleware that enforces auth at
the edge, security headers (CSP, HSTS, frame-options, referrer
policy), a dependency audit, and a client-side XSS / dangerous-HTML
sweep. Remaining generic API routes (CRUD for calories, medications,
symptoms, etc.) that don't belong to other tracks also get their
baseline hardening here.

## Scope - files you MAY edit

- `next.config.ts`
- `vercel.json`
- `src/middleware.ts` (create)
- `package.json`, `package-lock.json` (dep bumps)
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/**` (XSS audit, `dangerouslySetInnerHTML` check)
- `src/app/**/page.tsx` and other non-API client surfaces (XSS audit)
- `public/**` (service worker, if present)
- Generic CRUD API routes NOT claimed by other tracks:
  - `src/app/api/appointments/**`
  - `src/app/api/calories/**` (except barcode/identify - Track C)
  - `src/app/api/cycle/**`
  - `src/app/api/expenses/**` (except receipt - Track C)
  - `src/app/api/favorites/**`
  - `src/app/api/food/**` (except barcode/identify - Track C)
  - `src/app/api/labs/**` (except scan - Track C)
  - `src/app/api/log/**`
  - `src/app/api/medication-timeline/**`
  - `src/app/api/medications/**`
  - `src/app/api/micro-care/**`
  - `src/app/api/migraine/**`
  - `src/app/api/orthostatic/**`
  - `src/app/api/prn-doses/**`
  - `src/app/api/search/**`
  - `src/app/api/symptoms/**`
  - `src/app/api/timeline/**`
  - `src/app/api/water/**`
  - `src/app/api/weight/**`
- `tsconfig.json`, `eslint.config.mjs`
- New tests

## Out of scope

- `src/lib/supabase.ts` / auth helper → Track A
- AI-calling routes → Track B
- External boundary routes → Track C

## Deliverable 1: Next.js middleware

Create `src/middleware.ts`. Responsibilities:

1. **Auth gate.** All routes except an explicit allowlist require auth.
   Allowlist:
   - `/` if you want a public landing (verify this is a deliberate
     choice)
   - `/api/integrations/[id]/callback` (OAuth callback, stateless)
   - `/api/oura/callback`
   - `/api/health` (health check)
   - `/_next/*`, `/favicon.ico`, PWA assets
   - Vercel cron paths (validated by Track C's `CRON_SECRET` pattern,
     not middleware auth)
2. **Security headers.** Attach on every response. See Deliverable 2.
3. **Bot / scraper defense** (light). Block requests without a normal
   `Accept` or with common scraper UAs on PHI-bearing routes.

Coordinate with Track A: middleware calls a lightweight `isAuthed(req)`
that wraps the same token check `requireUser()` does. Don't duplicate
logic.

## Deliverable 2: Security headers

In `next.config.ts` add a `headers()` function OR set on every response
via middleware (pick one; document why). Ship these:

| Header                    | Value                                                      |
|---------------------------|------------------------------------------------------------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload`           |
| `X-Content-Type-Options`  | `nosniff`                                                  |
| `X-Frame-Options`         | `DENY`                                                     |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`                          |
| `Permissions-Policy`      | `camera=(self), microphone=(self), geolocation=(self), interest-cohort=()` |
| `Content-Security-Policy` | see below                                                  |

CSP: start strict, relax only as needed. Expect inline Next.js runtime
scripts with nonces.

```
default-src 'self';
script-src 'self' 'nonce-<PER-REQUEST>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co https://api.ouraring.com;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://api.anthropic.com
            https://api.openai.com https://api.voyageai.com
            https://api.ouraring.com https://api.open-meteo.com
            https://api.nal.usda.gov https://world.openfoodfacts.org;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

Fine-tune after testing - add domains for any vendor actually called.
Confirm via `curl -I` in prod that headers arrive.

Ship a regression test that hits a route with `curl` and asserts
header presence and values.

## Deliverable 3: Client-side XSS / dangerous HTML audit

Grep for:

- `dangerouslySetInnerHTML` - every occurrence must be justified in a
  short comment OR replaced with safe rendering.
- `eval(`, `new Function(`, `document.write`, `innerHTML =` (in TSX)
- User-provided strings rendered inside `<a href={...}>` without a
  protocol check (block `javascript:`).
- `target="_blank"` without `rel="noopener noreferrer"`.

For every match, file a finding. Fix unless there's a documented
reason.

## Deliverable 4: Dependency audit

Run:

```bash
npm audit --production
npm outdated
```

For every HIGH / CRITICAL advisory, file a finding. Bump the version
if safe, pin it if not. For transitive-only CVEs that can't be easily
resolved, document in `accepted-risks.md`.

Also check:

- `@anthropic-ai/sdk` is current.
- No deprecated `lucide-react` major version gap.
- No unused deps (`depcheck` if you want, optional).

## Deliverable 5: Client bundle secrets check

Build the app and inspect the client bundle for leaked secrets:

```bash
npm run build
# Then grep .next/static for any env var that shouldn't be there
grep -r "SERVICE_ROLE" .next/ || echo "clean"
grep -r "ANTHROPIC_API_KEY" .next/ || echo "clean"
grep -r "sk-" .next/ || echo "clean"
```

Any finding here is P0.

Also verify `NEXT_PUBLIC_*` env vars really should be public. Move
anything that shouldn't into server-only env and update callers to be
server-side.

## Deliverable 6: Generic CRUD API route baseline

For every route in your scope (the generic CRUD list above), verify:

- Wrapped in `requireUser()`.
- Body validated with `zod` before any DB write.
- `Content-Type: application/json` enforced.
- Errors don't echo stack traces in production (`NODE_ENV === 'production'`).
- No SQL injection risk (Supabase client uses parameterized queries;
  grep for any raw `rpc()` or `from(...)` with dynamic table names).

Produce a matrix in your findings report: route × [auth ✓/✗, zod ✓/✗,
error-safe ✓/✗].

## Deliverable 7: Client storage audit

Grep for `localStorage`, `sessionStorage`, `document.cookie` across
`src/app/` and `src/components/`. For each:

- Does it store a token, secret, or PHI?
- If yes, move to an httpOnly cookie (via API route) or remove.

Offline queue (`src/lib/log/offline-queue.ts`, `offline-drain.ts`)
stores entries in localStorage. Verify:

- Queue contents are not readable by malicious extensions (acceptable
  risk for a PWA; document).
- Queue is drained on auth change (different user should not see the
  previous user's pending writes - irrelevant for single-patient but
  documented).

## Deliverable 8: Service worker

If `public/sw.js` or similar exists (check - `ServiceWorkerRegister.tsx`
suggests it does), verify:

- SW does not cache API responses containing PHI (cache-first for
  static assets only, network-first for API).
- SW scope is the origin, not a sub-path that could be hijacked.

## Deliverable 9: Error pages & dev artifacts

- `src/app/error.tsx` - ensure no stack trace in prod.
- `src/app/api/admin/peek` - removed or dev-gated (Track A owns; flag
  cross-track if still live).
- Delete committed `tmp_*.mjs` ad-hoc scripts - git log shows these
  were cleaned up, double-check none remain.
- `.gitignore` covers `.env*`, `.vercel/`, `.next/`, `coverage/`,
  `tmp_*`.

## Checklist

- [ ] `src/middleware.ts` shipped with auth gate + header attachment
- [ ] CSP + HSTS + supporting headers shipped and header-test green
- [ ] `dangerouslySetInnerHTML` audit complete
- [ ] `npm audit` clean or all HIGH/CRITICAL justified
- [ ] Client bundle grep clean of secrets
- [ ] Every generic CRUD route: auth + zod + error-safe
- [ ] Client storage audit documented
- [ ] Service worker reviewed
- [ ] Error pages production-safe
- [ ] `.gitignore` covers sensitive patterns
- [ ] Findings report complete
- [ ] Regression tests for every P0/P1 fix
- [ ] `npm test` and `npm run build` green
- [ ] Cross-track notes filed
