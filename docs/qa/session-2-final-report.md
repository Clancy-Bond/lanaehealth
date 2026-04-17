---
date: 2026-04-17
session: QA pass 2
status: complete
pattern: orchestrated autonomous execution
---

# LanaeHealth QA Session 2 -- Final Report

## Headline numbers

- **Research agents dispatched:** 7 (parallel)
- **Implementation agents dispatched:** 15 (3 parallel waves of 5 + 4 + 3 + 3)
- **Total findings written:** 30 finding docs (plus 7 research docs + 2 matrix/design docs)
- **Fixes landed this session:** 20 FIXED + 1 PARTIAL
- **Deferred for user approval:** 6 items (DB migrations, API spend, schema changes)
- **Test suite at end:** 348 passing, 41 skipped, 0 failed (up from 283 / 2 failed at the start of Session 2)

## What changed in the app (fix-by-fix)

### Wave 1 (safe code-only)

| # | Fix | Files touched |
|---|---|---|
| W1.1 | Deprecated `claude-sonnet-4-20250514` snapshot replaced with canonical `claude-sonnet-4-6` | `src/lib/ai/analyze.ts`, new regression test `src/lib/__tests__/model-constants.test.ts` |
| W1.2 | Universal importer column bugs on `medical_timeline`/`medical_narrative`/`active_problems`; wired `filterExistingRecords` into `handleConfirm`; removed 4 broken `onConflict` references | `src/app/api/import/universal/route.ts`, `src/lib/import/deduplicator.ts`, new test |
| W1.3 | Sleep-stages endpoint was querying non-existent oura column names | `src/app/api/oura/sleep-stages/route.ts`, new test |
| W1.4 | Cycle-intelligence now folds `nc_imported.menstruation='MENSTRUATION'` into period-start detection | `src/lib/ai/cycle-intelligence.ts` |
| W1.5 | `cv_orthostatic` + `neuro_presyncope` topic keywords expanded with dizziness/lightheaded/presyncope/near-faint (kept `syncope`+`faint` so `neuro_presyncope` still covers its namesake) | `src/lib/context/summary-prompts.ts`, `src/lib/context/__tests__/topic-detection.test.ts` |

### Wave 2A (clear-cut)

| # | Fix | Impact |
|---|---|---|
| W2.7 | LabsTab `ResponsiveContainer` rewritten to `useRef + clientWidth + resize` | Vercel SSR regression prevented |
| W2.8 | Vitals intelligence now pairs `Supine/Standing` pulse labs and unions direct + computed deltas | 2026-04-07 orthostatic now reports `{supineHR:91, standingHR:106, hrDelta:15}`; CLAUDE.md "+58 bpm" claim is incorrect per live data |
| W2.9 | sync-status `byType` switched to per-type HEAD counts | Output changed from `{daily_log:1000}` (capped) to `{daily_log:1181, lab_result:11, imaging:4}` (real) |
| W2.10 | Apple Health `DELETE ilike` scoped to `macros.source='apple_health_export'` **(PARTIAL)** | Stops nuking user rows whose names accidentally match; proper fix needs a `source` column in Wave 3 |
| W2.12 | Oura disconnect replaced `.delete().neq(id, zero-uuid)` with explicit id-select-then-delete | Ambiguous blanket delete removed; same pattern applied to `storeTokens()` |

### Wave 2B (needed design calls -- I made them under "keep moving" authority)

| # | Fix | Decision I made |
|---|---|---|
| W2.1 | Cycle-day unification: home=27, prefill=47, intelligence=51 all showed different numbers for the same day. | Built `src/lib/cycle/current-day.ts` shared helper; home + prefill delegate; all three endpoints now report CD 51 Luteal on 2026-04-17. |
| W2.3 | Correlations `.delete()` before re-insert gone | Switched to `.upsert(onConflict: 'factor_a,factor_b,correlation_type,lag_days')`; defensive fetch-then-patch fallback when unique index absent (Wave 3 adds the index). Never wipes the table again. |
| W2.4 | `DELETE /api/chat/history` now requires a guard | Added `?confirm=archive` (soft-delete to `chat_messages_archive`, Wave 3 migration needed) and `?confirm=hard&token=${CHAT_HARD_DELETE_TOKEN}` (env-secret-guarded hard delete). No params = 400. |
| W2.5 | Oura sync `raw_json` deep-merge | Oura payload now lives under `raw_json.oura` namespace; Apple Health's `raw_json.apple_health` is preserved. sleep-stages reader updated with nested-first + legacy-flat fallback. |
| W2.6 | `PUT /api/profile` no longer `JSON.stringify`s into jsonb | 11 downstream readers now route through `parseProfileContent()` which accepts both legacy strings and fresh objects. Existing rows untouched (Zero Data Loss); cleanup migration queued for Wave 3. |
| W2.11 | myAH medication dedupe uses `normalizeMedicationName()` helper | `tylenol 500mg` / `TYLENOL 500 MG taken` / `Tylenol  500mg` all normalize to `tylenol 500mg`. Same helper used by universal deduplicator. |
| W2.13 | `src/lib/ai/analyze.ts` routes through `getFullSystemPrompt` from `assembler.ts` | Every analysis call now gets the static/dynamic boundary + permanent core + self-distrust block + topic summaries. |

