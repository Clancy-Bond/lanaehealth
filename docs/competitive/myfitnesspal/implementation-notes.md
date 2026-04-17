# MyFitnessPal Implementation Notes

Last updated: Apr 16 2026

Implementation details for the top 3 features selected in plan.md. Each section lists exact file paths, data model decisions, component plan, acceptance criteria, verification plan, and risks.

Key constraint reminder: `food_entries` table is read-only with respect to the existing 5,781 Lanae rows. We may INSERT new rows. We may NOT UPDATE, DELETE, or alter schema. Any new food-feature schema must be additive (new table) via migration 013 or later.

Check existing migration count: highest current is 012_push_subscriptions.sql. Next migration number is 013.

---

## Feature 1: Frequency-weighted meal suggestions per meal type

### File targets

Create:
- nothing (we reuse `food_entries` via new query function)

Modify:
- `/Users/clancybond/lanaehealth/src/lib/api/food.ts`
  - Add new exported function `getFrequentMeals(mealType, windowDays, limit)`.
- `/Users/clancybond/lanaehealth/src/app/log/page.tsx`
  - Fetch frequent meals per meal_type on server side, pass to `QuickMealLog` as a prop.
- `/Users/clancybond/lanaehealth/src/components/log/QuickMealLog.tsx`
  - Render frequent-meals chips above the free-text food search, grouped by selected meal_type.

Do NOT modify:
- `src/lib/context/` anything. This feature doesn't need LLM calls.
- `food_entries` schema.

### Data model

No new table. Pure read query over `food_entries`.

Query shape (pseudocode):
```sql
SELECT food_items, COUNT(*) AS freq
FROM food_entries
JOIN daily_logs ON food_entries.log_id = daily_logs.id
WHERE food_entries.meal_type = $1
  AND daily_logs.date >= NOW() - INTERVAL '90 days'
GROUP BY food_items
ORDER BY freq DESC, MAX(logged_at) DESC
LIMIT $2;
```

Served by `src/lib/api/food.ts`. Never called from client directly.

Caching: server component fetches once per log page load. No need for Supabase materialized view at this scale (5,781 rows is tiny).

### Component plan

New:
- `FrequentMealChips.tsx` under `src/components/log/`. Renders a horizontal scroll row of top N frequent meal strings for the currently-selected meal_type. Each chip, on tap, calls the existing `onAdd` handler already wired in `QuickMealLog`.

Reuse:
- `QuickMealLog.tsx` is the host. Add a `frequentMeals: Record<MealType, string[]>` prop.
- The existing free-text `food_items` flow handles the actual insert; `FrequentMealChips` just pre-fills the text.

### Acceptance criteria

1. Log page at port 3005, meal type switched to "breakfast," shows top 5 most-frequent breakfast strings from Lanae's last 90 days.
2. Switching meal_type to "lunch" replaces the chip row with her frequent lunches.
3. Tapping a chip inserts a new `food_entries` row via the existing `addFoodEntry` path, which means auto-classification still runs, triggers are recomputed, and embeddings pipelines still fire.
4. If Lanae has no entries in the last 90 days for that meal_type, the chip row renders nothing (no empty-state card, no error).
5. No existing row in `food_entries` is modified.

### Verification plan

1. `npm run build` passes.
2. Unit test in `src/lib/api/food.test.ts` (new or extended): mock Supabase, assert query shape returns expected top-N strings.
3. Integration check against real Supabase: run a one-off script that calls `getFrequentMeals('lunch', 90, 10)` and confirms it returns plausible Lanae lunch strings. Expect to see "salad" or "leftovers" or similar repeat items based on the 5,781-row history.
4. Manual UI verification on port 3005, /log page, toggle meal_type, confirm chips update.
5. Screenshot attached at `docs/competitive/myfitnesspal/screenshots/frequent-chips.png`.

### Risks

- Query performance if `food_entries` grows past a million rows. At 5,781 rows today, index on `(meal_type, log_id)` is sufficient. Re-evaluate at 10x scale.
- Lanae's "food_items" free-text column means the same meal could be spelled differently ("oatmeal", "oats", "oat meal") and fragment the frequency signal. Acceptable for MVP. If fragmentation is bad, future work could add a normalization layer.
- Should NOT surface "cycle-phase-inappropriate" meals in luteal phase. Deferred: phase-aware filtering is a future enhancement, not MVP.

