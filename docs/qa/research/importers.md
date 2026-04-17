---
date: 2026-04-16
agent: R2
area: importers
status: FAIL
severity: HIGH
verification_method: static-analysis
---

# Importer static source audit

Scope: 7 routes under `src/app/api/import/*` and `src/app/api/oura/sync/*` plus supporting parsers in `src/lib/importers/`, `src/lib/import/`, `src/lib/integrations/`. No live imports run.

## Risk matrix

| Importer | Input parsing | Date/TZ | Dedup | Validation | Error handling | Data-loss risk | Overall |
|---|---|---|---|---|---|---|---|
| apple-health | MEDIUM (streaming regex, skips malformed) | MEDIUM (ISO prefix only, no TZ handling) | LOW (date PK upsert) | LOW | MEDIUM (partial error list, accumulates) | **HIGH** (DELETE on food_entries, UPDATE on oura_daily) | **HIGH** |
| myah | HIGH (three parsers: regex, Claude, none validate schema) | MEDIUM (yy>50 century heuristic) | **HIGH** (only relies on 23505 PK collision; no test_name+date unique constraint exists) | LOW | LOW (Claude JSON parse can swallow warnings) | MEDIUM (`medical_timeline` event log insert on every run) | **HIGH** |
| mynetdiary | MEDIUM (naive CSV splitter, assumes US date) | MEDIUM (US-only; silent drop on unknown) | **HIGH** (pure INSERT, re-import duplicates every time) | LOW | LOW | **HIGH** (duplicates on re-run, no dedup whatsoever) | **HIGH** |
| natural-cycles | MEDIUM (naive CSV splitter) | MEDIUM (US-only) | LOW (date upsert) | LOW | LOW | LOW (upsert by date) | LOW |
| universal | HIGH (8 parsers, several Claude-backed) | MEDIUM | **HIGH** (dedupeKey used in-batch only; `filterExistingRecords` exists but is never called by confirm handler) | MEDIUM | MEDIUM | **HIGH** (UPDATE via upsert on lab_results, active_problems, appointments, health_profile; wrong column names cause silent save failures) | **HIGH** |
| oura/sync | LOW (robust Promise.allSettled) | LOW (Oura-native days) | LOW (date upsert) | LOW | LOW | LOW | LOW |
| legacy-bridge (part of universal) | N/A | N/A | N/A | N/A | N/A | LOW (returns message only) | LOW |

## Per-importer findings

### 1. apple-health (`src/app/api/import/apple-health/route.ts`)

**Input parsing:** Uses regex streaming over XML (parser in `src/lib/importers/apple-health.ts`). Rejects only if both `<HealthData` and `<Record` missing. Skips malformed `<Record>` rows silently (no warning surfaced). Running-average aggregation has a subtle off-by-one bug: for `agg: 'avg'` it sets the first value when `current === null` but still increments the counter to 1 before storing, so the second sample gets weighted as `(current * 1 + numVal) / 2` which is correct. Not a bug; documenting for clarity.

**Dates:** Takes `startDate.substring(0, 10)` -- this yields the **device-local calendar day as provided by the export**, not a TZ-normalized day. Apple Health exports retain `startDate="2026-04-15 22:30:00 -0700"` -- the substring pulls `2026-04-15` which is correct for the user's local day, but a record at `2026-04-15 23:45:00 +0900` would be **misattributed** to 2026-04-15 Tokyo which may actually be 2026-04-15 06:45 Pacific. Acceptable if all data originated on the user's watch in one TZ; potentially incorrect after travel. MEDIUM risk, low likelihood for this patient.

**Deduplication:**
- `nc_imported` and `cycle_entries`: `onConflict: 'date'` -- safe.
- `oura_daily`: manual merge -- if existing row has `raw_json.source === 'apple_health_export'` the code **UPDATEs** (replaces). Otherwise it merges apple-health blob into existing Oura row. Safe-ish but **spreads** values back into the row (`...existing.raw_json, apple_health: row.raw_json`) -- the Oura-sourced top-level fields (hrv_avg, resting_hr, sleep_duration) are NOT overwritten in the merge branch. Documented intent matches code.
- **Food entries: DESTRUCTIVE.** Lines 164-169: `delete().eq('log_id', logId).eq('meal_type','snack').ilike('food_items','Daily total:%')`. This wipes any prior Apple-Health-sourced food rows before inserting new ones. Fine for this importer's own re-runs, but **can delete real user data** if the user ever typed a real snack food line that happens to start with "Daily total:". Low likelihood but HIGH consequence if it happens.

