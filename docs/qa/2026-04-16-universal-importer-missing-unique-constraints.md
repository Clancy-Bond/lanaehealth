---
date: 2026-04-16
agent: R2
area: importers
status: FIXED
severity: HIGH
verification_method: static-analysis
fixed_in: W1.2 (IMPL-2)
fixed_at: 2026-04-17
---

# Universal importer upserts reference unique constraints that do not exist

## One-sentence finding
`handleConfirm` in `/api/import/universal` calls `.upsert(..., { onConflict: 'date,test_name' })` and similar for `lab_results`, `appointments`, and `active_problems`, but none of those composite unique constraints exist in the migration SQL, so every upsert will fail with "no unique or exclusion constraint matching the ON CONFLICT specification".

## Expected
Either the migrations create the constraints
```sql
ALTER TABLE lab_results ADD CONSTRAINT uniq_lab_date_test UNIQUE(date, test_name);
ALTER TABLE appointments ADD CONSTRAINT uniq_appt_date_doctor UNIQUE(date, doctor_name);
ALTER TABLE active_problems ADD CONSTRAINT uniq_active_problem_name UNIQUE(problem);
```
...or the route uses an explicit read-then-insert / update pattern via `filterExistingRecords` (which already exists but is unused).

## Actual
`src/app/api/import/universal/route.ts`:
- Line 133: `.upsert({...}, { onConflict: 'date,test_name' })` for `lab_results`.
- Line 163: `.upsert({...}, { onConflict: 'name' })` for `active_problems` (also uses `name` column that does not exist, see sister finding).
- Line 177: `.upsert({...}, { onConflict: 'date,doctor_name' })` for `appointments`.
- Line 199: `.upsert({...}, { onConflict: 'section' })` for `health_profile` -- this one exists (migration 001 has a unique constraint on `section`).
- Line 246: `.upsert({...}, { onConflict: 'date,test_name' })` for vital-sign-as-lab -- same missing constraint.

The SQL migrations at `src/lib/migrations/001-context-engine.sql`, `009_bearable_killer.sql`, and `011_endometriosis_mode.sql` never add composite uniques to `lab_results` or `appointments`. The live DB almost certainly lacks them (Session 1 found 269 rows in `lab_results` -- large number, suggesting no unique index forcing dedup).

Every upsert in handleConfirm will throw `ON CONFLICT DO UPDATE requires inference specification or constraint name`. The outer try/catch suppresses these into `errors` and the response still returns 200 with `totalSaved: 0`.

## Verification evidence

Search for unique constraints on lab_results:
```
$ grep -rn "UNIQUE" src/lib/migrations/*.sql | grep -iE "lab_results|appointments|active_problems"
(no results)
```

Only `health_profile(section)` has a unique constraint in migration 001 line 38. No composite uniques exist for any other importer target.

`filterExistingRecords` is defined in `src/lib/import/deduplicator.ts` with proper per-record existence queries but **is never imported or called** from `src/app/api/import/universal/route.ts`. The plumbing is there; the wire-up is missing.

## Recommended action

FIX (preferred, no DB change):
1. Remove `onConflict` options from the upsert calls.
2. Before the `records.forEach` loop in `handleConfirm`, call `filterExistingRecords(records)` and only INSERT the returned `newRecords`.
3. Surface the `existingCount` to the user as "skipped as duplicate".

This matches the Zero Data Loss rule (no UPDATE of existing rows) and keeps the fix code-only.

Alternative (needs migration, defer):
Add unique constraints via a new migration `013_import_dedup_constraints.sql`. Risk: may conflict with historical rows that already have dup (date,test_name) pairs -- needs a dedup pass first.

Test coverage: add a test with two imports of the same record to the same Supabase mock and assert the second call results in `existingCount: N, totalSaved: 0`.

## Verification (2026-04-17, IMPL-2)

### Resolution: Option A (code-only, no DB change)
Switched `handleConfirm` to call `filterExistingRecords` before the per-record save loop, then use plain `.insert()` for each new record. All `onConflict` options referenced in the previous code pointed at composite unique constraints that do not exist in the schema (`lab_results(date,test_name)`, `appointments(date,doctor_name)`, `active_problems(name)` or `(problem)`), so they all would have failed at runtime. Dropping them removes the silent failure path.

The `health_profile.section` upsert is preserved because that unique constraint DOES exist (migration 001 line 38).

### Changes applied
- `src/app/api/import/universal/route.ts`:
  - Imports `filterExistingRecords` from `@/lib/import/deduplicator`.
  - At the top of `handleConfirm`, calls `filterExistingRecords(records)`; the save loop iterates only over `newRecords`.
  - Removed `{ onConflict: 'date,test_name' }` from `lab_results` upsert (lab_result case).
  - Removed `{ onConflict: 'name' }` from `active_problems` upsert (condition case); also fixed the column name from `name` to `problem`.
  - Removed `{ onConflict: 'date,doctor_name' }` from `appointments` upsert (appointment case).
  - Removed `{ onConflict: 'date,test_name' }` from `lab_results` upsert (vital_sign case).
  - All four upserts switched to plain `.insert()` since dedup is now handled upstream.
  - Response payload now includes `skippedAsDuplicate: existingCount` for UI surfacing.
- `src/lib/import/deduplicator.ts`:
  - `filterExistingRecords` for the `condition` case switched from `.eq('name', ...)` to `.eq('problem', ...)` to match the real `active_problems` schema -- otherwise the existence check would have always failed silently and imported duplicates.

### Test output
`npx vitest run src/app/api/import/universal/__tests__/column-names.test.ts`:
```
Test Files  1 passed (1)
     Tests  10 passed (10)
```
Includes three tests specifically for this finding: invocation of `filterExistingRecords`, absence of `onConflict` on the three broken tables, and `skippedAsDuplicate` reporting.

### Unresolved
- No DB migration in this session. If the user wants DB-level uniqueness in future, the separate migration 013-style work remains queued (with dedup-first pass). Tracked via `session-2-matrix.md` W3.2.
