---
date: 2026-04-16
session: QA pass 2
research_agents: 7
total_findings: 25
status: wave-1 dispatched
---

# Session 2 Ranked Implementation Matrix

Synthesized from all 7 research docs. Ranked by safety (easy to fix without side effects) * impact (how much it breaks).

## Totals
- HIGH: 15 findings
- MEDIUM: 8 findings
- LOW: 5 findings
- UNFIXED from Session 1: 3 (cycle-intelligence nc_imported, correlation pipeline re-run, dizziness topic)

## Wave 1 -- SAFE, CODE-ONLY (dispatched in parallel, one worktree each)

| # | Fix | File | Agent |
|---|---|---|---|
| W1.1 | `src/lib/ai/analyze.ts:10` uses deprecated `claude-sonnet-4-20250514` -- update to `claude-sonnet-4-6` | single file | IMPL-1 |
| W1.2 | Universal importer writes to non-existent `medical_timeline.date` at 5 sites (lines 142, 207, 222, 253, 267) | `src/app/api/import/universal/route.ts` | IMPL-2 |
| W1.3 | Sleep-stages endpoint queries wrong oura column names (`sleep_total` etc. vs actual `sleep_duration`, `deep_sleep_min`, `rem_sleep_min`) | `src/app/api/oura/sleep-stages/route.ts` | IMPL-3 |
| W1.4 | Cycle-intelligence ignores `nc_imported.menstruation` -- fold into menstrualDays using `'MENSTRUATION'` only (not SPOTTING) | `src/lib/ai/cycle-intelligence.ts` | IMPL-4 |
| W1.5 | Dizziness topic detection missing keywords -- add `dizzy, dizziness, lightheaded, presyncope, near-faint` to `cv_orthostatic` and `neuro_presyncope` | `src/lib/context/summary-prompts.ts` | IMPL-5 |

All wave-1 fixes: clear single-file scope, no DB mutation, independent of each other (no file conflicts), each ships with a vitest regression test.

## Wave 2 -- NEEDS DESIGN CHOICE (serial, one at a time, orchestrator plans each)

| # | Fix | Design question |
|---|---|---|
| W2.1 | Cycle-day unification (home=27, prefill=47, intelligence=51 all for same day) | FIXED (IMPL-W2B-1, 2026-04-17) -- built `src/lib/cycle/current-day.ts` shared helper; home + prefill now delegate; all three endpoints now report CD 51 on 2026-04-17. New vitest at `src/lib/__tests__/cycle/current-day.test.ts` (7 fixtures). |
| W2.2 | MyNetDiary no dedup -- re-runs double food_entries | Add composite unique constraint on `(date, food_name, quantity, meal_type)` or use `upsert` with that key? Needs schema change + code change. |
| W2.3 | `/api/analyze/correlations` blanket-deletes before re-insert, no transaction | Wrap in RPC transaction, or switch to UPSERT on natural key. |
| W2.4 | `/api/chat/history` DELETE wipes everything with no guard | FIXED (IMPL-W2B-4, 2026-04-17) -- DELETE now requires `?confirm=archive` (insert-select to `chat_messages_archive` then delete; 501 if table missing pending Wave 3) or `?confirm=hard&token=$CHAT_HARD_DELETE_TOKEN`; no params -> 400. Tests at `src/app/api/chat/__tests__/history-delete-guard.test.ts` (5 cases). Depends on `CHAT_HARD_DELETE_TOKEN` env var and Wave 3 `chat_messages_archive` table. |
| W2.5 | `/api/oura/sync` overwrites `raw_json` clobbering Apple Health payload | Deep-merge instead of replace. |
| W2.6 | `/api/profile` PUT corrupts jsonb shape via `JSON.stringify(content)` | Store object directly, not stringified. Migration may be needed to un-stringify existing rows. |
| W2.7 | LabsTab `ResponsiveContainer` SSR regression | FIXED -- rewrote `TrendChart` subcomponent with `useRef` + `clientWidth` + resize listener pattern (matches `src/components/patterns/TrendChart.tsx`). |
| W2.8 | Vitals intelligence misses myAH orthostatic labs | FIXED -- added `computePulseDeltasFromRows` helper, query now pulls `Supine pulse rate`, `Standing Pulse Rate`, `Sitting pulse rate`, `HR (supine)`, `HR (standing)`, `Orthostatic HR Delta` and unions direct + computed deltas. 2026-04-07 now shows `{supineHR:91, standingHR:106, hrDelta:15}`. |
| W2.9 | Sync-status byType capped at 1000 (Supabase implicit limit) | FIXED -- per-type HEAD counts for `daily_log`, `lab_result`, `imaging` plus independent `totalRecords`. Output now `{daily_log:1181, lab_result:11, imaging:4}`. |
| W2.10 | Apple Health `DELETE ilike 'Daily total:%'` can wipe real user rows | PARTIAL -- jsonb tag `macros.source='apple_health_export'` added to inserts + filter added to delete. Full fix needs a `source` column (queued for Wave 3). |
| W2.11 | MyAH medication dedupe uses lossy `.includes()` | FIXED -- added shared `normalizeMedicationName` helper at `src/lib/import/normalize-medication.ts`, rewrote the myAH `importMedications` dedupe and the universal deduplicator's `'medication'` case to normalize both sides before comparing. See [finding](2026-04-16-myah-medications-jsonb-substring-merge.md). Test suite at `src/app/api/import/myah/__tests__/medication-dedupe.test.ts`. |
| W2.12 | `/api/oura/disconnect` unqualified `.delete().neq(id, zero-uuid)` | FIXED -- rewritten to select token ids then `.delete().in('id', ids)`; same pattern applied to `storeTokens()`. See [finding](2026-04-16-oura-disconnect-unqualified-delete.md). |
| W2.13 | Analysis pipeline bypasses Context Assembler | Route all `src/lib/ai/analyze.ts` calls through `assembleContext()`. |