**Error handling:** Accumulates errors into `results.errors`, returns first 20. OK. No rollback on per-day failure.

**Data-loss risk rating:** HIGH (DELETE + UPDATE paths).

### 2. myah (`src/app/api/import/myah/route.ts`)

**Input parsing:** Three-layer: regex -> Claude -> caller-supplied records. Regex patterns are heuristic and brittle (e.g. the lab regex requires "Value Unit Low-High" format with double-space delimiter -- Epic/myAH exports often use single spaces).

**Date parsing:** `normalizeDate` handles `MM/DD/YY` with `year>50 ? 19yy : 20yy` -- arbitrary cutoff. If the user pastes something with `25/03/2025` (EU-style DMY) it is silently interpreted as Feb 25, 2025 -- MEDIUM risk.

**Deduplication:**
- Labs: relies on a 23505 PK collision. **But there is no unique constraint on (date,test_name) in lab_results** (only `id UUID` PK). So re-importing the same lab **will succeed** and create a duplicate row. This is a **HIGH-severity dedup hole.**
- Appointments: same pattern, same hole. Every re-import adds a dup appointment.
- Medications: case-insensitive `includes` match against existing `current_medications` array. This is actually decent but the array grows unbounded and stored under `health_profile.section='medications'.content.current_medications`.
- Notes: pure INSERT into `medical_narrative`. No dedup. Re-importing notes = duplicate rows.
- **`medical_timeline` audit row:** imported medications trigger an INSERT into `medical_timeline` with `event_type: 'medication_change'` every run. Cumulative bloat.

**Error handling:**
- Claude JSON parse has a catch-all that swallows errors into a single generic "Failed to parse AI response" -- the raw text is lost. LOW-MEDIUM risk.
- The `importLabs` function checks `error.code === '23505'` to count skips -- but since the table has no unique constraint, this branch never fires.

**Data-loss risk:** MEDIUM. Dedup is mostly broken, so danger is duplicates, not deletion.

### 3. mynetdiary (`src/app/api/import/mynetdiary/route.ts`)

**Input parsing:** Naive `splitCsvLine` handles basic quote-escaped fields but NOT quoted-quotes (`""`) -- escape sequences used by Excel exports will produce corrupted columns. MEDIUM.

**Date parsing:** Assumes MM/DD/YYYY for slash dates (US-style). No DST risk since dates only. Silently drops unparseable rows (just `continue`).

**Deduplication:** **NONE.** The route:
1. Groups rows by `date|meal_type`.
2. Creates `daily_logs` rows for any missing dates.
3. `insert`s the aggregated group into `food_entries` without any conflict resolution.

Re-importing the same CSV **will double every food entry**. There is no dedup check, no upsert, no unique constraint. **HIGH-severity dedup hole.**

**Error handling:** Batch-chunk INSERT with per-chunk error; on failure returns 500 with `imported_so_far` count. OK.

**Data-loss risk:** HIGH for duplication (5782 food rows could become 11k+).

### 4. natural-cycles (`src/app/api/import/natural-cycles/route.ts`)

**Input parsing:** Same naive CSV splitter as mynetdiary (same quoted-quotes limitation).

**Dates:** US-style MM/DD/YYYY assumed; silent drop on unknown formats.

**Deduplication:** `onConflict: 'date'` upsert -- **the only importer that does this correctly.** LOW risk.

**Error handling:** Per-chunk error check, returns 500 on failure with progress count. OK.

**Data-loss risk:** LOW. Upsert replaces fields from the same `imported_at` source.

**Caveat:** The parser's `temperature` column uses `parseFloat(cols[tempIdx]) || null` -- `||` treats `0` as null. Unlikely for BBT (always ~36.x) but incorrect. Documentary only.

