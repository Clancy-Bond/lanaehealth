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

### 2026-04-19 — Track D → Track B — `/api/share/care-card` admin-token guard is bypassable

- **Severity:** P0 (the original `NEXT_PUBLIC_*` leak is fixed in Track D's PR; the *server* still trusts the same shared bearer)
- **Location:** `src/app/api/share/care-card/route.ts` lines 36-74
- **Suggested fix:** Replace the `SHARE_TOKEN_ADMIN_TOKEN` env-bearer check with `await requireUser(req)`. The route mints 7-day public share URLs to PHI; it should be gated by the patient's session, not by a long-lived shared secret. Track D removed the `NEXT_PUBLIC_*` reference from `src/app/doctor/care-card/print-actions.tsx` so the client no longer sends the header. If the env value was ever set in production, **rotate it** because it has been part of the public bundle.
- **Status:** open

### 2026-04-19 — Track D → Track A — `createServiceClient` co-bundles with the client `supabase` proxy

- **Severity:** P2 (defense-in-depth; no actual key leaks today because `SUPABASE_SERVICE_ROLE_KEY` lacks the `NEXT_PUBLIC_` prefix and Next.js does not inline non-public env vars)
- **Location:** `src/lib/supabase.ts` (entire module)
- **Suggested fix:** Split into two modules: `src/lib/supabase/public-client.ts` (re-exports the anon-key proxy `supabase`) and `src/lib/supabase/service-client.ts` (re-exports `createServiceClient`, `import 'server-only'`-marked). Import paths change in 30+ files but the move guarantees client components cannot reach service-role code through the existing single-file import.
- **Status:** open

### 2026-04-19 — Track D → Track A — `requireUser()` placeholder lives in `src/lib/api/require-user.ts`

- **Severity:** P3 (interface coordination)
- **Location:** Track D shipped a placeholder `requireUser(req: Request): Promise<{ id: string }>` so its in-scope routes have defense-in-depth before A's sign-in flow lands. Once A's canonical `requireUser()` ships at `src/lib/auth/require-user.ts`, please keep the same Promise-returning signature so D's call sites need only an import-path swap. D's middleware also wraps an inline `isAuthed(req)` that mirrors the same cookie / bearer check; please consider exporting an `isAuthed(req)` from your helper so the middleware can drop its inline copy.
- **Status:** open
