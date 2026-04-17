---
date: 2026-04-16
agent: R6
area: vector-store
status: FAIL
severity: HIGH
verification_method: sql-vs-api + static-analysis
---

# Vector store integrity audit (Layer 3)

## TL;DR
Layer 3 is degraded. The `health_embeddings` table contains 1,196 rows but every single row has `embedding = NULL`. The advertised pgvector cosine-similarity search is never exercised in production. The assembler silently falls through to PostgreSQL full-text search (`to_tsvector('english', ...)`), which works but has three serious quality problems: (1) no recency bias, (2) zero results for many natural-language queries that a semantic search would answer, and (3) `sync-status.byType` is truncated by Supabase's 1000-row default cap and under-reports content type counts.

## Evidence

### 1. Row counts and source cardinality
- `/api/admin/peek?table=health_embeddings` count = **1,196**
- `/api/context/sync` stats:
  ```json
  { "totalNarratives": 1196, "withEmbeddings": 0, "withoutEmbeddings": 1196,
    "dateRange": { "earliest": "2022-09-02", "latest": "2026-04-16" },
    "byType": { "daily_log": 1000 } }
  ```
- Expected counts vs source:
  - `daily_logs` = 1,490; `oura_daily` = 1,190; `nc_imported` = 1,490
  - Chunks are **per-day UNION** of all three (plus cycle/food/pain/symptoms). See `src/lib/context/sync-pipeline.ts:456` (`allDates = Set of every date that appears in ANY source`).
  - Empty days are skipped (`buildDayNarrative` returns null) so 1,196 < 1,490 is expected.
  - Lab results indexed per-date with `content_id = lab_<date>`, imaging indexed per-study. Confirmed via retrieval probe: `lab_result` and `imaging` types exist in the table, they just don't show in `byType` because of bug #2 below.

### 2. Embedding model and dimensions
- Model: `text-embedding-3-small` (OpenAI), `dimensions: 1536`, truncation at 8000 chars.
- Source: `src/lib/context/vector-store.ts:82` and `src/lib/migrations/backfill-embeddings.mjs:42`.
- Schema: `embedding vector(1536)` in `src/lib/migrations/002-vector-store.sql:17`.
- Graceful fallback: if `OPENAI_API_KEY` is missing or the call fails, `generateEmbedding` returns null and the row is stored with a NULL embedding. This fallback is working; however it has never been reversed: zero rows have embeddings populated.

### 3. Chunk boundary logic
- Daily log chunks: ONE narrative per calendar date, content_id = `day_YYYY-MM-DD`, content_type = `daily_log`. Merges daily_logs + oura_daily + symptoms + food_entries + cycle_entries + nc_imported + pain_points into a single narrative per day.
- Lab chunks: ONE per lab draw date, content_id = `lab_YYYY-MM-DD`, content_type = `lab_result`.
- Imaging chunks: ONE per study, content_id = `img_<date>_<modality>_<body_part>`, content_type = `imaging`.
- No documents or appointments indexed despite schema allowing them.

### 4. Metadata shape (matches CLAUDE.md)
Schema in migration 002 and populated in sync-pipeline:
- `content_date DATE`
- `content_type VARCHAR(30)` (daily_log, lab_result, imaging)
- `cycle_phase VARCHAR(20)` - populated from daily_logs.cycle_phase only
- `pain_level INT` - populated from daily_logs.overall_pain or max(pain_points.intensity)
- `has_period BOOLEAN`
- `symptom_categories TEXT[]`
Indexed via btree on date, type, phase, pain_level. Full-text GIN on a STORED generated tsvector (`narrative_tsv`).

### 5. Text-search fallback behavior
`searchByText` in vector-store.ts:210-236:
- First checks `SELECT count(*) WHERE embedding IS NOT NULL`. Currently 0.
- Because `hasEmbeddings = false`, it skips the vector branch entirely and calls `search_health_text` RPC (full-text).
- On RPC error, falls back to `recentEntries` (just the most recent rows matching filters, no query).
- Fall-through is structurally correct but means the vector layer is pure text search today.

