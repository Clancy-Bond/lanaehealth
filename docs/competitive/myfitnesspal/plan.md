# MyFitnessPal Implementation Plan

Last updated: Apr 16 2026

Ranked table of features to pull from MyFitnessPal into LanaeHealth. Ranking formula: `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Top 3 flagged for implementation-notes.md.

---

## Ranked feature table

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Notes | TOP 3 |
|------|---------|----------------|---------------------|-------------------|------------|-------|-------|
| 1 | Frequency-weighted meal suggestions per meal type | Pattern 1 | 5 | S | Read-only aggregate query on `food_entries` | Uses Lanae's 5,781 meals as training data. Surfaces top N frequent entries per `meal_type` in the last 90 days. Beats local-storage favorites. | YES |
| 2 | Copy meal from yesterday, or any prior date, to today | Pattern 2 | 5 | S | Insert-new rows to `food_entries` | "Same as yesterday" button on Log page. Additive only, never mutates existing 5,781 rows. Cycle-phase-aware suggestion is the LanaeHealth edge. | YES |
| 3 | Graceful barcode "not found" fallback to 3-field quick add | Pattern 3 | 4 | S | Existing `BarcodeScanner.tsx`, `QuickMealLog.tsx` | Route failure path to minimal free-text entry. Classifier fills trigger tags. No 15-field form. | YES |
| 4 | Nutrient rings (iron, sodium, omega-3, fiber) reframed from macro rings | Pattern 4 | 3 | M | Aggregate query + classifier enrichment + new chart component | Borrow visual vocabulary, swap metrics to endo/POTS-relevant nutrients. Defer to Cronometer subagent for depth. | |
| 5 | Cross-device saved meals (upgrade localStorage to Supabase) | Pattern 5 | 3 | M | New `saved_meals` table, additive migration | Low marginal value given Pattern 1 solves similar need. | |
| 6 | Recipe URL import and parser | Pattern 6 | 2 | L | New API route, third-party parser or LLM | Lanae does not log as recipes. Skip unless asked. | |
| 7 | Scan-to-pre-filled confirm screen under 800ms lock-on | Pattern 3 subpart | 3 | M | Benchmark existing `BarcodeScanner.tsx`, optimize if slow | Worth measuring current perf before rebuild. | |
| 8 | Copy whole day (all meals) to another day | Pattern 2 variant | 4 | S | Same as rank 2, just multi-meal batch | Bundle with rank 2 if cheap. | |
| 9 | Search autocomplete that ranks by user history, not global popularity | Pattern 1 variant | 4 | M | Requires weighting logic in `FoodSearchAutocomplete.tsx` | Useful follow-up to rank 1. | |
| 10 | Meal-time-aware default meal_type (morning = breakfast, etc.) | UX polish | 3 | S | Clock check in `QuickMealLog` default state | Very small but pleasant. Might already be in place. | |
| 11 | Ad-free, export-free, no-paywall logging (negative feature, i.e., the absence) | Anti-pattern | 5 | S | Policy, not code | Already true in LanaeHealth. Documented here so future product decisions preserve it. | |

---

## Top 3 selected

**1. Frequency-weighted meal suggestions per meal type**
Score: `(5*2) / 1 = 10`. Highest impact per unit effort. Read-only.

**2. Copy meal from yesterday or prior date**
Score: `(5*2) / 1 = 10`. Tied top. Additive inserts only. High ergonomic win for fatigue days.

**3. Graceful barcode not-found fallback**
Score: `(4*2) / 1 = 8`. Patches existing weak spot in our scanner UX. Same-day quick fix.

All three are Small effort. Bundle into a single implementation sprint. Estimated total time under 12 hours for a focused implementation subagent.

---

## Deferred

Rank 4 (nutrient rings) is a natural follow-up once the Cronometer subagent completes its research, since nutrient tracking depth is Cronometer's territory. Revisit after Cronometer's implementation-notes.md is written.

Rank 5 (cross-device saved meals) overlaps enough with Rank 1 that we should see how Lanae uses Rank 1 before investing.

Ranks 6 through 10 are lower priority and can live in the backlog.

Rank 11 is a constraint, not a feature. It lives in design-decisions.md.
