---
date: 2026-04-16
agent: R6
area: vector-store
status: FIXED
severity: MEDIUM
verification_method: api-vs-api
fixed_date: 2026-04-17
fixed_by: IMPL-W2A-9
fixed_in:
  - src/app/api/context/sync-status/route.ts
  - src/lib/context/vector-store.ts
test:
  - src/app/api/context/__tests__/sync-status.test.ts
---

# `/api/context/sync-status` under-reports content types (implicit 1000-row cap)

## One-sentence finding
`sync-status` returns `byType: { daily_log: 1000 }` with no `lab_result` or `imaging` counts, because the query that powers the breakdown is truncated to Supabase's default 1000-row limit.

## Expected
With 1,196 total rows, the breakdown should include every content_type present: daily_log (~1187), lab_result (a few), imaging (at least 5 based on `imaging_studies` row count), and anything else indexed. The numbers should sum to `totalRecords`.

## Actual
```
GET /api/context/sync-status ->
{ "totalRecords": 1196,
  ...
  "byType": { "daily_log": 1000 } }
```

`daily_log: 1000` is a clear tell of a silent Supabase row cap. The aggregation in `src/app/api/context/sync-status/route.ts:56-58` is:

```ts
sb.from('health_embeddings').select('content_type')
```

With no pagination or server-side `group by`. Supabase returns the first 1000 rows by default and discards the rest. That is why:
- `daily_log` appears pegged at exactly 1000
- `lab_result` is missing entirely despite ferritin/metabolic-panel narratives definitely being indexed (verified via retrieval for `"ferritin"` returning four `lab_result` rows)
- `imaging` is missing despite `imaging_studies` having 5 rows and at least two being covered by the sync pipeline (2026-04-08 CT Head, 2026-04-13 MRI Breast appear in retrieval probes)

## Verification evidence
- `curl /api/context/sync-status` returns `{"byType": {"daily_log": 1000}}` (total 1196). The gap of 196 rows is exactly what you would expect from the 1000-cap truncation.
- Cross-check: `curl /api/admin/peek?table=imaging_studies` count = 5. So imaging rows exist in source. They get indexed in `sync-pipeline.ts:510-520`.
- Cross-check via retrieval: `POST /api/context/assemble { query: "2026-04-08" }` returns both `(daily_log)` and `(imaging)` tagged records, proving `imaging` content_type exists in the table even though `byType` hides it.
- The duplicate implementation in `src/lib/context/vector-store.ts:415-431` (`getVectorStoreStats`) has the same bug.

## Recommended action
FIX `src/app/api/context/sync-status/route.ts`. Replace the in-process bucket with a Postgres aggregation. Two options:

Option A - RPC:
```sql
CREATE OR REPLACE FUNCTION health_embeddings_type_counts()
RETURNS TABLE (content_type VARCHAR, count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT content_type, COUNT(*) FROM health_embeddings GROUP BY content_type
$$;
```
Then `sb.rpc('health_embeddings_type_counts')`.

Option B - simple count per type with `head: true`:
```ts
for (const t of ['daily_log', 'lab_result', 'imaging', 'document']) {
  const { count } = await sb.from('health_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('content_type', t)
  byType[t] = count ?? 0
}
```

Option B is zero migrations and strictly read-only. Recommended.

FIX the same defect in `getVectorStoreStats` at `src/lib/context/vector-store.ts:413-433`.

## Related
No data was lost or mis-indexed -- this is purely a status-reporting bug. But it has been masking the absence of `imaging` and `lab_result` in the admin UI, which contributed to the false confidence that the sync was complete.

## Fix applied (2026-04-17, IMPL-W2A-9)

Went with Option B (per-type HEAD queries, zero migrations). Both defect sites patched:

- `src/app/api/context/sync-status/route.ts` -- replaced the capped `.select('content_type')` bucket with a loop over `KNOWN_CONTENT_TYPES = ['daily_log', 'lab_result', 'imaging']`, each issuing `.select('*', { count: 'exact', head: true }).eq('content_type', t)`. The total-record count is emitted from its own independent HEAD query (not a sum) so any future untyped row would still land in `totalRecords`.
- `src/lib/context/vector-store.ts` (`getVectorStoreStats`) -- same pattern.
- `KNOWN_CONTENT_TYPES` tracks `src/lib/context/sync-pipeline.ts` (lines 491, 503, 515). Extend both lists when a new indexer is added.

### Before/after verification (live)

```
# before
GET /api/context/sync-status
{"totalRecords":1196,"byType":{"daily_log":1000}, ...}

# after
GET /api/context/sync-status
{"totalRecords":1196,"byType":{"daily_log":1181,"lab_result":11,"imaging":4}, ...}
```

Sum of byType (1181 + 11 + 4 = 1196) now matches `totalRecords`. `lab_result` and `imaging` are visible.

### Regression test
`src/app/api/context/__tests__/sync-status.test.ts` (3 specs, all green):
1. Asserts no unbounded `.select('content_type')` is issued, and a HEAD count query is issued per known type with the correct `.eq('content_type', t)` filter.
2. Asserts `totalRecords` comes from its own HEAD query (not a sum of byType) so untyped rows cannot silently disappear.
3. Smoke-checks the full payload shape.
