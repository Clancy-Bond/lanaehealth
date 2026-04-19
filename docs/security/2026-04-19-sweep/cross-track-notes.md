# Cross-Track Notes

Append here when you find an issue outside your scope. The owning track
picks it up. Do NOT edit files outside your scope yourself.

Format:

```markdown
### {date} — {finder-track} → {owner-track} — {short title}

- **Severity:** P0 / P1 / P2 / P3
- **Location:** `path/to/file.ts:LINE`
- **Suggested fix:** one sentence.
- **Status:** open / acknowledged / fixed
```

---

<!-- Append notes below this line -->

### 2026-04-19 — Track C → Track D — Homepage weather prefetch now 401s

- **Severity:** P3
- **Location:** `src/app/page.tsx:364-377`
- **Suggested fix:** The server-side `fetch('/api/weather')` was previously
  the only warm-cache trigger. Track C locked `/api/weather` behind
  `CRON_SECRET`. Either remove this fetch (the Vercel cron handles cache
  warming daily) or pass the cron bearer. The fetch is wrapped in a
  silent catch already so this is non-breaking, just dead code.
- **Status:** open

### 2026-04-19 — Track C → Track A — `/api/oura/sync` is unauthenticated

- **Severity:** P1
- **Location:** `src/app/api/oura/sync/route.ts:22`
- **Suggested fix:** Settings UI (`src/components/settings/SettingsClient.tsx:298`)
  calls this on "Manual Sync". Anyone on the internet can also trigger it
  and burn Oura API quota. Needs `requireUser()` from Track A; Track C
  cannot land this cleanly without it.
- **Status:** open

### 2026-04-19 — Track C → Track A — Import/upload endpoints need `requireUser()`

- **Severity:** P0
- **Location:** `src/app/api/import/**`, `src/app/api/imaging/route.ts`,
  `src/app/api/labs/scan/route.ts`, `src/app/api/food/identify/route.ts`,
  `src/app/api/expenses/receipt/route.ts`
- **Suggested fix:** Track C landed rate-limiting and request-size caps,
  which cuts the DoS vector. Auth still missing: anyone on the public
  internet can push data into the patient's DB (import routes) or burn
  the Anthropic budget (`food/identify`, `labs/scan`). Once Track A's
  `requireUser()` helper lands, add it at the top of each handler.
- **Status:** open

### 2026-04-19 — Track C → Track A — `/api/push/subscribe` accepts arbitrary endpoints

- **Severity:** P2
- **Location:** `src/app/api/push/subscribe/route.ts:14-49`
- **Suggested fix:** Anyone can register a push endpoint and receive
  every notification fanned out to the global subscription list. Once
  Track A's `requireUser()` is available, bind subscriptions to the
  authenticated user and filter by owner on send.
- **Status:** open

### 2026-04-19 — Track C → Track D — `/api/sync` hitherto returned only status on GET

- **Severity:** P3
- **Location:** `src/app/api/sync/route.ts`
- **Suggested fix:** Pre-existing bug: the vercel.json cron targets
  `/api/sync` and Vercel sends GET, but the original GET only returned
  `getSyncSummary()` and never ran any sync. Track C rewired GET to
  `runOverdueSyncs()` so the cron is actually effective. Heads-up in
  case Track D wires a new "status" page that expects the old behavior.
- **Status:** open

### 2026-04-19 — Track C → Track D — Vercel cron for `/api/push/send` hits a GET that is a no-op

- **Severity:** P2
- **Location:** `vercel.json`, `src/app/api/push/send/route.ts:118`
- **Suggested fix:** vercel.json schedules `/api/push/send` every 10m,
  but the route's fan-out logic is under POST; GET just reports VAPID
  config. Move the dispatch logic to GET (or have Vercel call POST via
  a shim) so the cron actually fires notifications.
- **Status:** open

### 2026-04-19 — Track C → Track D — `/api/expenses/receipt` leaks expense PHI without auth

- **Severity:** P1
- **Location:** `src/app/api/expenses/receipt/route.ts:15`
- **Suggested fix:** Unauthenticated GET returns a PDF with line-item
  medical expense descriptions. Needs `requireUser()` plus rate limit.
  Track C added rate limit to the siblings but this route is a report
  generator (not a file upload), and Track D owns reports.
- **Status:** open

### 2026-04-19 — Track C → Track B — CSV formula injection risk in imports

- **Severity:** P2
- **Location:** `src/lib/importers/natural-cycles.ts` (and any
  generated export that echoes imported text)
- **Suggested fix:** Imported rows may contain cells starting with
  `=`, `+`, `-`, or `@`. On export to CSV those become Excel formulas.
  Track B owns generated exports; please sanitize by prefixing `'` to
  any cell whose first char is one of those four on export.
- **Status:** open

### 2026-04-19 — Track A → Track D — 3 client components invoke `createServiceClient()`

- **Severity:** P0 (architecture) / P1 (runtime)
- **Location:**
  - `src/components/log/WorkoutCard.tsx:82`
  - `src/components/log/VitalsCard.tsx`
  - `src/components/log/TiltTableTest.tsx`
- **Suggested fix:** replace each direct Supabase call with a fetch
  to a new scoped server route (e.g. POST `/api/log/workout`,
  `/api/log/vitals`, `/api/log/orthostatic-tilt`). Add Track D's
  client-bundle grep to CI to prevent regressions.
