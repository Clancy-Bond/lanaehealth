---
date: 2026-04-16
agent: R2
area: importers
status: FIXED
severity: HIGH
verification_method: static-analysis
fixed_in: W1.2 (IMPL-2)
fixed_at: 2026-04-17
---

# Universal importer writes to non-existent `date` column on `medical_timeline` and `medical_narrative`

## One-sentence finding
The Phase 2 confirm handler of `/api/import/universal` writes `date: ...` to `medical_timeline` in five places and to `medical_narrative` in one place; neither table has a `date` column, so every medication/immunization/procedure/fallback/clinical-note save will fail silently.

## Expected
Inserts into `medical_timeline` use the column `event_date` (per migration `001-context-engine.sql` line 59). `medical_narrative` does not accept a date column at all (its schema is `section_title, content, section_order, updated_at`) -- dates must be folded into the content or dropped.

## Actual
`src/app/api/import/universal/route.ts` has five broken insert payloads:

| Line | Block | Bad field |
|---|---|---|
| 142-148 | `case 'medication'` -> `medical_timeline.insert` | `date: record.date` |
| 207-214 | `case 'immunization'` -> `medical_timeline.insert` | `date: record.date` |
| 221-228 | `case 'procedure'` -> `medical_timeline.insert` | `date: record.date` |
| 253-258 | `case 'clinical_note'` -> `medical_narrative.insert` | `date: record.date` |
| 267-273 | `default` -> `medical_timeline.insert` | `date: record.date` |

Each throws a `column "date" does not exist` error at runtime. The outer try/catch captures the error into `errors.push(...)`, so the request returns 200 with `totalSaved: 0` and an errors array the user may not notice in the review UI.

This is the same root-cause as the Session 1 `medical_timeline.date` bug already fixed in three other files (`src/app/api/medications/today/route.ts`, `src/lib/ai/prn-intelligence.ts`, `src/lib/import/deduplicator.ts`). The universal importer was missed because it was added later and never exercised end-to-end.

## Verification evidence

Migration schema:
```
$ grep -n "medical_timeline (\|medical_narrative (" src/lib/migrations/001-context-engine.sql
57:CREATE TABLE IF NOT EXISTS medical_timeline (
58:  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
59:  event_date DATE NOT NULL,
...
46:CREATE TABLE IF NOT EXISTS medical_narrative (
47:  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
48:  section_title VARCHAR(200) NOT NULL,
49:  content TEXT NOT NULL,
50:  section_order INTEGER DEFAULT 0,
51:  updated_at TIMESTAMPTZ DEFAULT NOW()
52:);
```

No table has both `date` and `event_date`; the column is `event_date` everywhere medical_timeline appears.

Session 1 final report quote:
> `medical_timeline.date` column name mismatch. Fix shipped. Three code sites queried a non-existent column. [...] src/lib/import/deduplicator.ts - would have quietly imported duplicates on repeat runs because of its bare catch {}.

The universal importer was not inspected in Session 1 so the same pattern survived.

## Recommended action

FIX:
```diff
- .from('medical_timeline').insert({
-   date: record.date,
+ .from('medical_timeline').insert({
+   event_date: record.date,
    event_type: 'medication_change',
    ...
  })
```
Apply in lines 142, 207, 222, 267 of `src/app/api/import/universal/route.ts`.

For `clinical_note` (line 253), the `medical_narrative` table has no date column. Options:
1. Drop the `date` field from the payload and prepend the date to `content` (e.g. `content: \`[${record.date}] ${data.content}\``).
2. Add `date DATE` to `medical_narrative` in a migration (schema change, defer until user-approved).

Recommend option 1 for now; pass the date into the content string.

Also add per-record error handling that surfaces a useful message in the response, not just the raw PostgreSQL error, so the UI can tell the user which records failed.

Add a test fixture `tests/fixtures/imports/fhir-bundle-with-meds.json` and a Vitest integration test that hits `handleConfirm` against a stubbed Supabase client to catch this class of bug going forward.

## Verification (2026-04-17, IMPL-2)

### Peek-confirmed column names
- `medical_timeline`: `['id', 'event_date', 'event_type', 'title', 'description', 'significance', 'linked_data', 'created_at']`. No `date` and no `source` column.
- `medical_narrative`: `['id', 'section_title', 'content', 'section_order', 'updated_at']`. No `date` column at all.
- `active_problems`: `['id', 'problem', 'status', 'onset_date', 'latest_data', 'linked_diagnoses', 'linked_symptoms', 'notes', 'updated_at']`. The column is `problem`, not `name`, and there is no `icd_code` column.
- `lab_results` and `appointments`: both correctly use `date`.

### Changes applied
- `src/app/api/import/universal/route.ts`:
  - Five `medical_timeline` writes now use `event_date` instead of `date` (medication, immunization, procedure, default, plus removed the non-existent `source` column; provenance moved into the description string).
  - `clinical_note` case removes the `date` field from the `medical_narrative` payload and folds the date into `content` as `[YYYY-MM-DD] ...` prefix.
  - `active_problems` case uses `problem` instead of `name`, drops the non-existent `icd_code` column, and folds ICD + severity into `latest_data`.
- `src/lib/import/deduplicator.ts`:
  - `filterExistingRecords` condition branch switched from `.eq('name', ...)` to `.eq('problem', ...)` to match the real `active_problems` column.
- `src/app/api/import/universal/__tests__/column-names.test.ts`:
  - New file. Ten assertions covering every case branch; all green.

### Test output
`npx vitest run src/app/api/import/universal/__tests__/column-names.test.ts`:
```
Test Files  1 passed (1)
     Tests  10 passed (10)
```

Full suite (`npx vitest run --reporter=dot`): 283 passed, 2 failed. The two failures are pre-existing (`anovulatory-detection.test.ts`, `phase-insights.test.ts`) and unrelated to this lane.
