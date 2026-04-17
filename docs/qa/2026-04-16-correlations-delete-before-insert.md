---
date: 2026-04-16
agent: R5
area: mutations
status: FLAGGED
severity: HIGH
verification_method: static-analysis
---

# `POST /api/analyze/correlations` blanket-deletes prior results before re-insert with no transaction

## One-sentence finding
The correlation pipeline deletes every row in `correlation_results` (where `computed_at IS NOT NULL`) before inserting the new batch, so a mid-run failure leaves the Patterns page and doctor report empty.

## Expected
Either:
(a) compute the new batch first, then atomically swap (staging table + rename, or `WITH new AS (INSERT ...) DELETE FROM correlation_results WHERE id NOT IN (SELECT id FROM new)`), or
(b) upsert by a composite natural key `(factor_a, factor_b, correlation_type, lag_days, cycle_phase)` so old rows are replaced row-by-row without a destructive window.

## Actual
`src/lib/ai/correlation-engine.ts` lines 770-800:

```ts
const deleteResult = await supabase
  .from('correlation_results')
  .delete()
  .not('computed_at', 'is', null)

...
// Insert new batch (chunk to avoid payload limits)
const chunkSize = 50
for (let i = 0; i < allCorrelations.length; i += chunkSize) {
  ...
}
```

No transaction. If Claude hits a rate limit or the network blips between chunks, the table is left partially filled or empty. Session 1 already recorded `correlation_results` at 0 rows live, which is consistent with this pattern having failed at some point.

## Verification evidence
Static read of `runCorrelationPipeline`. The delete runs unconditionally before the insert loop.

## Recommended action
- FIX (safest): compute the new array fully in memory, then in a single RPC or supabase-edge-function wrap `DELETE + INSERT` in a SQL transaction.
- FIX (pragmatic): add a composite unique constraint and switch to `upsert` with `onConflict` on `(factor_a, factor_b, correlation_type, lag_days)`. Old rows that no longer correlate get pruned with a separate `WHERE computed_at < <this run start>` DELETE after the upserts succeed.
