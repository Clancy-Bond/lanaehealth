---
date: 2026-04-16
status: FIXED (code path) -- DATA REFRESH STILL DEFERRED
fixed_by: IMPL-W2B-3 (2026-04-17)
severity: MEDIUM
areas: [correlations, patterns, doctor-report]
depends_on: Wave 3 migration to add unique index on (factor_a, factor_b, correlation_type, lag_days)
---

# Finding: `correlation_results` table is empty

## Repro
`curl "http://localhost:3005/api/admin/peek?table=correlation_results"` → `{"count":0,"sample":[]}`

## Expected
Memory claims "6 patterns (4 strong, 1 moderate, 1 suggestive)" are available. The `/patterns` page and the doctor report consume `correlation_results`.

## Actual
Zero rows. Every downstream consumer that reads `correlation_results` currently renders the "no correlations yet" path.

## Root cause
The correlation pipeline is only triggered via `POST /api/analyze/correlations`, which is compute-heavy (Spearman + Mann-Whitney + FDR correction, `maxDuration = 120`) and does NOT run automatically. Either:
1. It was never run in this Supabase instance, or
2. It was run previously and the rows were purged.

The earlier `endotracker-lanae` app may have been the prior runner, but we share a DB so the table should be shared.

## Downstream consumers (verified graceful)
- `/api/intelligence/food-symptoms` → returns `"correlations":[], "totalTriggers":8, "daysAnalyzed":257` - the food-symptom correlator does its own computation, not reading `correlation_results`. OK.
- `/api/reports/doctor` → 200, top-level payload present. `correlation_results` is consulted for the "Key patterns" section.
- `/api/log/prefill` → returns `insight: null` - graceful.
- `/patterns` page → renders 200.

## Recommendation
Run the pipeline once manually to populate the table, then set up a daily cron (dream-cycle or scheduled-tasks) to refresh:

```bash
curl -X POST http://localhost:3005/api/analyze/correlations
```

This will take ~2 minutes and write rows back to `correlation_results`. Skipped during this QA pass because it is a non-trivial compute with Claude API cost implications — user approval required before triggering.

## Verification
Not performed (intentional skip). After triggering, re-run admin peek and verify `count > 0` and specific strong correlations map to the memory-documented findings.

## Fix summary (2026-04-17, IMPL-W2B-3)

Root-cause mitigation: the pipeline no longer wipes the table before writing.

- `src/lib/ai/correlation-engine.ts` (~lines 770-895): removed the
  `.delete().not('computed_at','is',null)` call and the subsequent chunked
  `.insert()` loop. Replaced with a single batched `.upsert(batch, { onConflict: 'factor_a,factor_b,correlation_type,lag_days', ignoreDuplicates: false })` path, plus a defensive fetch-then-patch fallback scoped to PostgREST `42P10` / `PGRST*` / `23505` error codes, so the pipeline can still refresh rows if the unique index is not present.
- `src/app/api/analyze/correlations/route.ts`: response now includes `upsertedCount` and `newCount`, so the Patterns page can render "refreshed N findings" vs "computed fresh N findings".
- `src/app/api/analyze/__tests__/correlations-upsert.test.ts`: vitest with a mocked Supabase store asserts:
  - pre-existing row `(pain, weather, spearman, lag=0)` with coefficient 0.3 is overwritten to 0.4 after upsert (one row, not two)
  - `runCorrelationPipeline()` never calls `.delete()` on `correlation_results`
  - response shape carries `upsertedCount` and `newCount`
  - the fallback path restores fresh coefficients when the upsert returns a missing-constraint error

Test suite: 334 passed, 2 pre-existing failures unchanged (phase-insights diet-word lint, anovulatory-detection cycle count).

## Verification dependency (Wave 3)

The native upsert path requires a UNIQUE index on `(factor_a, factor_b, correlation_type, lag_days)` to succeed. That DDL cannot be added in this QA session (read-only DB contract). Until the Wave 3 migration lands, the runtime will fall through to the fetch-then-patch fallback on each batch. Correctness is preserved in either mode, but the fallback is slower. See Wave 3 work item in `session-2-matrix.md` (add the matching index under W3.x before triggering the first live correlation run).