- **Status:** fixed in Track D (D-007, merge commit 2026-04-19).
  The three components now POST to `/api/log/workout`,
  `/api/log/vitals-snapshot`, `/api/log/tilt-test`. All three
  endpoints wrap `requireAuth()`. `client-bundle-secrets.test.ts`
  fails CI on any future `import { createServiceClient }` in a
  `'use client'` or `src/components/*` module.

### 2026-04-19 — Track A → Track B/C/D — 169 files call `createServiceClient()`

- **Severity:** P2
- **Location:** sweep-wide. See Track A finding A-010.
- **Suggested fix:** each owning track audits its scoped routes and
  documents, per call, whether service-role is actually required or
  whether the anon client + RLS would suffice. No refactor required
  in this sweep; document in each track's findings report.
- **Status:** open — sweep-wide, follow-up sprint.

### 2026-04-19 — Track A → Track D — deprecate `PRIVACY_ADMIN_TOKEN` env var

- **Severity:** P3
- **Location:** Vercel env + `src/app/api/privacy-prefs/route.ts`
  (no longer consulted) + any docs that reference it
- **Suggested fix:** remove `PRIVACY_ADMIN_TOKEN` from Vercel env
  once this sweep lands; it is no longer read by the code. Sweep
  docs under `docs/` for stale references and update.
- **Status:** code-side done (Track A retired the header check in
  `privacy-prefs` and Track D retired the query-token path in
  `export/full` + updated `PrivacySettings`). Operational
  action still required: remove `PRIVACY_ADMIN_TOKEN`,
  `SHARE_TOKEN_ADMIN_TOKEN`, and `EXPORT_ADMIN_TOKEN` from the
  Vercel environment after this sweep lands.

### 2026-04-19 — D → B — `/api/share/care-card` still guards on an env token

- **Severity:** P1
- **Location:** `src/app/api/share/care-card/route.ts:52-74`
- **Suggested fix:** Drop the `SHARE_TOKEN_ADMIN_TOKEN` header check;
  rely on the middleware auth gate (D-002) plus Track A's
  `requireUser()`. While Track B's update is pending, the client
  side of this flow (which Track D fixed in D-001) does not send the
  token, so share-link creation fails closed until B updates the
  route.
- **Status:** fixed in Track D (user override 2026-04-19) — route
  now wraps `requireAuth()`; `SHARE_TOKEN_ADMIN_TOKEN` + header +
  query patterns all retired.

### 2026-04-19 — D → A — `createServiceClient` imported by client components

- **Severity:** P2
- **Location:**
  `src/components/log/WorkoutCard.tsx:4`,
  `src/components/log/VitalsCard.tsx:4`,
  `src/components/log/TiltTableTest.tsx:17` (and the helper they call
  in `src/lib/supabase.ts`).
- **Suggested fix:** Either (a) split `createServiceClient` into its
  own server-only module and forbid client imports via a tsconfig
  path-group or ESLint rule, or (b) refactor those three components
  to POST to server routes instead of calling Supabase directly.
  Track D added `src/__tests__/client-bundle-secrets.test.ts` which
  will catch any future `process.env.SUPABASE_SERVICE_ROLE_KEY`
  leak into a client module.
- **Status:** fixed in Track D (user override 2026-04-19, option
  b). The three components now POST to `/api/log/workout`,
  `/api/log/vitals-snapshot`, `/api/log/tilt-test` respectively; all
  three routes gate on `requireAuth()`. Regression test
  `client-bundle-secrets.test.ts` now also fails CI if any `'use
  client'` or `src/components/*` module imports
  `createServiceClient`.

### 2026-04-19 — D → A — PrivacySettings passes admin token as URL query

- **Severity:** P2
- **Location:** `src/components/settings/PrivacySettings.tsx:99-101` and
  `src/app/api/export/full/route.ts`
- **Suggested fix:** Replace the `?token=<adminToken>` query-string
  pattern with a POSTed header + cookie (or Track A's upcoming
  `requireUser()`). Tokens in query strings end up in browser
  history, referer headers, and Vercel access logs.
- **Status:** fixed in Track D (user override 2026-04-19) —
  `/api/export/full` now wraps `requireAuth()`; query-token path
  retired. `PrivacySettings` sends `Authorization: Bearer` and
  downloads the ZIP via `fetch()` + blob URL so the token stays off
  the URL.

### 2026-04-19 — D → A — `/api/admin/peek` still live

- **Severity:** P0
- **Location:** `src/app/api/admin/peek/route.ts`
- **Suggested fix:** Delete the route (or dev-gate it behind
  `process.env.NODE_ENV !== 'production'`). The example finding in
  `findings-template.md` describes the exact risk: any caller can
  `?table=cycle_entries` and read the first five rows. With the
  middleware auth gate disabled by default this is live on prod
  right now.
- **Status:** fixed in Track D (user override 2026-04-19) —
  route deleted. Track A's branch also deletes it; git will see an
  identical removal when the PRs merge.

### 2026-04-19 — D → B — Chat history `GET` has no auth

- **Severity:** P1
- **Location:** `src/app/api/chat/history/route.ts:29-46`
- **Suggested fix:** Wrap in Track A's `requireUser()`; the current
  `GET` returns the last 100 chat messages (full Claude
  conversation history, PHI-dense) with no auth check.
- **Status:** fixed in Track D (user override 2026-04-19) — both
  `GET` and `DELETE` now gate on `requireAuth()`. The
  `CHAT_HARD_DELETE_TOKEN` + `?confirm=hard&token=` path is
  preserved as a second factor *inside* the authed gate.
