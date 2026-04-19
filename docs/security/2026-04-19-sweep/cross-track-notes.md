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

### 2026-04-19 — Track B → Track A — `requireUser()` stub landed locally

- **Severity:** P1
- **Location:** `src/lib/auth/require-user.ts` (new)
- **Suggested fix:** Track A replaces this stub with the real
  Supabase-session-backed implementation. Contract to preserve:
  - `async (req) => { ok: true, user: { id, label } } | { ok: false, response }`
  - `user.id` string must fit into `security_audit_log.actor`
  - Stub rejects `?token=` on purpose; keep that property when
    replacing. Header + cookie + Bearer only.
- **Status:** open

### 2026-04-19 — Track B → Track A — Migration 027 (security_audit_log) pending apply

- **Severity:** P1
- **Location:** `src/lib/migrations/027_security_audit_log.sql`
- **Suggested fix:** Apply in the same deploy that ships the real
  session token. The audit-log helper silently no-ops until the
  table exists, so nothing breaks if the migration lands later, but
  nothing is RECORDED either.
- **Status:** open

### 2026-04-19 — Track B → Track A — `?token=` query path still accepted on admin routes

- **Severity:** P2
- **Location:** `src/app/api/share/care-card/route.ts`,
  `src/app/api/export/full/route.ts`
- **Suggested fix:** When the real session model lands, remove the
  `?token=` fallback from `extractAdminToken()` on both routes. Left
  in place now to avoid breaking Clancy's existing browser
  bookmarks.
- **Status:** open

### 2026-04-19 — Track B → Track D — Middleware ordering vs `requireUser()`

- **Severity:** P2
- **Location:** `src/middleware.ts` (Track D to create)
- **Suggested fix:** When Track D adds a middleware-level auth
  gate, make sure it runs BEFORE the in-route `requireUser()` so
  rate-limit and audit state in those handlers is only spent on
  already-authenticated requests.
- **Status:** open

### 2026-04-19 — Track B → Track C — Prompt-injection helpers available for AI importers

- **Severity:** P1
- **Location:** `src/lib/import/parsers/*.ts` (several files call
  Anthropic with user-controlled PDF / CSV / JSON content)
- **Suggested fix:** Track C route owners should import
  `wrapUserContent` and `sanitizeForPersistedSummary` from
  `@/lib/ai/safety/wrap-user-content` when sending imported
  content to Claude. Same helper that the context assembler now
  uses. Also persist normalized output with
  `sanitizeForPersistedSummary()` because normalizer output lands
  in `nc_imported` / `lab_results` / `imaging_studies` which the
  three-layer assembler reads back.
- **Status:** open

### 2026-04-19 — Track B → Track C — CSV formula-injection pattern applies to any CSV path

- **Severity:** P1
- **Location:** any future CSV writer outside
  `src/lib/reports/csv-export.ts`
- **Suggested fix:** Reuse the escape logic from `rowsToCsv` in
  `src/app/api/export/full/route.ts`. Prefix cells that start with
  `=`, `+`, `-`, `@`, `\t`, `\r` with an apostrophe. Tests at
  `src/lib/reports/__tests__/csv-injection.test.ts` are the
  reference.
- **Status:** open
