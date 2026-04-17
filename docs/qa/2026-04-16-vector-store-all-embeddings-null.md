---
date: 2026-04-16
agent: R6
area: vector-store
status: FIXED (Voyage voyage-4 wired; backfill in progress)
severity: MEDIUM
verification_method: sql-vs-api
updated: 2026-04-17
fixed_by: orchestrator + Claude-in-Chrome MCP
---

## Resolution (2026-04-17)

Wired Voyage AI `voyage-4` at 1024-dim as the embedding provider. Voyage is Anthropic's embeddings company (acquired 2024), so this keeps the stack Claude-native.

**Changes landed:**

1. **Schema migration** (applied via Chrome + Supabase SQL editor):
   ```sql
   ALTER TABLE health_embeddings DROP COLUMN embedding;
   ALTER TABLE health_embeddings ADD COLUMN embedding vector(1024);
   DROP FUNCTION IF EXISTS search_health_data(vector, INT, DATE, DATE, VARCHAR, VARCHAR, INT);
   CREATE FUNCTION search_health_data(query_embedding vector(1024), ...);
   ```
   Safe because all 1,196 rows had NULL embedding: no data lost.

2. **`src/lib/context/vector-store.ts`**: replaced OpenAI SDK with direct fetch to Voyage `/v1/embeddings`. `generateEmbedding(text, inputType)` takes `'query'` (default, search-time) or `'document'` (corpus ingestion). `upsertNarrative` passes `'document'`.

3. **`src/lib/migrations/backfill-voyage.mjs`** (new): paginates past Supabase's 1000-row cap, retries 429s with exponential backoff, batch size 64. Two modes:
   - Free tier (3 RPM, 10K TPM): default, ~23 min for 1,196 rows
   - Standard (300 RPM, 1M TPM): `VOYAGE_SPEED_MODE=fast`, ~30 sec; requires payment method on Voyage

4. **Backfill execution**: running at free-tier rate. 255 of 1,196 complete after 5 minutes; projected finish ~02:44 AM. Tokens used ~17K; estimated full-run cost under $0.01 (well inside the 200M/month free tier).

**After backfill completes** (auto-followup):
- Create IVFFlat index: `CREATE INDEX idx_health_embeddings_vector ON health_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);`
- Verify `/api/context/assemble?query=...` returns `retrieval.present: true` for a cross-token semantic query that tsvector previously missed.

**W3.9 still valuable**: switch tsvector fallback from `to_tsquery` to `websearch_to_tsquery`. Even with dense vectors live, the tsvector fallback matters when `VOYAGE_API_KEY` is unset or when Voyage is down.

# Vector store: all 1,196 rows have NULL embedding

## One-sentence finding
Layer 3 semantic search is a dead letter. Every row in `health_embeddings` has `embedding IS NULL`, so `searchByText` always falls through to PostgreSQL full-text instead of pgvector cosine similarity.

## Expected
Per CLAUDE.md: "Layer 3 -- Deep Retrieval (`vector-store.ts`): pgvector semantic search + full-text fallback". With 1,196 indexed rows and an OpenAI `text-embedding-3-small` pipeline in place, the majority of rows should have a 1536-dim embedding vector populated.

## Actual
```
GET /api/context/sync ->
{ "totalNarratives": 1196,
  "withEmbeddings": 0,
  "withoutEmbeddings": 1196,
  ... }
```

Every sampled row from `/api/admin/peek?table=health_embeddings` shows `"embedding": null`.

Consequence: the `hasEmbeddings` check in `src/lib/context/vector-store.ts:222-223` returns false for every query, so the code never generates a query embedding, never calls `search_health_data` (the pgvector RPC), and always uses `search_health_text` (plain tsvector). We verified this reproduces in practice: queries like `"CT Head sinus disease mild scoliosis"` (which should semantically match imaging study 2026-04-08) return NO retrieval at all, because tsquery requires all tokens to match the same record.

## Verification evidence
- `curl http://localhost:3005/api/context/sync` returns `withEmbeddings: 0`.
- Sample rows via `/api/admin/peek`:
  - `day_2022-09-07`: `embedding: null`
  - `day_2022-09-08`: `embedding: null`
  - `day_2024-07-27`: `embedding: null`
- Probe `POST /api/context/assemble { query: "CT Head sinus disease mild scoliosis" }` yields `sections.retrieval.present: false` (no retrieval block in the system prompt). A working semantic search would return the 2026-04-08 imaging narrative which contains every one of those tokens.
- `src/lib/context/vector-store.ts:80-90`: `generateEmbedding` returns null when `OPENAI_API_KEY` is absent or when the OpenAI call fails, and `upsertNarrative` writes the row without the embedding column. No error surfaces -- the sync pipeline reports success even though embeddings were not produced.
- `src/lib/migrations/backfill-embeddings.mjs` exists precisely to backfill rows with NULL embedding, but it has not been run against this database (all rows still NULL).

## Recommended action
- FIX: add `OPENAI_API_KEY` to the environment (`.env.local` for dev, Vercel env for prod). Then run:
  ```
  node --env-file=.env.local src/lib/migrations/backfill-embeddings.mjs
  ```
  That will iterate the 1,196 rows, generate embeddings at `text-embedding-3-small`, and update the column. Expected cost at ~200 tokens/narrative, 1196 rows, $0.02/M tokens = under $0.01.
- FIX: after the backfill completes, create the IVFFlat index that migration 002 documents but leaves manual:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_health_embeddings_vector ON health_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ```
- INVESTIGATE: add a health check / smoke test that fails when `withEmbeddings / totalNarratives < 0.9`, so a future regression does not silently revert us to text-only search.
- INVESTIGATE: the sync pipeline should probably log a `console.warn` once per run when `generateEmbedding` consistently returns null. Right now silent fallback masks configuration gaps.

## Related
- Dream cycle is the usual sync trigger (`src/lib/context/dream-cycle.ts:207-219`) but it also calls `syncDateRange` which calls `upsertNarrativeBatch` which calls `generateEmbedding`. All three paths flow through the same `OPENAI_API_KEY` gate.
