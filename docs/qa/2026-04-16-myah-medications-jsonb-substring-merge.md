---
date: 2026-04-16
agent: R5
area: mutations
status: FIXED
severity: HIGH
verification_method: static-analysis
---

# `/api/import/myah` importMedications mutates health_profile via lossy substring dedupe

## One-sentence finding
The myAH medications importer dedupes against existing entries using `existingMeds.some(m => m.toLowerCase().includes(rec.name.toLowerCase()))`, which merges distinct medications whose names contain one another (for example "Tylenol" matches a prior "Tylenol PM").

## Expected
Dedupe should match on a normalized (name, dose) tuple, not a free-text `includes()` against a concatenated string.

## Actual
`src/app/api/import/myah/route.ts` lines 395-405:

```ts
const alreadyExists = existingMeds.some(
  (m) => m.toLowerCase().includes(rec.name.toLowerCase())
)
if (alreadyExists) {
  skipped++
} else {
  newMeds.push(medString)
  imported++
}
```

`existingMeds` is a `string[]` of concatenated strings like `"Tylenol - 500mg - 2x daily"`. `includes()` returns true for any substring, so:
- "Tylenol" matches existing "Tylenol PM" -- the new med is wrongly skipped
- Importing "Acetaminophen 500mg" when existing contains "Acetaminophen 325mg" silently dedupes the wrong dose

Additionally, on save failure (line 423-426) the code does `imported = 0 // rollback count` which is cosmetic only -- the upsert has already run or failed server-side. If the upsert partially failed, no way to recover the structured list.

## Verification evidence
Static read of route.ts.

## Recommended action
- FIX: migrate medication storage out of free-text `health_profile.content.current_medications` into a structured `medications` table with `(name, dose, frequency, start_date)` columns and a unique constraint on `(name_normalized, dose)`.
- Short-term FIX: replace the substring check with `m.toLowerCase().split(' - ')[0] === rec.name.toLowerCase()` to match only the name slot, not any substring of the full concatenation.

## Resolution (W2.11)
Applied 2026-04-17 by IMPL-W2B-11.

- Added shared helper `src/lib/import/normalize-medication.ts` exporting `normalizeMedicationName(s: string): string`. Rules:
  - lowercase
  - collapse runs of whitespace to single spaces and trim
  - glue dose numerics to their unit (`500 mg` -> `500mg`, `2000 IU` -> `2000iu`)
  - strip trailing action verbs `taken | logged | dose` plus everything after
  - flatten `<name> - <dose>` separators so the "Tylenol - 500mg - 2x daily" storage shape collapses to `tylenol 500mg 2x daily`
- Replaced the `existingMeds.some(m => m.toLowerCase().includes(rec.name.toLowerCase()))` check in `src/app/api/import/myah/route.ts` (importMedications) with a normalized (name, dose) comparison. The new dedupe treats `Tylenol 500mg`, `tylenol 500 mg`, `TYLENOL 500 MG`, `TYLENOL 500 MG taken`, `  Tylenol  500mg  ` as the same key while leaving `Tylenol 500mg` distinct from `Tylenol PM 500mg` and from `Acetaminophen 325mg`.
- Wired the same normalizer into the `'medication'` case of `src/lib/import/deduplicator.ts` -- replaced the raw `.ilike('title', '%name%')` query with a row-level normalized comparison so the universal importer dedupe path picks up the same casing/spacing fixes.
- New vitest suite `src/app/api/import/myah/__tests__/medication-dedupe.test.ts` -- 10 cases covering the normalization rules above and a matrix of pairwise dedupe assertions. Pre-existing `anovulatory-detection` and `phase-insights` failures remain (out of scope).
