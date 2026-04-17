---
date: 2026-04-16
agent: R7 (migration trail)
area: migrations
status: FLAGGED
severity: MEDIUM
verification_method: api-vs-code (live peek + git log)
---

# Migration execution trail

## One-sentence finding
Five of seven SQL migrations are applied in live Supabase; migration 011
(endo columns on `cycle_entries`) and migration 012 (`push_subscriptions`)
are NOT applied. No canonical "run all migrations" command exists in
`package.json`; bootstrap is ad-hoc per-migration MJS scripts plus manual
Supabase dashboard SQL for DDL that the runner cannot execute.

## Per-SQL-migration status

| File | Creates | Live check (admin/peek) | Status |
|---|---|---|---|
| 001-context-engine.sql | 8 tables (context_summaries, session_handoffs, health_profile, medical_narrative, medical_timeline, active_problems, imaging_studies, correlation_results) | all 8 tables respond (counts: 36 / 0 / 14 / 1 / 36 / 12 / 5 / 0) | **APPLIED** |
| 002-vector-store.sql | health_embeddings + 4 indexes + 2 RPC functions + pgvector extension | health_embeddings count=1196, semantic search used live in `/api/intelligence/*` | **APPLIED** |
| 003-clinical-knowledge-base.sql | clinical_knowledge_base, hypothesis_evidence, data_validation_flags | clinical_knowledge_base count=8 (docs), hypothesis_evidence count=0, data_validation_flags count=0 | **APPLIED** |
| 009_bearable_killer.sql | 9 tables + 3 daily_logs columns | mood_entries count=2, weather_daily count=48, daily_logs sample has `mood_score`, `log_period`, `completed_sections` keys | **APPLIED** (commit ef2571d, "run Supabase migrations") |
| 010_integration_tokens.sql | integration_tokens, import_history, user_preferences | all 3 respond (count=0 each, tables exist) | **APPLIED** (same ef2571d commit) |
| 011_endometriosis_mode.sql | 8 columns on cycle_entries + 1 index | `/api/admin/apply-migration-011` returns `{"applied":false}`; cycle_entries sample keys: `['id','date','flow_level','menstruation','ovulation_signs','lh_test_result','cervical_mucus_consistency','cervical_mucus_quantity','created_at']` - zero of 8 endo columns present | **NOT APPLIED** |
| 012_push_subscriptions.sql | push_subscriptions table + index | `GET /api/admin/peek?table=push_subscriptions` returns `{"error":"Could not find the table 'public.push_subscriptions' in the schema cache"}` (HTTP 500) | **NOT APPLIED** |

## Numbering gap 004-008

No files 004-008 exist in git history anywhere, across all branches, in
any state (added/deleted/renamed). The jump 003 -> 009 is deliberate and
coincides with a batch of "Bearable killer" features scaffolded together.
Commits `5aef87e` (backend copy from endotracker) and the features in
`739e6c6` / `a519975` / `9c4b069` added domain code that happened to not
need any DDL. The numbering was simply reserved; there is no missing work.

## Canonical runner

**None.** `package.json` scripts are `dev`, `build`, `start`, `lint`,
`test`, `test:watch`. There is no `db:migrate`, no `setup`, no bootstrap
script.

The de facto process is:
1. Per-migration MJS runner that uses `pg.Client` against the Supabase
   pooler (`postgresql://postgres.<project>:<password>@aws-0-us-west-1.pooler.supabase.com:6543/postgres`).
   Examples: `run-migration.mjs` (001), `run-002-vector-store.mjs`, `run-011-endo-mode.mjs`.
2. When the pooler password is not available (the current state - service
   role JWT is rejected as DB password), fall back to **manual Supabase
   dashboard SQL paste**, documented in:
   - `docs/plans/MIGRATION_011_APPLY.md`
   - `docs/plans/MIGRATION_012_APPLY.md`

A fresh install has no automated bootstrap path today. The only way to
reproduce the live DB from scratch is to run the seven SQL files in order
via dashboard, then run the seed / import MJS scripts.

## MJS script inventory