### 6. Integrity spot-checks (known dates)
- `"2026-04-08"` query -> returns `day_2026-04-08 (daily_log)` AND `img_2026-04-08_ct_head (imaging)`. Imaging narrative includes "CT Head ... chronic sinus disease ... mild scoliosis ...".
- `"2026-04-13"` query -> returns daily_log, lab_result (Ferritin 50.4 etc.), imaging (MRI Breast order).
- `"ferritin"` query -> 4 lab_result dates: 2025-12-11, 2025-12-31, 2026-02-19, 2026-04-13. Good recall.
- `"CT Head sinus disease mild scoliosis"` -> NO RETRIEVAL BLOCK. Multi-word tsquery AND-semantics fail when any token is absent. A true semantic search would have returned the CT imaging row.
- `"sleep HRV"` -> only 2023 results, no 2026. Confirms lack of recency bias.

### 7. Sync pipeline health
- No Vercel cron targets `/api/context/sync` or `/api/context/dream`. The three cron entries in `vercel.json` are: `/api/sync` (integration FHIR sync), `/api/weather`, `/api/push/send`. Dream cycle is manual-trigger only (from Settings UI).
- Newest `updated_at` on sampled rows is 2026-04-16T09:51Z. So something IS running sync (probably the manual Dream Cycle button was pressed today) but it still produces NULL embeddings because the OpenAI path is not reachable or `OPENAI_API_KEY` is absent in the deployment.
- `created_at` on 2022-2024 rows is 2026-04-13T05:13Z, consistent with one initial `/api/context/sync` full backfill on that date.

## Findings

### F1 [HIGH] Zero embeddings populated; vector search is not actually running
All 1,196 rows have `embedding = NULL`. Every search goes through the text-search fallback. See [2026-04-16-vector-store-all-embeddings-null.md](../2026-04-16-vector-store-all-embeddings-null.md).

### F2 [MEDIUM] `/api/context/sync-status` undercounts content types because of the implicit 1000-row Supabase cap
The route does `select('content_type').from('health_embeddings')` without pagination. Supabase capped it at 1000 rows, so `byType: { daily_log: 1000 }` hides every `lab_result` and `imaging` record. See [2026-04-16-sync-status-type-count-capped.md](../2026-04-16-sync-status-type-count-capped.md).

### F3 [MEDIUM] Text-search fallback has no recency bias
`ts_rank_cd` ranks by term density, not date. Simple queries like `"sleep HRV"` return 2023 records and skip 2026, meaning the retrieval layer can feed stale context into Claude prompts even when the patient's recent story is different. See [2026-04-16-vector-text-search-no-recency.md](../2026-04-16-vector-text-search-no-recency.md).

### F4 [LOW] IVFFlat vector index never created
Migration 002 explicitly leaves the `ivfflat` index as a manual step (comment at lines 41-45). Even if embeddings were populated, no cosine-similarity index exists, so searches would do a full sequential scan (fine at 1200 rows, painful once the dataset grows).

### F5 [LOW] Dream cycle is the only sync trigger, but it only syncs the last 30 days
`runDreamCycle` calls `syncDateRange(thirtyDaysAgo, today)`. Anything older than 30 days that gets a late-arriving row (e.g., a backfilled lab or imported Oura day) never gets re-indexed unless a user clicks "Full sync". Not urgent but worth noting.

## Recommended actions
- FIX (high): run `src/lib/migrations/backfill-embeddings.mjs` once `OPENAI_API_KEY` is in the environment. That populates all 1,196 rows, after which vector search starts working.
- FIX (medium): rewrite `byType` aggregation in `sync-status/route.ts` to use a SQL `group by` RPC (or paginate) so it reports accurate counts.
- FIX (medium): apply the `IVFFlat` index once embeddings exist.
- FIX (low): add a recency half-life boost into `search_health_text` (e.g., `relevance * exp(-age_days/365)`).
- INVESTIGATE: schedule `/api/context/dream` on a daily Vercel cron so fresh data is indexed automatically.
