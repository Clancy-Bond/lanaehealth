---
date: 2026-04-16
agent: R7
area: migrations
status: FLAGGED (ACCEPTED -- graceful degradation in place)
severity: LOW
verification_method: api-vs-code
---

# Migration 011 (endometriosis mode) not applied in live DB

## One-sentence finding
The 8 endo-specific columns that migration 011 adds to `cycle_entries` are
absent in live Supabase, but the application knows this and degrades
gracefully; no data loss, no user-visible 500s.

## Expected
After running `src/lib/migrations/011_endometriosis_mode.sql`,
`cycle_entries` has columns: `bowel_symptoms`, `bladder_symptoms`,
`dyspareunia`, `dyspareunia_intensity`, `clots_present`, `clot_size`,
`clot_count`, `endo_notes`, plus an index `idx_cycle_entries_clots`.

## Actual
`/api/admin/apply-migration-011` returns `{"applied":false}`. A sample row
from `/api/admin/peek?table=cycle_entries` has only the pre-migration
columns: `id, date, flow_level, menstruation, ovulation_signs,
lh_test_result, cervical_mucus_consistency, cervical_mucus_quantity,
created_at`.

## How to verify

```bash
# 1. Ask the app's own detector:
curl -s http://localhost:3005/api/admin/apply-migration-011
# Expect: {"applied":false} today, {"applied":true} after fix

# 2. Directly inspect columns:
curl -s 'http://localhost:3005/api/admin/peek?table=cycle_entries&limit=1' \
  | python3 -c "import sys,json; row=json.load(sys.stdin)['sample'][0]; print(sorted(row.keys()))"
# Expect the 8 endo columns to appear after fix
```

## Mitigations already in the codebase

1. `updateCycleEntry` in `src/lib/db/cycle.ts` (per commit 3153cbc message)
   catches Postgres "missing column" errors and retries with endo fields
   stripped.
2. `CycleCard` renders `EndoMode` only when
   (a) user has endometriosis in `user_preferences.conditions` AND
   (b) `GET /api/admin/apply-migration-011` reports `applied: true`.
3. `/api/admin/apply-migration-011` POST attempts `exec_sql` RPC and, if
   unavailable (Supabase default), returns the SQL payload with
   `manual_action_required: true`.
4. `docs/plans/MIGRATION_011_APPLY.md` documents two paths: dashboard SQL
   paste (30 seconds) or local runner with `SUPABASE_DB_PASSWORD`.

## Recommended action
- ACCEPT for now. The design-decisions.md rule "Zero Data Loss" is upheld.
  Users with endometriosis simply do not see the EndoMode UI until the
  migration is applied.
- OPTIONAL: when user is ready, paste the SQL from `MIGRATION_011_APPLY.md`
  into Supabase dashboard. Post-apply, verify with the two commands above.

## Resolution (2026-04-17, IMPL-W3-1)

A canonical migration runner now exists at `scripts/migrate.mjs`, wired
into `package.json` as `npm run db:migrate`. It reads every SQL file in
`src/lib/migrations/` in alphanumeric order, tracks applied files in a
`schema_migrations` table, and skips already-applied files on re-run.
Running it against the live DB (with `SUPABASE_DB_URL` or `DATABASE_URL`
in env) will apply this pending migration among others. The runner was
**not** executed against the live DB in this session; that action is
still user-gated. The graceful degradation described above remains in
place until the runner is invoked.