### 5. universal (`src/app/api/import/universal/route.ts`)

**Input parsing:** Delegates to 8 specialized parsers via the format detector. Format detection is a conservative extension + MIME + content-sniff layered approach; works for well-formed files. For FHIR bundles with no `entry` array, parser silently returns empty results (warning not added). Tier2 parsers have reasonable error handling.

**Dates:** Each parser normalizes to YYYY-MM-DD with US-style slash assumption. Same DST/TZ caveats.

**Deduplication:** This is where it breaks down hard.

- `handleParse` calls `deduplicateRecords` (in-batch dedup only) and returns records for user review.
- **`handleConfirm` does NOT call `filterExistingRecords` at all.** The dedup check against the live DB is defined but orphaned. Every `confirm` writes whatever records the client sends.
- Upserts rely on `onConflict: 'date,test_name'` for `lab_results`, `'name'` for `active_problems`, `'date,doctor_name'` for `appointments`. **None of these composite unique constraints exist in the live schema** (per migration 001 and 009). Supabase will return an error; the catch turns it into `errors.push(...)` and the record is dropped silently.
- Result: a user confirming 100 records may see `totalSaved: 0` with no per-record feedback.

**Column-name bugs (HIGH severity):**

Looking at `src/app/api/import/universal/route.ts`:
- Line 142-148: `.from('medical_timeline').insert({ date: record.date, ... })` -- **column is `event_date`, not `date`**. Every medication confirm will fail.
- Line 207-214: same bug for immunization insert.
- Line 221-228: same bug for procedure insert.
- Line 253-258: `medical_narrative` has no `date` column at all (confirmed migration 001). This insert will fail.
- Line 267-273: fallback timeline insert has same `date` bug.
- Line 157-163: `.from('active_problems').upsert({ name: data.name, ... }, { onConflict: 'name' })` -- **column is `problem`, not `name`**, and `status` values in schema CHECK-list are `'active'|'investigating'|'improving'|'resolved'`, but `data.status` defaults to `'active'` or incoming unknown strings (FHIR ships `'resolved'`, `'inactive'` etc which do not match the check constraint -- insert will fail).
- Line 168-177: appointments upsert with `onConflict: 'date,doctor_name'` -- no such unique constraint exists.
- Line 238-246: `lab_results` with `onConflict: 'date,test_name'` -- same problem.

Without a fix, **the universal importer Phase 2 is non-functional**. Every confirm will return errors per record and zero saves.

**Data-loss risk:** MEDIUM in practice (inserts fail, no deletion), but the user-facing claim of "saved X records" is false until this is fixed.

### 6. oura/sync (`src/app/api/oura/sync/route.ts`)

**Input parsing:** `Promise.allSettled` across five Oura endpoints; fulfilled values extracted defensively. Rejected endpoints just silently produce empty lists -- the user is not informed if, say, SpO2 failed. Minor.

**Dates:** Uses Oura-provided `day` field; no TZ manipulation. Chunks by 90 days using UTC day math (`new Date(cursor).toISOString().split('T')[0]`) -- could be off by one at TZ boundaries for the chunk edges, but since the Oura API treats dates inclusively it's self-correcting. LOW.

**Deduplication:** `onConflict: 'date'` upsert. Safe.

**Data-loss risk:** LOW. This is the gold standard path.

**Note:** `storeTokens` in `src/lib/oura.ts` does a `.delete().neq('id', '00000000-...')` to clear old rows before insert. Correct per-row (keeps single active token) but worth flagging as a DELETE path. Guarded so LOW risk.

### 7. Import history auditing

`handleConfirm` in universal writes to `import_history` only if `totalSaved > 0`. The other six importers never write to `import_history` -- so that table can only ever reflect universal-route imports. The session-1 report already showed `/api/import/history` returns an empty list; that is by design until the other routes also log.

## Cross-cutting findings

