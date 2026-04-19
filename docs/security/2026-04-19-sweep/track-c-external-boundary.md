# Track C — External Boundary

**Owner:** Session C
**Branch:** `security/track-c-external-boundary`
**Depends on:** Track A's `requireUser()` and Track D's middleware.
**Merge order:** Third (after A, D).

---

## Mission

Everywhere LanaeHealth touches the outside world — OAuth redirect
flows, Vercel crons, file uploads, third-party API clients, push
subscriptions, iOS Shortcut ingestion — is an untrusted boundary.
Track C audits and hardens every one.

## Scope — files you MAY edit

- `src/app/api/integrations/**`
- `src/app/api/oura/**`
- `src/app/api/health-sync/**` (iOS Shortcut JSON ingestion — newly
  added, highest priority)
- `src/app/api/push/**`
- `src/app/api/weather/**`
- `src/app/api/cron/**`
- `src/app/api/sync/**`
- `src/app/api/import/**`
- `src/app/api/imaging/**` (file upload)
- `src/app/api/labs/scan/**` (OCR file upload)
- `src/app/api/food/barcode/**`
- `src/app/api/food/identify/**` (photo upload)
- `src/app/api/expenses/receipt/**` (photo upload)
- `src/lib/integrations/**`
- `src/lib/importers/**`
- `src/lib/import/**`
- `src/lib/medical-apis/**`
- `src/lib/notifications.ts`
- `src/lib/oura.ts`
- `src/lib/weather.ts`
- New tests

## Out of scope

- Client rendering of imported data → Track D
- AI normalization of imported content → Track B (prompt injection)
- Auth helper → Track A

## Deliverable 1: Vercel cron lockdown

`vercel.json` exposes these cron paths:

- `/api/sync` (every 2h)
- `/api/weather` (daily 08:00)
- `/api/push/send` (every 10m)
- `/api/cron/doctor-prep` (every 6h)
- `/api/cron/build-status` (every 10m)

Today these appear publicly reachable. Anyone could hit them and:

- Trigger expensive Anthropic API calls (`/api/cron/doctor-prep`
  likely calls Claude).
- Spam push notifications (`/api/push/send`).
- Re-sync data from integrations (`/api/sync`).
- Burn Oura / weather API quota.

Fix: every cron endpoint validates the request came from Vercel's cron
service. Vercel sends an `Authorization: Bearer $CRON_SECRET` header
when `CRON_SECRET` env var is set. Pattern:

```ts
export function isVercelCron(req: Request): boolean {
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!auth || !expected) return false
  return auth === `Bearer ${expected}`
}
```

Apply to every cron endpoint. Use `crypto.timingSafeEqual` for the
comparison.

Add a regression test per cron that asserts 401 without the header.

Document in `docs/security/2026-04-19-sweep/cron-secret-rotation.md`
how to rotate `CRON_SECRET`.

## Deliverable 2: OAuth flow audit (Oura + others)

`src/app/api/integrations/[integrationId]/authorize|callback/route.ts`
and `src/app/api/oura/authorize|callback/route.ts` implement OAuth.
For each, verify:

1. **State parameter.** The authorize step generates a cryptographic
   random `state`, stores it server-side (signed cookie or DB),
   validates on callback. Without it, CSRF on the OAuth flow allows
   an attacker to link their Oura account to the patient's.
2. **PKCE.** If the OAuth manager claims PKCE (per CLAUDE.md), verify
   the code verifier is never logged and never sent to the browser
   post-authorize.
3. **Redirect URI allowlist.** The `redirect_uri` in the authorize URL
   is constructed from trusted config (not from a request query param).
4. **Token storage.** Access tokens / refresh tokens land in
   `integration_tokens` or `oura_tokens` tables with RLS. Grep for
   `localStorage.setItem` or `document.cookie =` touching tokens.
5. **Scope minimization.** Scopes requested are the minimum needed.

## Deliverable 3: Health-sync endpoint (iOS Shortcut)

`src/app/api/health-sync/route.ts` is the newest route (commit
`13ebe63`). It accepts arbitrary JSON from an iOS Shortcut. Audit:

