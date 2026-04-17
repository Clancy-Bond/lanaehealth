---
date: 2026-04-16
status: UNFIXED (data, not code)
severity: MEDIUM
areas: [correlations, patterns, doctor-report]
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