---

## Feature 2: Copy meal from yesterday or any prior date

### File targets

Create:
- `/Users/clancybond/lanaehealth/src/components/log/CopyMealButton.tsx`
  - New button component. Default label "Same as yesterday." Opens a date picker for "from another date."

Modify:
- `/Users/clancybond/lanaehealth/src/lib/api/food.ts`
  - Add exported function `copyMealsFromDate(sourceDate, targetLogId, mealTypes?)`.
- `/Users/clancybond/lanaehealth/src/components/log/QuickMealLog.tsx`
  - Mount `<CopyMealButton />` in the header row. Accepts a callback that invokes `copyMealsFromDate`.

Do NOT modify:
- `food_entries` existing rows. This is insert-only.

### Data model

No new table. Pure insert operation over `food_entries`.

New API function:
```typescript
export async function copyMealsFromDate(input: {
  sourceDate: string      // ISO date e.g. '2026-04-15'
  targetLogId: string     // current log row id
  mealTypes?: MealType[]  // optional filter, default all
}): Promise<FoodEntry[]>
```

Implementation steps:
1. Look up source `daily_logs` row by user_id and date.
2. Select all `food_entries` for that source log_id, optionally filtered by meal_type.
3. For each source entry, insert a new row with:
   - `log_id` = targetLogId
   - `meal_type` = source.meal_type
   - `food_items` = source.food_items
   - `flagged_triggers` = re-run `classifyFood(source.food_items).tags` merged with source.flagged_triggers
   - `logged_at` = NOW()
4. Return the new rows.

The re-classification step ensures if our classifier has improved since the source row was added, the copy benefits.

### Component plan

New:
- `CopyMealButton.tsx`. Two modes: "quick" (hard-codes yesterday) and "pick date" (opens a lightweight date picker modal).

Reuse:
- Existing `QuickMealLog.tsx` as the host. Inserts flow through its existing state management so the newly-inserted entries render immediately.
- `classifyFood` in `src/lib/api/food-classification.ts`.

### Acceptance criteria

1. On /log, if yesterday's log has any `food_entries` rows, the "Same as yesterday" button is active.
2. Tapping it inserts identical meals into today's log with updated `logged_at` timestamps. Existing yesterday rows are untouched.
3. Triggers are re-classified on copy (verify by adding a new classifier rule and checking a copied row gets the new tag while the source stays as-is).
4. If yesterday has no meals, the button shows as disabled with a tooltip "No meals to copy from yesterday."
5. "Pick date" mode opens a date picker. Only dates within the last 365 days are selectable (reasonable bound).
6. Cycle-phase-aware suggestion (nice-to-have): if today's cycle phase matches a prior date's phase, bubble that prior date as a second quick-copy option. Example label: "Copy from last luteal flare" if we can detect that.

### Verification plan

1. `npm run build` passes.
2. Unit test: mock Supabase client, call `copyMealsFromDate`, assert insert-only, no updates.
3. Integration: run a dry-run script against Lanae's Supabase with a SELECT-only simulation first to confirm the source rows exist. Then run actual copy on a test log row and verify the source rows are byte-identical before and after (checksum comparison).
4. Manual UI: on /log page, tap "Same as yesterday," confirm today's meal list repopulates within 500ms and shows optimistic UI.
5. Rollback check: the new rows have distinct UUIDs and `logged_at` timestamps; deletion of the new rows is straightforward if user wants to undo. Add an "Undo" toast that lives for 5 seconds.

### Risks

- If a future migration somehow changes the `food_entries` schema, copy logic could drift. Mitigate by using typed `FoodEntry` interface from `src/lib/types.ts`.
- Re-running `classifyFood` on copy is a small compute cost. For 10 meals on a day, well under 50ms total.
- Accidental mass-insert if the user taps "copy date from a year ago" on a day they ate 20 things. Cap the copy at 20 items per meal_type per call as a safety.
- Cycle-phase-aware suggestion requires reading from `cycle_entries`. Defer if that adds complexity; base feature works without it.