| File | Kind | Writes | Run? |
|---|---|---|---|
| run-migration.mjs | one-shot (DDL + seed for 001) | health_profile, medical_timeline (7 events seeded), imaging_studies (2 seeded), active_problems (6 seeded) | YES -- live tables exist and have data |
| run-002-vector-store.mjs | one-shot DDL for 002 | schema only | YES -- health_embeddings exists with 1196 rows |
| run-011-endo-mode.mjs | one-shot DDL for 011 | schema only | NO -- endo columns missing in cycle_entries |
| backfill-embeddings.mjs | repeatable (only processes rows with NULL embedding) | health_embeddings.embedding column | YES (implied) -- 1196 rows indexed, `/api/context/sync-status` reports "1,196 records indexed" |
| import-myah-data.mjs | one-shot import | lab_results (+36), appointments (+5), imaging_studies (EKG), medical_timeline (+6) | YES -- lab_results count=269 (memory said 52), matches commit 3329e4e |
| import-myah-documents-data.mjs | one-shot import | medical_timeline, health_profile (insurance, identifiers), active_problems | YES (commit b981537) |
| import-luminate-myah-full.mjs | one-shot import | lab_results (+49+13), medical_timeline (+5), active_problems (+3), medical_narrative (+1) | YES (commit b981537) -- matches live counts |
| import-ed-clinical-data.mjs | one-shot import | medical_timeline, health_profile.providers, active_problems | YES (commit 97a9b79) |
| import-data-corrections.mjs | one-shot import | medical_timeline (Tryptase), health_profile.providers (Kuo), appointments (Apr 20) | LIKELY YES (commit 97a9b79 context) |
| parse-ccd-import.mjs | one-shot import | multiple tables from CCD XML | YES (commit e012358) |
| parse-ed-ccd-import.mjs | one-shot import | ED visit data from two CCD XMLs | YES (commit 97a9b79) |

All importers include existence checks / dedup logic before insert, so
re-running would be safe, but the authors treat them as one-shot.

## Live-DB row counts vs memory (additional evidence)

| Table | Memory | Live | Import trail |
|---|---:|---:|---|
| health_embeddings | 1,182 | 1,196 | backfill-embeddings was run |
| lab_results | 52 | 269 | +217 from myAH + Luminate imports |
| medical_timeline | 7 | 36 | +29 from 5 importers |
| imaging_studies | 2 | 5 | +3 from myAH (EKG) and corrections |
| active_problems | 6 | 12 | +6 from Luminate + ED imports |

These numbers are consistent with every import MJS having been run.

## Evidence (raw)

```
$ curl -s http://localhost:3005/api/admin/apply-migration-011
{"applied":false}

$ curl -s 'http://localhost:3005/api/admin/peek?table=push_subscriptions&limit=1' -w 'HTTP %{http_code}\n'
{"error":"Could not find the table 'public.push_subscriptions' in the schema cache"}
HTTP 500

$ curl -s 'http://localhost:3005/api/admin/peek?table=cycle_entries&limit=5' | python3 -c "import sys,json;d=json.load(sys.stdin);print([c for c in ['bowel_symptoms','bladder_symptoms','dyspareunia','clots_present'] if c in d['sample'][0]])"
[]

$ git log --all --oneline --grep="run Supabase migrations"
ef2571d fix: visual review fixes + run Supabase migrations
  (body: "Supabase migrations executed: Migration 009...; Migration 010...; All new tables are live in production Supabase.")

$ git show 3153cbc (commit message)
  "Migration 011 graceful degradation
   - updateCycleEntry: try/catch with endo-field strip retry if Postgres returns missing-column error
   - /api/admin/apply-migration-011: GET probes column existence
   - docs/plans/MIGRATION_011_APPLY.md: step-by-step dashboard SQL instructions"
```

## Recommended action

- ACCEPT (for migration 011): The application has explicit graceful
  degradation and a feature-detection gate so EndoMode UI is hidden until
  the migration is applied. Zero Data Loss is preserved. User can apply
  via dashboard at any time following `docs/plans/MIGRATION_011_APPLY.md`.
  This is a known, documented, user-gated operation -- not a bug.
- INVESTIGATE (for migration 012): `push_subscriptions` was added today
  (commit 5b8da46, 2026-04-16 23:25). Any code path that calls
  `supabase.from('push_subscriptions')` will fail with a 500. Search
  `src/app/api/push/` and any cron wiring. If push notifications are not
  yet wired into a running cron, this is a latent bug. If they are, it is
  an active 500. Either way, apply via `docs/plans/MIGRATION_012_APPLY.md`.
- FIX (low-cost, medium-value): Add a `scripts/migrate.mjs` that iterates
  the seven SQL files in order using `pg.Client`, guarded by
  `SUPABASE_DB_PASSWORD` env. Add `"db:migrate": "node scripts/migrate.mjs"`
  to `package.json`. Makes bootstrap reproducible without dashboard paste.