### F1. No importer test fixtures, only the tier2 unit test
The only existing test is `src/lib/__tests__/import/tier2-parsers.test.ts` which covers `parseFloJson`, `parseClueJson`, `parseBearableCsv`, `parseSleepCycleCsv`, `parseStrongCsv`, `parseMacroFactorCsv` on inline CSV/JSON strings. No fixture files, no tests for:
- Apple Health XML parser
- MyNetDiary CSV parser
- Natural Cycles CSV parser
- FHIR parser
- C-CDA parser
- Screenshot/PDF parsers
- Any of the route handlers (apple-health, myah, mynetdiary, natural-cycles, universal, oura/sync)
- Deduplicator
- Format detector

Recommend committing fixtures at `tests/fixtures/imports/` with at least one representative sample per importer so CI can catch regressions.

### F2. CSV splitters are inconsistent
- `mynetdiary.ts` and `natural-cycles.ts` use a simple `splitCsvLine` that does NOT handle `""` escape sequences.
- `generic-csv.ts` and `tier2-specialized.ts` DO handle `""` correctly.
- Apple Health parser is regex-only, unaffected.

Users whose exports contain embedded quotes (e.g. food names like `"Trader Joe's ""Everything"" Bagel"`) will get corrupted columns from the two older parsers. MEDIUM.

### F3. Silent catch blocks
`filterExistingRecords` in `deduplicator.ts` lines 116-119:
```
} catch {
  exists = false
}
```
This silently treats any DB lookup failure as "record is new". Session 1 already fixed the original `medical_timeline.date` bug that fell into this path, but the bare catch remains as a footgun.

### F4. Client-side trust on `handleConfirm`
Universal route accepts any `records: CanonicalRecord[]` from the client without re-validating shape, confidence, or dedupeKey. An adversarial or corrupted client could pass arbitrary payloads. Low priority in single-user app but worth noting.

## Recommended actions

- **FIX (HIGH):** Rename `date:` to `event_date:` in all medical_timeline inserts in `src/app/api/import/universal/route.ts` (lines 142, 207, 222, 267). See [2026-04-16-universal-importer-column-name-bugs.md](../2026-04-16-universal-importer-column-name-bugs.md).
- **FIX (HIGH):** Rename `name:` to `problem:` for active_problems insert, or leave the conflict as-is and rename schema (latter is a migration, defer). File: universal/route.ts line 158.
- **FIX (HIGH):** Either add the referenced unique constraints (`lab_results(date,test_name)`, `appointments(date,doctor_name)`) or switch confirm handler to explicit pre-INSERT checks. See [2026-04-16-universal-importer-missing-unique-constraints.md](../2026-04-16-universal-importer-missing-unique-constraints.md).
- **FIX (HIGH):** Replace MyNetDiary pure-INSERT with a dedup pre-check on (log_id, meal_type, food_items) or add a composite unique constraint. See [2026-04-16-mynetdiary-no-dedup.md](../2026-04-16-mynetdiary-no-dedup.md).
- **FIX (MEDIUM):** Remove or guard the `food_entries.delete().ilike('food_items','Daily total:%')` in apple-health importer -- scope delete to a `source = 'apple_health'` column added to `food_entries`.
- **FIX (MEDIUM):** Wire `filterExistingRecords` into `handleConfirm` in universal route.
- **INVESTIGATE:** Decide whether myAH labs/appointments should be INSERT with dedup-check or UPSERT. Currently the 23505 branch is dead code (no unique index to trigger it).
- **ACCEPT:** Oura sync path, natural-cycles upsert, legacy-bridge behavior.
- **TEST:** Add importer fixtures and route-level integration tests (Vitest with a Supabase mock).

## Verification evidence

Schema confirmed via `src/lib/migrations/001-context-engine.sql`:
- `medical_timeline.event_date DATE NOT NULL` (line 59), no `date` column.
- `medical_narrative` columns: `id, section_title, content, section_order, updated_at` -- no `date`.
- `active_problems.problem` (line 74), not `name`.

Session 1 final report confirmed `medical_timeline.date does not exist` was a real error message in production endpoints (`/api/medications/today` until it was patched), so the bug I flag in universal/route.ts will also surface at runtime.

Code counts grepping `src/app/api/import/universal/route.ts`:
- `event_date`: 0 occurrences
- `date:` used in insert payloads: 5 sites
- All 5 will fail when the route runs against the live schema.
