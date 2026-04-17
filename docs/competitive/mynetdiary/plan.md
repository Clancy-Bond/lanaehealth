# MyNetDiary Implementation Plan

Last updated: Apr 16 2026

Ranked table of features to pull from MyNetDiary into LanaeHealth. Ranking formula: `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Top 3 flagged for implementation-notes.md.

MyNetDiary is Lanae's current primary calorie tracker. Our 5,781 food_entries came from its CSV export. Replication here is a first-class priority, not a nice-to-have. Features here should be read as complementary to MFP features (which cover logging mechanics). MyNetDiary features cover clinical depth.

---

## Ranked feature table

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Notes | TOP 3 |
|------|---------|----------------|---------------------|-------------------|------------|-------|-------|
| 1 | Endo/POTS-aware condition preset for meal suggestions and macro targets | Pattern 2 | 5 | M | `food-classification.ts` (exists), `cycle-calculator.ts` (exists), new `user_nutrition_goals` table | Unique to LanaeHealth. Nobody else does endo or POTS presets. Sodium at 5000mg for POTS, anti-inflammatory score weighting, luteal-phase low FODMAP bias. | YES |
| 2 | Cycle-aware AI Nutrition Coach (Ria equivalent) | Pattern 3 | 5 | M | `src/lib/context/assembler.ts` (exists), new `nutrition-coach` persona, `health_profile` (exists) | Claude Sonnet through the context engine, grounded in Lanae's real data. Reads pgvector for prior meals, cites them. Always flags advice as non-diagnostic. | YES |
| 3 | Verified-source badge and search priority on food autocomplete | Pattern 1 | 4 | S | `FoodSearchAutocomplete.tsx` (exists), `open-food-facts.ts` (exists), `usda-food.ts` (exists) | Visually demote low-completeness entries. Prefer USDA and OpenFoodFacts with score >=0.8. Never show crowd-sourced. Low effort, high trust payoff. | YES |
| 4 | Weekly nutrient summary with cycle-phase comparison | Pattern 8 | 4 | M | `food-classification.ts`, `cycle-calculator.ts`, new component on Patterns page | Rolling weekly averages for iron, sodium, fiber, anti-inflammatory score, FODMAP load. Compare luteal vs follicular. | |
| 5 | Water tracker promotion (already partial) with adaptive reminder logic | Pattern 5 | 4 | S | `HydrationRow.tsx` (exists), `notifications.ts` (exists) | Audit current water UX. Increase reminder cadence if low intake mid-day. POTS target is 3L+. | |
| 6 | Photo food logging via Claude vision | Pattern 7 | 3 | M | Anthropic SDK (exists), `classifyFood` (exists), new API route | Fatigue-day ergonomic win. Confidence fallback to text. | |
| 7 | Intermittent fasting timer (opt-in, reframed as "eating window") | Pattern 5 | 2 | S | New component, user preference flag | Only behind an explicit Settings toggle. Lanae probably skips. Low priority. | |
| 8 | Serving size memory per food | Pattern 4 | 3 | M | New `food_servings` additive table | Deferred. Food_items is free-text today, changing that has side effects across 5,781 rows. | |
| 9 | Weight trend prediction with adaptive TDEE | Pattern 6 | 1 | L | Weight history table, prediction math | DECLINED. Conflicts with non-diet-culture stance. Documented only. | |
| 10 | Body measurements non-weight tracking | Pattern 9 | 2 | M | New measurements table | Skip. Lanae already has bloating slider. | |
| 11 | Diabetes diary carbs-vs-glucose correlation | Pattern 10 | 2 | M | Glucose data source (none) | Skip now. Keep in matrix as future-ready if CGM added. | |
| 12 | No ads, no aggressive upsells, clinical framing (constraint) | Across patterns | 5 | S | Policy | Already true in LanaeHealth. Documented so product decisions preserve it. | |

---

## Top 3 selected

**1. Endo/POTS-aware condition preset**
Score: `(5*2) / 2 = 5`. Highest impact and medium effort. Genuine differentiation: no other nutrition app has this preset. Uses existing classifier and cycle math. One new additive table for per-user goals.

**2. Cycle-aware AI Nutrition Coach**
Score: `(5*2) / 2 = 5`. Tied top. Leverages existing context engine infrastructure. Minimal new code (one persona file, one chat integration). The cycle-awareness is the LanaeHealth signature, impossible for MyNetDiary to match architecturally.

**3. Verified-source badge on food search**
Score: `(4*2) / 1 = 8`. Highest efficiency. Small surgical change to existing component. Immediate trust payoff. Cleans up our own database search quality story.

Top 3 together: roughly 16 to 20 hours of focused work. Can ship in one sprint.

---

## MyNetDiary features that beat MFP for Lanae

Reading this next to the MyFitnessPal `plan.md`:

- MFP gave us: frequency meals (shipped pattern), copy yesterday, barcode fallback. Logging mechanics.
- MyNetDiary gives us: condition presets, cycle-aware AI coach, verified data. Clinical depth.

They stack, they don't overlap. MFP top 3 + MyNetDiary top 3 = full cover of "fast logging + clinical intelligence." Ship both pipelines.

Features where MyNetDiary clearly beats MFP:

1. **Database curation**: MyNetDiary's RD-reviewed base is better than MFP's crowd-sourced garbage. We don't import either, so our equivalent is: prefer USDA and OpenFoodFacts over any user-submitted path.
2. **Condition presets**: MFP has none. MyNetDiary has diabetes/PCOS/thyroid. We add endo/POTS (market gap).
3. **AI coach**: MFP has none. MyNetDiary has Ria. We build cycle-aware version.
4. **Non-hostile UX**: MFP ads mid-logging is universally hated. MyNetDiary is cleaner. LanaeHealth has no ads ever.
5. **Water and IF as first-class**: MFP buries these. MyNetDiary elevates. Lanae needs water elevated for POTS.

---

## Deferred

- Rank 4 (weekly nutrient summary) should ship after top 3 and probably after Cronometer's micronutrient research lands to avoid duplicate work.
- Rank 6 (photo food logging) depends on having a working text-logging foundation and a clear confidence threshold. Revisit after top 3 ship.
- Rank 7 (IF timer) opt-in only. Probably never surfaces for Lanae's use case.
- Rank 8 (serving size memory) requires touching how food_items is stored. Wait until we have real user feedback that typing "2 eggs (150g)" every time is actually friction.

---

## Schema compatibility notes

Our food_entries schema (from `src/lib/types.ts`):

```
FoodEntry {
  id, log_id, meal_type, food_items (string, free-text),
  calories (number|null),
  macros (Record<string, number>: fat, carbs, protein, fiber, sugar, sodium),
  flagged_triggers (string[]),
  logged_at
}
```

MyNetDiary CSV columns (from `src/lib/importers/mynetdiary.ts`):

```
Date, Meal, Food Name/Description, Amount/Serving,
Calories, Fat (g), Carbs (g), Protein (g), Fiber (g),
Sugar (g), Sodium (mg), optional Water, Cholesterol
```

Import mapping is already implemented and produced 5,781 rows cleanly. Fields map 1:1 for: date, meal_type, food_items (with amount appended), calories, macros (fat/carbs/protein/fiber/sugar/sodium). Water and cholesterol are dropped today. Possible future additions: water as separate entity, cholesterol into macros.

No new field changes are needed to food_entries for the top 3 features. All new data lives in new additive tables:

- `user_nutrition_goals` (feature 1): per-user macro/micro targets including sodium 5000mg for POTS, anti-inflammatory threshold, FODMAP preference, histamine tolerance.
- No new table for feature 2 (AI coach uses existing health_profile and pgvector).
- No new table for feature 3 (source badge is pure UI, data already has source field in our search results).

Migration numbering: highest existing is 013_orthostatic_tests.sql. Next for this plan is 014.
