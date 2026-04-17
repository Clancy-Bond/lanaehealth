---
date: 2026-04-16
agent: R5
area: mutations
status: FIXED
severity: HIGH
verification_method: static-analysis
fixed_by: IMPL-W2B-5
fixed_on: 2026-04-17
---

# `/api/oura/sync` upsert replaces `oura_daily.raw_json`, erasing Apple-Health-merged data

## One-sentence finding
The Oura sync route builds a fresh `raw_json` envelope per day and upserts it, replacing any previously merged `apple_health: {...}` sub-object that `/api/import/apple-health` had stitched in.

## Expected
The upsert should read-modify-write: fetch existing `raw_json`, merge the new Oura data under a known key (e.g. `oura: {sleep_daily, readiness, stress, spo2, sleep_detail}`) while preserving `apple_health` and any other sources.

## Actual
`src/app/api/oura/sync/route.ts` lines 95-166 build `dateMap[day].raw_json = {...existing, sleep_daily: entry}` entirely in memory across only *this sync's* chunks. There is no fetch of the existing DB `raw_json` before the upsert at line 176-179:

```ts
const { error: upsertError } = await supabase
  .from('oura_daily')
  .upsert(rows, { onConflict: 'date' })
```

Meanwhile `/api/import/apple-health` line 262-265 does:
```ts
await supabase
  .from('oura_daily')
  .update({ raw_json: { ...existing.raw_json, apple_health: row.raw_json } })
  .eq('id', existing.id)
```

So Apple Health stores itself under `raw_json.apple_health`. The next Oura sync produces a `raw_json` containing only `{sleep_daily, readiness, stress, spo2, sleep_detail}` and overwrites, wiping the Apple Health section.

The inverse hazard also exists: the Apple Health handler at `oura_daily` (lines 249-268) replaces the row entirely if `raw_json.source === 'apple_health_export'`, so an Oura-then-Apple sequence may wipe Oura data.

## Verification evidence
Static reads of both route.ts files. The field interactions are visible in the two respective upserts.

## Recommended action
- FIX: in `/api/oura/sync`, before upserting each row, fetch existing `raw_json` for that date and spread: `raw_json: { ...existing.raw_json, oura: {...new Oura payload} }`. Store Oura under its own key instead of flat at top level.
- Migration FIX: if `raw_json.apple_health` data has already been lost, users will need to re-run `/api/import/apple-health` after the code fix. Flag this in the fix PR so Lanae knows to re-upload.

## Fix (2026-04-17, IMPL-W2B-5)
Implemented option (b) from the brief -- namespace the Oura payload under `raw_json.oura` and merge with existing row.

Files changed:
- `src/app/api/oura/sync/route.ts` -- builds `ouraPayloadMap[date]` alongside `dateMap[date]`, then fetches existing `raw_json` for every touched date with `.in('date', touchedDates)` and constructs final `raw_json: { ...existing, oura: ouraPayloadMap[date] }`. Each importer now owns its own namespace (Oura at `raw_json.oura`, Apple Health at `raw_json.apple_health`), so the clobber is structurally impossible.
- `src/app/api/oura/sleep-stages/route.ts` -- reader-side update. Sleep-stages now reads `raw_json.oura.sleep_detail` first, falling back to legacy `raw_json.sleep_detail` so rows written before this fix still render.

No other reader of `raw_json` from the sync-written keys was identified:
- `src/components/log/EveningCheckIn.tsx` reads `prefill.oura?.raw_json?.steps` / `.active_calories` but those were never written by the Oura sync -- they originate in Apple Health and in the current tree would have lived under `raw_json.apple_health.steps`. That's a pre-existing, separate bug in EveningCheckIn's prefill (outside this fix's lane) and unaffected by the change.
- `src/lib/types.ts` has only a type declaration for `raw_json: Record<string, unknown>` -- no shape-specific reads.
- `src/app/api/import/apple-health/route.ts` continues to write `raw_json.apple_health` as before; still compatible because it spreads existing `raw_json` (which now may contain `oura`) before layering `apple_health`.

Tests:
- New: `src/app/api/oura/__tests__/sync-raw-json-merge.test.ts` -- mocks an existing `oura_daily` row with `raw_json.apple_health = {source:'apple_health_export', steps:9123, ...}` plus a legacy flat `sleep_detail` key, runs the `POST` handler with stubbed Oura API responses, and asserts the final upsert payload has BOTH `raw_json.apple_health` (unchanged) AND `raw_json.oura.{sleep_daily, readiness, stress, spo2, sleep_detail}` (fresh). A second test covers the fresh-insert path where no existing row exists: only `raw_json.oura` is written and no `apple_health` key leaks in.
- Existing: `src/app/api/oura/__tests__/sleep-stages.test.ts` still passes using the flat `raw_json.sleep_detail` fixture (backward-compatible fallback works).

Test run summary (2026-04-17):
- `npx vitest run` -> 33 files pass, 318 tests pass; 2 pre-existing failures (`phase-insights.test.ts` forbidden-phrase, `cycle-entries.test.ts` cycle-count) are unrelated to this fix and match the baseline.

Data note: no `raw_json` backfill is needed. Legacy rows keep their flat `sleep_detail` and continue to render via the reader fallback. The next Oura sync rewrites those rows with the new namespaced shape without losing any other importer's keys.