## Wave 3 -- INFRASTRUCTURE (after W1 + W2 land)

| # | Work |
|---|---|
| W3.1 | Create `scripts/migrate.mjs` canonical runner; add `db:migrate` to package.json |
| W3.2 | Apply migration 012 push_subscriptions against live DB (needs user approval, DB access) |
| W3.3 | Backfill `health_embeddings.embedding` -- run `src/lib/migrations/backfill-embeddings.mjs` after confirming `OPENAI_API_KEY` is set (Claude spend + API key needed) |
| W3.4 | Add text-search recency boost: `ts_rank_cd(...) * exp(-age_days/365)` |
| W3.5 | FIXED (IMPL-W3-5, 2026-04-17) -- added `getFullSystemPromptCached()` + `splitSystemPromptForCaching()` in `src/lib/context/assembler.ts`, shared `logCacheMetrics()` helper at `src/lib/ai/cache-metrics.ts`, switched chat, analyze, narrative/weekly, and insight-narrator to pass `system` as a two-block array with `cache_control: { type: 'ephemeral' }` on the static prefix. Test suite at `src/lib/__tests__/ai/prompt-caching.test.ts` (8 cases). Updated `analyze-through-assembler.test.ts` to assert the array shape. |
| W3.6 | Commit sample importer fixtures under `tests/fixtures/imports/` |
| W3.7 | CI smoke test: `GET` every API route, assert no 5xx and no `"error"` key in 200 payloads |
| W3.8 | Create `chat_messages_archive` table (`create table ... (like chat_messages including all); add column archived_at timestamptz default now()`) so `DELETE /api/chat/history?confirm=archive` can write. Until then the endpoint returns 501 by design. |

## Deferred (not this session)
- Correlation pipeline manual re-run (user approval, Claude spend)
- Live Claude API grounding audit (spend)
- Fix CLAUDE.md `+58 bpm` claim now that live data shows 15 bpm delta (data-accuracy update, not code)

## Gate status
- Gate 1 (design-decisions approved): PASS
- Gate 2 (this matrix): user said "keep moving, do what you recommend" -- interpreted as blanket approval for Wave 1. Wave 2 and Wave 3 items will be proposed individually with their design questions.
- Gate 3 (post-wave): will report wave-1 outcomes before dispatching wave 2.

## Wave 1 dispatch contract
Each W1 agent gets:
- Self-contained brief with `design-decisions.md` pointer
- Exact file + line + fix
- Vitest test requirement (red-before-fix, green-after)
- Isolation: worktree
- Return: summary of files changed, test output, 200-word report
