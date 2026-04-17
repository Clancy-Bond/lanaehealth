---
date: 2026-04-16
agent: R6
area: vector-store
status: FAIL
severity: MEDIUM
verification_method: api-vs-api
---

# Text-search fallback returns stale dates with no recency boost

## One-sentence finding
Because the vector layer has zero embeddings and always falls through to `search_health_text`, generic queries like `"sleep HRV"` return 2023 records only and skip 2026, feeding outdated context into Claude.

## Expected
For a query about a currently-tracked biometric ("sleep HRV"), the retrieval layer should surface recent readings (April 2026) over three-year-old ones, all else equal. Vector cosine similarity would not bias on recency either, but the practical mitigation for per-day narrative chunks is usually a small recency kicker on top of whatever relevance score wins.

## Actual
`POST /api/context/assemble { query: "sleep HRV" }` returns 8 retrieval rows, all from 2023:
```
[2023-05-13], [2023-05-30], [2023-03-06], [2023-03-13],
[2023-02-05], [2023-05-27], [2023-01-12], [2023-07-23]
```

The 2023 rows simply have more co-occurring tokens (`sleep`, `HRV`, plus long Oura blocks) and win on `ts_rank_cd`. Meanwhile `day_2026-04-13` (which also contains "Sleep score 77, ... HRV 81ms") never surfaces.

## Verification evidence
- Query probe: `POST /api/context/assemble { query: "sleep HRV" }` with `sections.retrieval.present = true` but all 8 dates in `<retrieved_records>` are from 2023.
- Implementation:
  - `src/lib/migrations/002-vector-store.sql:115-141`: `search_health_text` ranks purely by `ts_rank_cd(narrative_tsv, tsq) DESC`. No `content_date` term in the scoring expression.
  - `src/lib/context/vector-store.ts:278-294`: thin wrapper, no client-side re-ranking.
- This combines with finding #1 (all embeddings NULL) to produce a Layer 3 that works but systematically prefers old data.

## Recommended action
FIX: change the ranking in `search_health_text` to apply a recency half-life. Keeps it a cheap SQL change, no migrations needed since we already `CREATE OR REPLACE` the function:

```sql
-- Half-life of ~1 year; tune as desired
ORDER BY
  ts_rank_cd(he.narrative_tsv, tsq) *
  exp(-GREATEST(0, (CURRENT_DATE - he.content_date)) / 365.0) DESC
```

Alternatively, oversample then re-rank in Node:

```ts
const rawResults = await sb.rpc('search_health_text', {...})
// Blend relevance with recency in JS
return rawResults
  .map(r => ({...r, score: r.relevance * Math.exp(-daysAgo(r.content_date)/365)}))
  .sort((a,b) => b.score - a.score)
  .slice(0, matchCount)
```

The SQL variant is one line, wins on clarity, and is what I'd recommend.

## Caveat
This finding becomes much less important once finding #1 is fixed. Vector cosine on 1536-dim embeddings is better at picking up the 2026-04 HRV record because the semantic embedding captures "recent HRV reading" vs "historical Oura dump" more naturally than tsvector does. But the recency kicker is still worth adding for the fallback path and the edge cases where `OPENAI_API_KEY` isn't available (dev/offline).
