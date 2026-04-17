---
date: 2026-04-16
agent: R5
area: mutations
status: PARTIAL -- fixed in code; Wave 3 schema column still recommended
severity: HIGH
verification_method: static-analysis + vitest regression
fixed_by: IMPL-W2A-10 (2026-04-17)
fix_commit: uncommitted (subagent deliverable)
---

# `/api/import/apple-health` deletes food_entries by prefix-match, risks collateral loss

## One-sentence finding
The Apple Health importer scopes its dedupe `DELETE` with `meal_type='snack' AND food_items ILIKE 'Daily total:%'`, which will match any legitimate `food_entries` row whose `food_items` text happens to start with "Daily total:" and whose meal type is snack.

## Expected
Dedupe should use a structured marker, for example a source column (`source = 'apple_health_export'`), not a free-text prefix that a user could enter manually or that another importer might write.

## Actual
`src/app/api/import/apple-health/route.ts` lines 164-169:

```ts
await supabase
  .from('food_entries')
  .delete()
  .eq('log_id', logId)
  .eq('meal_type', 'snack')
  .ilike('food_items', 'Daily total:%')
```

Runs inside `upsertNutrition` for every day that had calories/macros in the export. The intent is "remove my previous Apple Health summary for this day," but the filter catches any snack whose food_items text begins with "Daily total:". If a user types "Daily total: 2100" into the log or another importer uses a similar marker, data is lost on the next Apple Health sync.

## Verification evidence
Static read of route.ts.

## Recommended action
- FIX: add a `source` column to `food_entries` (or reuse `flagged_triggers`/`notes`) and gate the delete by source. `.eq('source', 'apple_health_export')` is robust; free-text prefix match is not.
- Alternative: write the summary to a dedicated table (`apple_health_daily_summary`) rather than to `food_entries`.

## Fix applied (2026-04-17, IMPL-W2A-10)

Peeked live schema via `/api/admin/peek?table=food_entries`. Confirmed columns:
`id, log_id, meal_type, food_items, calories, macros, flagged_triggers, logged_at`.
No `source`/`import_source` column exists. The only nullable jsonb field is
`macros`. Chose a PARTIAL fix that does not require a migration:

1. Every Apple Health insert now writes `macros.source = 'apple_health_export'`
   as a jsonb discriminator tag.
2. The dedupe-delete adds one filter clause on top of the existing
   `log_id + meal_type='snack' + ilike('Daily total:%')` chain:
     `.filter('macros->>source', 'eq', 'apple_health_export')`

Together the four filters only match rows that were actually written by the
Apple Health importer. User-typed snacks starting with "Daily total:" are
spared because their `macros` jsonb does not carry the tag.

### Files changed
- `src/app/api/import/apple-health/route.ts` -- added source tag on insert,
  added jsonb filter to the pre-insert delete, and a comment block
  explaining why this is partial and what Wave 3 should replace it with.
- `src/app/api/import/apple-health/__tests__/food-entries-delete-scope.test.ts`
  (new) -- 3 tests, including a fixture with both an Apple-tagged row and a
  user-entered row, asserting only the Apple row is deleted.

### Test output
```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```
Red-before-green verified: commenting the new `.filter(...)` clause causes
two of three tests to fail with "user-1" incorrectly included in the
deleted set. Restoring the filter returns all three to green.

### Residual risk (why PARTIAL, not FIXED)
- Apple Health rows written by earlier builds lack the `macros.source` tag.
  A re-run of the importer will NOT delete those untagged legacy rows; it
  will just insert new tagged ones alongside, producing a transient
  duplicate period until the legacy rows age out or are manually cleaned.
- Hand-editing `macros.source = 'apple_health_export'` on a user row would
  re-expose the original risk. This is defense-in-depth, not zero-risk.

### Wave 3 follow-up (queued)
Add a real `source TEXT` column on `food_entries` with a backfill for
existing Apple Health rows, then drop the `ilike('Daily total:%')` clause
and rely solely on `source = 'apple_health_export'`. That would make the
delete fully robust against any future food_items text the user might enter.
