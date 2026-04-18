---
date: 2026-04-17
area: vector-store, deployment
status: FLAGGED -- needs Vercel env var added
severity: MEDIUM
verification_method: sql-vs-api
---

# Vercel prod missing VOYAGE_API_KEY (new narratives land without embeddings)

## One-sentence finding
`/api/context/sync` in production ingests new narratives with `embedding IS NULL` because `VOYAGE_API_KEY` is not in Vercel's production environment variables; only the local `.env.local` has it.

## Repro
After Session 5 closed with 1196/1196 embedded, triggered a fresh sync:
```bash
$ curl -X POST https://lanaehealth.vercel.app/api/context/sync
{"synced":98,"stats":{"totalNarratives":1198,"withEmbeddings":1196,"withoutEmbeddings":2,...}}
```

Inspection of the 2 NULL rows:
```json
{"content_id":"day_2026-04-17","content_type":"daily_log","updated_at":"2026-04-18T02:40:36"}
{"content_id":"day_2026-04-18","content_type":"daily_log","updated_at":"2026-04-18T02:40:36"}
```

Both are today's and yesterday's daily narratives. `upsertNarrative` in `src/lib/context/vector-store.ts` calls `generateEmbedding(narrative, 'document')` which returns null when `VOYAGE_API_KEY` is absent, then writes the row without an embedding column.

## Impact
- Daily drift: each day's new narrative lands NULL, silently degrading Layer 3 coverage over time.
- Manual remediation needed: `npm run embed:backfill` catches stragglers, but only if someone remembers to run it.

## Temporary mitigation (applied now)
Ran `npm run embed:backfill` locally. The 2 NULL rows are now embedded (1198/1198 covered).

## Permanent fix
Add `VOYAGE_API_KEY` to Vercel production env:
1. Dashboard: https://vercel.com/clancy-bonds-projects/lanaehealth/settings/environment-variables
2. Add: name=`VOYAGE_API_KEY`, value=the key from `.env.local`, scope=Production
3. Redeploy (or wait for next push)

After that, `upsertNarrative` will embed on write, drift is zero, and `npm run embed:backfill` only needs running if the embedding service had an outage.

## Additional follow-up
Consider a nightly cron (or the existing dream-cycle route) that runs `embed:backfill` as a belt-and-suspenders safety net against temporary 429s or outages.
