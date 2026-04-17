---
date: 2026-04-16
status: FIXED
severity: HIGH
areas: [medications, prn-intelligence, import-deduplication]
---

# Bug: queries against `medical_timeline.date` (column does not exist)

## Repro steps
1. `curl http://localhost:3005/api/medications/today`
2. `curl "http://localhost:3005/api/intelligence/prn?medication=Tylenol"`
3. Run a universal import (any record type) through `/api/import/universal`.

## Expected
- `/api/medications/today` returns `{"doses":[...]}` for any events on today's date whose title matches `%taken%`.
- `/api/intelligence/prn` consults today and yesterday's doses from `medical_timeline` to compute last dose time and remaining doses.
- Import deduplicator correctly identifies existing medication/timeline rows and skips them.

## Actual
- `/api/medications/today` returned `200 OK` with a swallowed error payload: `{"doses":[],"error":"column medical_timeline.date does not exist"}`.
- `prn-intelligence` silently returned null/empty for dose history in both `today` and `yesterday` queries (the fetch errored under the hood and the result was coerced to `undefined`).
- Deduplicator would have errored on every medication and default-type record, then fallen through its bare `catch {}` to `exists = false`, which means it imports everything instead of deduping. On a repeat import this produces duplicate rows.

## Root cause
The `medical_timeline` table uses column `event_date` (confirmed in the table schema and at `/api/timeline` which returns rows with `event_date`). Three files queried the non-existent column `date`:

- `src/app/api/medications/today/route.ts` - select, filter, order
- `src/lib/ai/prn-intelligence.ts` - two blocks (today and yesterday doses)
- `src/lib/import/deduplicator.ts` - `medication` and `default` branches

The migration script at `src/lib/migrations/import-myah-data.mjs` already uses `event_date` correctly, so the source-of-truth was correct; only the reader code drifted.

## Fix
Replaced every `.from('medical_timeline')` query's `.eq('date', ...)` / `.select('date, ...')` / `.order('date', ...)` with the correct `event_date` column.

Files touched:
- `src/app/api/medications/today/route.ts:18-22`
- `src/lib/ai/prn-intelligence.ts:95-99, 122-127`
- `src/lib/import/deduplicator.ts:97, 109`

## Verification
- `curl /api/medications/today` returns `{"doses":[]}` with no error field. (nothing logged today - legitimate empty)
- `curl "/api/intelligence/prn?medication=Tylenol"` returns a populated `PrnDoseStatus` object with the correct `maxDailyDoses: 8` for Tylenol, no silent error.
- No stray references to `medical_timeline.date` remain (grep clean in `src/app`, `src/lib`).

## Follow-up
- The bare `catch {}` in `deduplicator.ts:116-119` masked this error for months; consider logging caught errors so future column/type mismatches surface during import runs.
- Consider adding a lightweight schema smoke test that SELECTs `event_date, title, description, significance, linked_data` from `medical_timeline` LIMIT 1 on server startup.
