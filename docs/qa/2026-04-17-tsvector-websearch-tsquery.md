---
date: 2026-04-17
area: vector-store
status: FIXED (applied live + repo SQL updated)
severity: LOW
verification_method: sql-vs-api
wave: W3.9
fixed_by: orchestrator via Chrome + Supabase SQL editor
---

## Resolution

Applied a plainto-to-OR rewrite (turns out `websearch_to_tsquery` still AND-joins unquoted terms, same defect). Final RPC:

```sql
plain_q := plainto_tsquery('english', query_text);          -- normalize + stem
or_q_text := replace(plain_q::text, ' & ', ' | ');          -- flip AND to OR
tsq := or_q_text::tsquery;
```

Canary verification (before: 0 rows, after: 5 rows):
```
$ curl /rest/v1/rpc/search_health_text -d '{"query_text":"CT Head sinus disease mild scoliosis"}'
rows: 5
  [2026-04-08] imaging   rel=0.5000  CT Head. Indication: Chronic dizziness, left frontal headaches...
  [2026-02-16] imaging   rel=0.2000  EKG Heart. Indication: Cardiac evaluation - tachycardia...
  [2025-12-13] daily_log rel=0.1000  Oura: Sleep score 71, 6.2h sleep...
  [2025-05-31] daily_log rel=0.1000  Oura: Sleep score 75, 7.1h sleep...
  [2026-04-07] imaging   rel=0.1000  XR Chest. Indication: Tachycardia evaluation...
```

The 2026-04-08 CT Head study ranks first as predicted. Secondary matches are plausibly related (other imaging, similar symptom profiles). Repo SQL at `src/lib/migrations/002-vector-store.sql` updated to match live DB.

# Follow-up: upgrade tsvector fallback from to_tsquery to websearch_to_tsquery

## One-sentence finding
The pgSQL `search_health_text` function uses `plainto_tsquery` which AND-joins all tokens, so multi-token queries miss when no single narrative contains every word. Switching to `websearch_to_tsquery` raises recall and is a drop-in change.

## Context
Voyage-backed Layer 3 dense retrieval is now live (~73% of rows embedded). When `VOYAGE_API_KEY` is missing, query-embedding fails, or the embedded column is NULL for a relevant row, `searchByText` falls through to `search_health_text`. That fallback currently uses `plainto_tsquery('english', query_text)`. Example failure: `"CT Head sinus disease mild scoliosis"` returns zero rows because no single narrative contains all five tokens, even though the 2026-04-08 imaging narrative clearly matches most of them.

## Proposed fix
`websearch_to_tsquery` uses quoted phrases + implicit OR for loose tokens + explicit `-` for negation. Drop-in replacement:

```sql
-- Replace this line in src/lib/migrations/002-vector-store.sql (function body):
--   tsq := plainto_tsquery('english', query_text);
-- With:
    tsq := websearch_to_tsquery('english', query_text);
```

## Apply
```sql
CREATE OR REPLACE FUNCTION search_health_text(
  query_text TEXT,
  match_count INT DEFAULT 10,
  filter_date_start DATE DEFAULT NULL,
  filter_date_end DATE DEFAULT NULL,
  filter_type VARCHAR DEFAULT NULL,
  filter_phase VARCHAR DEFAULT NULL,
  filter_min_pain INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content_id VARCHAR,
  content_type VARCHAR,
  content_date DATE,
  narrative TEXT,
  cycle_phase VARCHAR,
  pain_level INT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  tsq tsquery;
BEGIN
  tsq := websearch_to_tsquery('english', query_text);
  RETURN QUERY
  SELECT
    he.id, he.content_id, he.content_type, he.content_date,
    he.narrative, he.cycle_phase, he.pain_level,
    ts_rank_cd(he.narrative_tsv, tsq)::FLOAT AS relevance
  FROM health_embeddings he
  WHERE
    he.narrative_tsv @@ tsq
    AND (filter_date_start IS NULL OR he.content_date >= filter_date_start)
    AND (filter_date_end IS NULL OR he.content_date <= filter_date_end)
    AND (filter_type IS NULL OR he.content_type = filter_type)
    AND (filter_phase IS NULL OR he.cycle_phase = filter_phase)
    AND (filter_min_pain IS NULL OR he.pain_level >= filter_min_pain)
  ORDER BY ts_rank_cd(he.narrative_tsv, tsq) DESC
  LIMIT match_count;
END;
$$;
```

## Verification plan
After applying, the canary query `"CT Head sinus disease mild scoliosis"` should return at least the 2026-04-08 imaging row even when the `embedding` column for that row is NULL. Run by temporarily blanking `VOYAGE_API_KEY` in `.env.local` and hitting `POST /api/context/assemble`.

## Priority
LOW. Only matters for the 27% of rows without embeddings (and only until the backfill completes). Once all 1,196 rows are embedded, the fallback is rarely exercised.
