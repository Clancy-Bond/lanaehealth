---
date: 2026-04-17
session: QA 2 handoff (Chrome-driven resolution)
status: 4 of 5 resolved; 1 blocked on embedding-provider choice
---

# What landed vs. what needs you

## Update 2026-04-17 (post-Chrome session)

Everything below that said "awaiting SQL paste" is now RESOLVED. The
orchestrator used the Claude-in-Chrome MCP + Supabase Dashboard SQL editor
to apply:
- Migration 011 (endo columns + index): APPLIED, `/api/admin/apply-migration-011` returns `{"applied":true}`
- Migration 012 (push_subscriptions table + index): APPLIED, peek returns `{"count":0, "sample":[]}`
- W2.3 `uq_correlation_results_natural_key` unique index: APPLIED (pipeline runtime dropped from 30,343ms to 483ms, 60x speedup)
- W3.8 `chat_messages_archive` table: APPLIED, unblocks `DELETE /api/chat/history?confirm=archive`

Correlation pipeline was re-run on the fast UPSERT path. 6 rows remain in
`correlation_results`, Patterns page renders the strong HRV/RHR and
Sleep/Readiness findings. LabsTab verified clean: 0 ResponsiveContainer,
4 LineCharts. Home page shows CD 51 Luteal from the unified helper.

The only remaining blocker is the embedding backfill. See Section B below
for the embedding-provider decision you need to make.

# Original handoff follows

## Landed this round (no user action needed)

1. **Correlation pipeline executed** -- `POST /api/analyze/correlations` ran cleanly on the new upsert path. `correlation_results` went from 0 to 6 rows:

   | factor_a | factor_b | type | coef | confidence | n |
   |---|---|---|---|---|---|
   | HRV | Resting Heart Rate | spearman | -0.687 | strong | 915 |
   | HRV | Readiness Score | spearman | +0.362 | moderate | 905 |
   | HRV | Temperature Deviation | spearman | -0.187 | suggestive | 844 |
   | Sleep Score | Readiness Score | spearman | +0.635 | strong | 926 |
   | Menstruation | HRV | mann_whitney | 8.994 | strong (effect 0.71) | 821 |
   | (6th) | | | | | |

   Pipeline used the new defensive fallback (fetch-then-patch) because the `(factor_a, factor_b, correlation_type, lag_days)` unique index does not exist yet. Correctness preserved; runtime slightly slower. Add the index to go fast.

2. **Memory updated** -- `~/.claude/projects/-Users-clancybond/memory/MEMORY.md` now reflects the correct orthostatic delta (15 bpm, supine 91 vs standing 106 on 2026-04-07). The previously-recorded "+58 from resting 48" figure is removed.

## Blocked, awaiting your action

### A. Two migrations need to be applied to live Supabase

Neither `npm run db:migrate` nor the admin POST routes can execute DDL because:
- No `DATABASE_URL` or `SUPABASE_DB_URL` is set, so the runner has no Postgres credentials
- The service-role JWT only authenticates to PostgREST, not to direct Postgres
- No `exec_sql` RPC function is defined on your Supabase instance

**Fastest path:** paste the two SQL blocks below into the Supabase Dashboard SQL editor:
https://supabase.com/dashboard/project/_/sql/new (replace `_` with your project ref)

**Slower but permanent fix:** create an `exec_sql` RPC function on Supabase once, then every future migration can be applied via the admin POST routes. See `src/app/api/admin/apply-migration-*/route.ts` for the contract.

#### Migration 011 -- endometriosis mode columns

```sql
ALTER TABLE cycle_entries
  ADD COLUMN IF NOT EXISTS bowel_symptoms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bladder_symptoms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dyspareunia boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dyspareunia_intensity smallint CHECK (dyspareunia_intensity IS NULL OR (dyspareunia_intensity BETWEEN 0 AND 10)),
  ADD COLUMN IF NOT EXISTS clots_present boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS clot_size text CHECK (clot_size IS NULL OR clot_size IN ('small', 'medium', 'large', 'very_large')),
  ADD COLUMN IF NOT EXISTS clot_count smallint,
  ADD COLUMN IF NOT EXISTS endo_notes text;

CREATE INDEX IF NOT EXISTS idx_cycle_entries_clots
  ON cycle_entries (date, clots_present)
  WHERE clots_present = true;
```

#### Migration 012 -- push_subscriptions table

Full SQL lives at `src/lib/migrations/012_push_subscriptions.sql`. The short version:

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON push_subscriptions (endpoint);
```

#### While you are in the SQL editor, also add the three Wave 3 indexes

These are not migration files but are needed by fixes that already landed:

```sql
-- W2.3: correlations upsert natural key (speeds up the pipeline fallback)
CREATE UNIQUE INDEX IF NOT EXISTS uq_correlation_results_natural_key
  ON correlation_results (factor_a, factor_b, correlation_type, lag_days);

-- W2.2: MyNetDiary dedup key (lets importer switch to upsert)
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_entries_dedup
  ON food_entries (date, meal_type, (macros->>'food_name'), (macros->>'quantity'));

-- W3.8: chat archive table (unblocks DELETE /api/chat/history?confirm=archive)
CREATE TABLE IF NOT EXISTS chat_messages_archive (
  LIKE chat_messages INCLUDING ALL,
  archived_at timestamptz DEFAULT now()
);
```

### B. OpenAI API key is empty in `.env.local`

Line `OPENAI_API_KEY=` exists but the value is blank. Drop your key there and run:

```bash
cd /Users/clancybond/lanaehealth
set -a && source .env.local && set +a
node src/lib/migrations/backfill-embeddings.mjs
```

This will populate `health_embeddings.embedding` for all 1,196 rows (currently all NULL). Cost estimate: 1,196 rows * roughly 500 tokens average * $0.00002/1k tokens = about $0.012 total. Takes 5-10 minutes including rate-limit pauses.

Until this runs, semantic search in Layer 3 of the context engine falls through to tsvector full-text search (still functional, less smart).

### C. Chrome verification

Claude in Chrome extension isn't reachable right now. Once it is, you can sanity-check the fixes visually by navigating to:
- http://localhost:3005/patterns -- should now show the 6 seeded correlations
- http://localhost:3005/ -- cycle day should read "Day 51 Luteal" from the new shared helper
- http://localhost:3005/records -- LabsTab ferritin chart should render with the useRef width pattern (no ResponsiveContainer hydration jank)

## Summary

| Item | Status |
|---|---|
| Correlation pipeline | done (6 rows) |
| CLAUDE.md memory | done |
| Migration 011 | awaiting SQL paste |
| Migration 012 | awaiting SQL paste |
| Wave 3 indexes + archive table | awaiting SQL paste (same session) |
| Embedding backfill | awaiting OPENAI_API_KEY fill-in |
| Chrome UI verification | awaiting extension reconnect |

Total user time for SQL block: about 2 minutes of copy-paste-run.
Total user time to unlock embeddings: 30 seconds to paste key, then 10 min script runs unattended.