- Shared-secret authentication (the Shortcut sends a header; the route
  validates it with `crypto.timingSafeEqual`).
- Schema validation with `zod` before any DB write. Reject unexpected
  fields.
- Size limit on request body (Next.js default is 1MB but spell it out).
- Rate limiting (at least 60 requests per minute).
- Idempotency: if the Shortcut double-fires, no duplicate rows. Use a
  dedupe key per record.
- Error responses don't echo the input back (leaks PHI if hit by a
  logger).

## Deliverable 4: File-upload endpoints

Routes that accept files:

- `/api/import/apple-health` (potentially large XML)
- `/api/import/universal` (FHIR/C-CDA/PDF/screenshot/CSV)
- `/api/import/myah`, `/api/import/mynetdiary`, `/api/import/natural-cycles`
- `/api/imaging` (DICOM / image)
- `/api/labs/scan` (OCR image)
- `/api/food/identify` (meal photo)
- `/api/food/barcode` (barcode image)
- `/api/expenses/receipt` (receipt photo)

For each, verify:

1. **Size limit.** Enforced before streaming begins. Reject with 413
   for oversized.
2. **Content-type / extension check.** Don't trust the extension
   alone; read magic bytes for critical types (PDF, JPEG, PNG).
3. **Filename sanitization.** Never render the filename back to the
   client as HTML. Never persist the raw filename as a DB primary key.
4. **Storage.** If files land in Supabase Storage, the bucket has RLS.
   If they land in a `/tmp` directory, they are deleted after
   processing.
5. **Antivirus / malware scan.** Probably out of scope for v1 but
   document as P2 if missing.
6. **XML/CSV entity attacks.** XXE in XML parsers (use a library that
   disables external entities by default; Node's native XML libs don't
   expand entities but double-check). CSV formula injection already
   covered by Track B for generated exports; check imports don't echo
   formulas into downstream displays.
7. **Zip bombs.** The Apple Health importer unzips a `.zip`. Enforce
   uncompressed-size limits.
8. **SSRF.** If any importer fetches a URL from the uploaded file
   (e.g., follows a reference), block private IP ranges.

## Deliverable 5: Third-party API clients

`src/lib/medical-apis/*` calls external biomedical APIs (genomics,
nutrition, research, etc.). `src/lib/oura.ts`, `src/lib/weather.ts`
call vendor APIs. For each:

- Outbound request has a timeout (use `AbortController` with ≤ 30s).
- Response size has a cap (reject > 10MB).
- Response content-type is validated before JSON-parsing.
- Errors don't leak API keys in messages or logs.
- The API key lives in env, not hardcoded.

## Deliverable 6: Push notifications

`src/app/api/push/subscribe/route.ts` takes a browser push
subscription. Verify:

- VAPID keys in env, never in client bundle (the public key is
  supposed to go to the client; the private key must not).
- The subscription is stored with the user ID; you cannot subscribe
  someone else's browser.
- `/api/push/send` is cron-only (covered by Deliverable 1).
- `/api/push/prn-poll` is auth-gated.

## Deliverable 7: Rate limiting

Add a lightweight in-memory rate limiter (or Upstash Redis if already
present) to the external boundary routes:

- `/api/health-sync`: 60/min per source
- `/api/import/*`: 5/min
- `/api/imaging`, `/api/labs/scan`, `/api/food/identify`,
  `/api/expenses/receipt`: 10/min
- OAuth callbacks: 10/min per IP

Document the limiter. Small scope; do not over-engineer.

## Checklist

- [ ] Every Vercel cron endpoint authenticated with `CRON_SECRET` +
      regression test
- [ ] OAuth state + PKCE verified on every flow
- [ ] Health-sync endpoint: secret + zod + rate limit + idempotency
- [ ] Every file-upload endpoint: size + content-type + filename +
      storage policy verified
- [ ] Apple Health importer zip-bomb protected
- [ ] Third-party API clients: timeouts, size caps, key hygiene
- [ ] Push subscribe: VAPID private key audit
- [ ] Rate limiting deployed on external boundary
- [ ] Findings report complete
- [ ] Regression tests for every P0/P1 fix
- [ ] `npm test` and `npm run build` green
- [ ] Cross-track notes filed
