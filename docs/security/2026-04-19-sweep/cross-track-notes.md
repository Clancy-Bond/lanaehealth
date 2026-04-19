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
- **Status:** open

### 2026-04-19 — Track A → Track B/C/D — 169 files call `createServiceClient()`

- **Severity:** P2
- **Location:** sweep-wide. See Track A finding A-010.
- **Suggested fix:** each owning track audits its scoped routes and
  documents, per call, whether service-role is actually required or
  whether the anon client + RLS would suffice. No refactor required
  in this sweep; document in each track's findings report.
- **Status:** open

### 2026-04-19 — Track A → Track D — deprecate `PRIVACY_ADMIN_TOKEN` env var

- **Severity:** P3
- **Location:** Vercel env + `src/app/api/privacy-prefs/route.ts`
  (no longer consulted) + any docs that reference it
- **Suggested fix:** remove `PRIVACY_ADMIN_TOKEN` from Vercel env
  once this sweep lands; it is no longer read by the code. Sweep
  docs under `docs/` for stale references and update.
- **Status:** open
