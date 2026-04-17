---
date: 2026-04-16
agent: R2
area: importers
status: FLAGGED
severity: HIGH
verification_method: static-analysis
---

# MyNetDiary importer has no deduplication; re-running the same CSV doubles food_entries

## One-sentence finding
`/api/import/mynetdiary` aggregates CSV rows by (date, meal_type) then does a plain `.insert()` into `food_entries` with no conflict handling and no pre-check against existing rows, so every re-import duplicates the entire dataset.

## Expected
A CSV re-import should either:
- Skip rows that already exist (pre-check by log_id, meal_type, food_items hash or a source-identifier).
- Replace rows for the same (date, meal_type, source) via an upsert.
- At minimum warn the user that N duplicates were detected.

Given the project's Zero Data Loss rule the safest is pre-check-then-insert, never UPDATE existing rows.

## Actual
`src/app/api/import/mynetdiary/route.ts` lines 117-154:

```typescript
const upsertRows = [...grouped.values()].map((entry) => {
  ...
  return {
    log_id: logIdByDate.get(entry.date)!,
    meal_type: entry.meal_type,
    food_items: foodItemsText,
    calories: entry.total_calories || null,
    macros: entry.macros,
    flagged_triggers: flaggedTriggers,
    logged_at: new Date().toISOString(),
  }
})

// Batch insert in chunks of 500
for (let i = 0; i < upsertRows.length; i += chunkSize) {
  const chunk = upsertRows.slice(i, i + chunkSize)
  const { error } = await supabase
    .from('food_entries')
    .insert(chunk)   // <-- pure insert, no dedup

  if (error) { ... }
  totalUpserted += chunk.length
}
```

No `onConflict`, no query-before-insert, no unique constraint in the schema. The variable is named `upsertRows` but the operation is `.insert()`.

For Lanae's live DB (5,782 food rows, per session 1 report), re-running the same MyNetDiary CSV would add another 5,782 rows -- silently -- and then correlation / nutrition analyses would double-count.

## Verification evidence

Schema: `food_entries` is in the existing tables list (DO NOT MODIFY per CLAUDE.md). Migration 001 does not create it. Grepping for any unique index:
```
$ grep -rn "food_entries" src/lib/migrations/*.sql
(nothing found -- created in pre-project schema, no importer-added uniques)
```

Code review confirms `food_entries.insert()` has no dedup in any of the importers except the apple-health route, which uses the destructive-DELETE pattern instead (see separate MEDIUM finding on `food_entries.delete().ilike('food_items','Daily total:%')`).

Session 1 row counts report `food_entries: 5781 memory -> 5782 live (+1)`. If a user re-imports the full MyNetDiary CSV the row count would jump to ~11,563 with no error message.

## Recommended action

FIX (code-only, preferred):
Before the batch insert, compute a dedup key for each aggregated row (e.g. `sha256(log_id + meal_type + food_items.slice(0,200))`) and query for existing rows:

```typescript
// Pseudocode
const { data: existing } = await supabase
  .from('food_entries')
  .select('log_id, meal_type, food_items')
  .in('log_id', [...logIdByDate.values()])

const seen = new Set(existing.map(e => `${e.log_id}|${e.meal_type}|${e.food_items}`))
const toInsert = upsertRows.filter(r => !seen.has(`${r.log_id}|${r.meal_type}|${r.food_items}`))
```

Then insert only `toInsert` and report `skipped: upsertRows.length - toInsert.length` in the response.

Alternative (needs migration, defer):
Add a unique partial index on `(log_id, meal_type, md5(food_items))` to let Postgres enforce this. Risk: existing dups would block the index.

Test coverage: fixture CSV with 3 rows, import twice, assert the second import reports `imported: 0, skipped: 3`.

Note: the Zero Data Loss rule is NOT violated here (pure INSERT is the safest primitive), but the rule's spirit of "no silent data mutation" is. Duplicates poison downstream analyses as surely as deletions.
