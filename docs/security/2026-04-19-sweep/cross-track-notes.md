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

