---
date: 2026-04-16
agent: IMPL-W3-7
area: ci-smoke
status: LANDED
severity: HIGH
verification_method: integration-vs-live-server
wave: W3.7
---

# API smoke test (W3.7)

## One-sentence finding
Shipped the canonical "never again" integration smoke test at `src/__tests__/api-smoke.test.ts` that would have caught the Session 1 `medical_timeline.date` bug.

## Why this matters
Session 1's `final-report.md` (recommended next step #4) flagged that a CI smoke test GETing every API route and asserting (status 2xx OR 4xx) AND no `"error"` key in 200 payloads would have caught `/api/medications/today` silently returning `{"doses":[],"error":"column medical_timeline.date does not exist"}`. The endpoint came back 200, so no monitoring noticed, but the payload was broken. This test encodes that assertion.

## What the test does
1. Filesystem walk of `src/app/api/**/route.ts`, selects files that export a `GET` handler via regex.
2. For each file, constructs the URL, substituting `[integrationId]` with `integration-oura`, `[id]` with the zero UUID, and any other dynamic segment with a `smoke-sentinel` default.
3. GETs each URL against `SMOKE_URL` (defaults expected to be `http://localhost:3005`), with redirect following disabled so OAuth redirect routes can return 307 cleanly.
4. Asserts per route:
   - status is NOT 5xx
   - status is in `{200, 400, 401, 404, 405, 501}` or any 3xx (redirect)
   - if status === 200 and body is JSON object, body does NOT contain top-level `error` key
5. Prints a route-by-route outcome table at the end.

## How to run
```
SMOKE_URL=http://localhost:3005 npx vitest run src/__tests__/api-smoke.test.ts
# or
npm run test:smoke
```

Requires the dev server (`lanaehealth-dev` on port 3005) to be running. The suite skips itself with a clear message if `SMOKE_URL` is unset or the server is unreachable (health probe at `/api/health` with a 3s timeout). By design, the test does NOT spin up its own server -- keeps the shared dev server stable.

## First-run results (2026-04-16, live dev server)
40 GET routes enumerated. 39 pass, 1 fail:

- **FAIL** `/api/orthostatic` -- returns **500** with body `{"error":"Could not find the table 'public.orthostatic_tests' in the schema cache"}`. The code expects an `orthostatic_tests` table that does not exist in the live schema. **Out of lane for W3.7** (the brief says surface it, don't fix it).

Routes that 400 without params (all expected, correct behavior):
- `/api/admin/peek` (requires `?table=`)
- `/api/analyze/flare-risk` ("Not enough flare events or baseline data")
- `/api/food/barcode` (requires `?barcode=`)
- `/api/intelligence/prn` (requires `?medication=`)
- `/api/medications/adherence` (requires `?medication=`)
- `/api/reports/condition` (requires `?type=`)

Routes that 307 redirect (OAuth starts, expected):
- `/api/integrations/integration-oura/callback`
- `/api/oura/authorize`
- `/api/oura/callback`

Route that 404s cleanly (sentinel `integration-oura` not a registered connector, expected error path):
- `/api/integrations/integration-oura/authorize`

## Routes enumerated but NOT probed as GET
These export only POST/PUT/DELETE and are correctly skipped by the filesystem walker:
- `/api/analyze/correlations`, `/api/appointments/[id]`, `/api/chat`, `/api/context/assemble`, `/api/context/dream`, `/api/food/identify`, `/api/imaging`, `/api/import/apple-health`, `/api/import/myah`, `/api/import/mynetdiary`, `/api/import/natural-cycles`, `/api/import/universal`, `/api/integrations/[integrationId]/disconnect`, `/api/integrations/[integrationId]/sync`, `/api/intelligence/analyze`, `/api/labs`, `/api/labs/scan`, `/api/oura/disconnect`, `/api/oura/sync`, `/api/profile`, `/api/push/subscribe`, `/api/transcribe`

If they were hit with GET, Next would return 405, which is in our allowed set anyway.

## What this prevents going forward
Any future regression in the shape of Session-1 finding #1 (SQL error swallowed into a 200 body) or a 5xx introduced by a schema change will break the CI smoke test. `/api/orthostatic` is caught today as proof.

## Follow-ups (not this lane)
- Fix or hide `/api/orthostatic`: either create the `orthostatic_tests` table (Wave 3 migration) or point the route at the existing data source (myAH pulse-rate labs in `lab_results`, which W2.8 already taught `/api/intelligence/vitals` to use).
- Add this script to CI once a shared dev-server runner exists. For now it is opt-in via `npm run test:smoke`.