---

## Feature 3: Graceful barcode "not found" fallback

### File targets

Modify:
- `/Users/clancybond/lanaehealth/src/components/log/BarcodeScanner.tsx`
  - Audit current failure path. Replace any long form fallback with a one-field free-text entry that calls the existing `addFoodEntry` flow.
- `/Users/clancybond/lanaehealth/src/lib/api/open-food-facts.ts`
  - Ensure the "not found" response path returns a clean null rather than throwing, so the scanner component can react gracefully.

Do NOT modify:
- `food_entries` schema.
- The barcode library itself.

### Data model

No schema change. The fallback route inserts through the same existing `addFoodEntry` API. The `food_items` column is a free-text varchar, so "generic" entries like "barcode 012345678905, unknown product" are valid if the user just wants a placeholder.

Better behavior: fallback to a 3-field quick add.
- Field 1: name (free text)
- Field 2: meal type (radio, defaults from current time)
- Field 3: triggers (multiselect, optional)

That's it. No serving size, no kcal, no fat/carb/protein fields. Let `classifyFood` fill in what it can. Users who want nutrition can upgrade the entry later.

### Component plan

Modify `BarcodeScanner.tsx` so the failure branch renders inline a `QuickMealLog`-style input rather than pushing to a new screen or opening a modal form.

Reuse:
- `QuickMealLog.tsx` has the 3-field pattern already. Consider extracting the shared bits into a `MealEntryForm` subcomponent for reuse. Not strictly required.

### Acceptance criteria

1. Scan a known barcode (test with a real OFF-indexed product): scanner locks on, pre-fills a confirm screen, user taps save. Entry appears in log within 2 seconds of scan.
2. Scan an unknown barcode (e.g. an off-brand local Hawaii product not in OFF): scanner locks on, receives null, shows a 3-field fallback form inline, user types "Hawaiian sweet bread" and saves. No abandonment.
3. Lock-on time under 800ms on iOS Safari, Pixel Chrome.
4. Confirm screen renders under 200ms after lock.
5. No user-submitted entries are written to a shared food database. (We never had one anyway. This is a negative check.)

### Verification plan

1. `npm run build` passes.
2. Manual scan of 5 products in Lanae's kitchen via her phone on port 3005. Log results: success count, lock-on time (stopwatch or devtools), abandonment.
3. Deliberately scan an unknown barcode, confirm fallback UX flows correctly.
4. Screenshot both success and fallback states at `docs/competitive/myfitnesspal/screenshots/barcode-*.png`.

### Risks

- OFF coverage is weaker than MFP for US regional products. Real-world scan success rate for Lanae may be 70% vs MFP's 95%. Acceptable given the privacy and accuracy tradeoffs.
- The scanner library may have iOS Safari compatibility issues. Test on her actual device.
- If BarcodeScanner.tsx currently uses a more intrusive fallback (modal), existing users may find the new inline UX disorienting. Lanae is the only user, so low risk.

---

## Bundling recommendation

All three features are Small effort and share the same file locations (`food.ts`, `QuickMealLog.tsx`). Best to ship them as a single branch `feat/myfitnesspal-quick-logging` with three commits:

1. Commit A: `feat(food): add getFrequentMeals API + FrequentMealChips component`
2. Commit B: `feat(food): add copyMealsFromDate API + CopyMealButton component`
3. Commit C: `feat(food): graceful barcode not-found fallback`

Each commit stands alone with tests. Main session reviews the diff and merges.

Estimated total effort: 8 to 12 hours for a focused implementation subagent.

---

## Open questions for main session

1. Should `getFrequentMeals` cap at 30 days, 90 days, or 365 days for Lanae's use case? Default chosen: 90 days. Main session can override.
2. Do we ship the cycle-phase-aware copy suggestion now or defer? Default: defer (base feature ships without it).
3. Should the "Undo copy" toast persist for 5 seconds or 10? UX preference.
4. Current `BarcodeScanner.tsx` code needs a fresh audit before Feature 3 can be fully scoped. Flag this as a pre-implementation review task.
