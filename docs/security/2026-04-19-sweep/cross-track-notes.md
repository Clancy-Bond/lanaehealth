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