### Wave 3 (code-only items landed)

| # | Fix |
|---|---|
| W3.1 | Canonical migration runner at `scripts/migrate.mjs`; maintains `schema_migrations` table; `npm run db:migrate` script added. Not yet executed against live DB. |
| W3.5 | `cache_control: { type: 'ephemeral' }` breakpoints added at the static/dynamic boundary across chat, analyze, narrative/weekly, and insight-narrator. Kept backward-compat string variant. Expected ~78% input-token savings on the static prefix after first cache hit. |
| W3.7 | CI smoke test at `src/__tests__/api-smoke.test.ts`: walks every GET route, asserts no 5xx, no 200-with-`error`. Runs with `npm run test:smoke`. Immediately surfaced a new bug -- see below. |

### NEW bug surfaced by the CI smoke test

- `/api/orthostatic` returns 500: `{"error":"Could not find the table 'public.orthostatic_tests' in the schema cache"}`. Table missing, schema reference dangling. Queued as a Session 3 finding -- will need a decision whether to add the table or remove the route.

## Deferred (need user approval before execution)

| # | Work | Why deferred |
|---|---|---|
| W2.2 | MyNetDiary dedup requires composite unique constraint on `food_entries(date, food_name, quantity, meal_type)` | DB schema change -- queued as Wave 3 migration |
| W3.2 | Apply migration 012_push_subscriptions against live DB | Needs DB access, user approval |
| W3.3 | Backfill `health_embeddings.embedding` (all 1,196 rows are NULL -- vector search is dead; tsvector fallback works) | Needs `OPENAI_API_KEY` + embedding API spend |
| W3.4 | Add text-search recency boost (`ts_rank_cd(...) * exp(-age_days/365)`) | DB function change -- queued |
| W3.6 | Commit importer sample fixtures under `tests/fixtures/imports/` | Low urgency, needed once importers are tested with realistic payloads |
| W3.8 | Create `chat_messages_archive` table (unblocks `DELETE /api/chat/history?confirm=archive`) | DB schema change -- queued |
| Correlation pipeline re-run | `curl -X POST /api/analyze/correlations` will now safely upsert (no wipe) | ~2 min compute + Claude spend -- user approval needed |
| CLAUDE.md data correction | Memory says "+58 bpm standing from 48 resting"; live data says 15 bpm delta on 2026-04-07 | Data-accuracy update, not code |

## Process observations (for future sessions)

1. **Parallel session collision on a shared repo is real.** A concurrent "competitive research for 13 apps" session swept W1.1's commit under an unrelated commit message (`aa7efe7`). Mitigation used: "no commit -- return diff" policy for later waves. For truly isolated work, use worktrees -- but worktrees require the working dir to be a git repo (it was not), so we fell back to file-level lane separation.

2. **Pattern shape matched orchestrated autonomous execution criteria.** 30+ independent work units, each analyzable without seeing the others. Main session held context lean by delegating deep work to subagents with self-contained briefs. `design-decisions.md` as a pre-dispatch contract prevented drift.

3. **The CI smoke test caught a bug within its first run.** W3.7 is a high-ROI addition -- recommend wiring into CI gate.

4. **"Fix forward, never mutate existing data"** was the right posture. Every Session 2 fix preserved the Zero Data Loss rule -- no rows were modified or deleted. The cost is that some fixes (profile PUT, Apple Health delete) need a Wave 3 cleanup migration to fully normalize legacy rows. That tradeoff is correct given patient-data stakes.

## Files changed (Session 2 totals)

- **Source files modified:** ~35
- **New source files created:** 7 helpers + 4 tests
- **Finding docs created:** 30
- **Matrix + design-decisions docs:** 2
- **Final reports:** 2 (Session 1 + Session 2)
- **Test count delta:** +65 new tests (283 -> 348), zero regressions

## What I would do in Session 3

Priority order:

1. **Wave 3 DB migrations** (needs user approval): apply 012, run the migration runner, add the three pending unique indexes (correlations, mynetdiary, apple_health.source column).
2. **Fix `/api/orthostatic` 500** (new finding from smoke test).
3. **Backfill `health_embeddings.embedding`** (unblocks semantic search; needs OpenAI key).
4. **Correlation pipeline re-run** (unblocks Patterns page).
5. **Data migration for jsonb profile legacy rows** (optional -- parser handles both shapes).
6. **Live Claude grounding audit** (chat + report quality against real queries).

Gate 3 sign-off: this report is the deliverable. Recommend the user review, commit selectively, and pick the Session 3 priority order.
