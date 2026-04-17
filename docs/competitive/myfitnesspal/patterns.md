# MyFitnessPal UX Patterns Worth Stealing

Last updated: Apr 16 2026

These are observation-only patterns. We do not copy code, assets, or copy text. We rebuild into our stack, styled to the LanaeHealth sage/blush/cream palette.

Ranked by Lanae impact, 1 to 5 stars.

---

## Pattern 1: Frequency-weighted recent foods, scoped by meal type

Lanae impact: 5 stars

### What it is

When the user picks "log breakfast," MFP surfaces a list of the user's most-frequent breakfast foods first, not a flat chronological list. The order is computed server-side from usage history and weights recency and frequency together. The pattern scopes to meal type so breakfast suggestions never include last night's dinner.

### Why it works

Humans are repetitive eaters. Real diet analyses show average users have a rotation of 20 to 40 distinct meals across all slots. When the app learns the rotation, logging becomes one tap instead of a search.

MFP's variant shows three lists: Recent, Frequent, My Foods. "Frequent" is the one users gravitate to after 2 weeks of use because it surfaces stable patterns without noise from one-off meals.

### Trade-offs

- Requires historical usage data. Cold start problem for new users.
- Can entrench eating patterns. Someone eating the same "safe" food every day may want variety nudges.
- For patients logging around symptom triggers, frequent lists may bias toward "safe" foods and hide patterns.

### Adaptability to LanaeHealth

High. Lanae has 5,781 meal entries in `food_entries` which is a perfect training set. We already have `QuickMealLog.tsx` showing a local-storage "favorite meals" list. We upgrade to a server-computed frequent list from the actual `food_entries` table, grouped by meal_type, filtered to recent 90 days.

Implementation path:
- New API in `src/lib/api/food.ts` returning top-N most-frequent `food_items` strings per `meal_type` from last 90 days.
- Surface above the free-text search in `QuickMealLog.tsx`.
- Zero schema change. Read-only query over existing table.

---

## Pattern 2: Copy meal from previous day or week

Lanae impact: 5 stars

### What it is

Long-press or swipe on a prior day's meal card reveals a "copy" action. User picks a target day and meal slot, and the entries are duplicated. MFP offers copy-single-meal and copy-entire-day. The most-praised variant is "copy from yesterday" as a single-tap button on the current day's log page.

### Why it works

Chronic-illness patients cycle through predictable meal patterns during flares, luteal phases, fatigue windows, or travel. Re-typing identical meals is a friction cliff that causes logging dropout.

This pattern recognizes that most logging days are not new data, they are duplicate data. Optimizing for the duplicate case is a 10x ergonomic win.

### Trade-offs

- Copying does not update timestamps in a clean way. MFP logs everything as 9am which breaks time-of-day analysis.
- Bulk operations can mask real eating pattern variation if overused.
- Needs a clear "edit before save" affordance so users don't blindly copy when they actually ate differently.

### Adaptability to LanaeHealth

Very high. Lanae on fatigue or POTS-worsening days will benefit enormously. Cycle-phase-aware copy is a LanaeHealth-unique extension: "same meals as my last luteal flare" is a real use case.

Implementation path:
- New API in `src/lib/api/food.ts`: `copyMealsFromDate(sourceLogId, targetLogId, mealTypes[])`.
- New UI control in `QuickMealLog.tsx` or a dedicated `CopyMealButton` component: "Same as yesterday" quick button plus "Copy from other date" for longer flows.
- Re-runs `classifyFood` on copied entries so trigger tags update if classifier evolves.
- Preserves created_at as new timestamp. Does not overwrite source.

Caveat: `food_entries` is read-only to the existing 5,781 rows, but adding new rows via insert is allowed. Copy-meal is an insert-new operation, not a mutation of existing rows.

---

## Pattern 3: Barcode scanner with graceful "not found" fallback

Lanae impact: 4 stars

### What it is

MFP's scanner fires the camera, locks on to a barcode in under a second, looks it up in the database, and either (a) pre-fills a confirmation screen or (b) drops the user into a "not found, add this food" form.

The strong pattern: success case has 2 taps (confirm quantity, save). The weak pattern: failure case drops the user into a 15-field form that causes abandonment.

### Why it works

Packaged food is majority of what average Americans eat. Scanning is the single fastest entry method when it works. Speed compounds with frequency.

MFP's database coverage (14M+ items, heavily weighted US packaged goods) makes success rate feel magical.

### Trade-offs

- User-submitted entries have quality issues. Lanae needs verified data.
- Fallback form is the bottleneck. Getting abandoned on "not found" is worse than no scan at all.
- Requires a scanner library which is a weight hit (~200KB).

### Adaptability to LanaeHealth

We already have `BarcodeScanner.tsx` and `open-food-facts.ts`. Open Food Facts is a verified crowdsourced database (moderated, NOVA scored) with ~3M items and strong European coverage. US coverage is weaker than MFP but growing.

What we steal specifically:
- The 2-tap success flow: scan → pre-filled confirm → save.
- A dead-simple "not found" fallback: 3 fields max (name, quantity, meal_type). No 15-field form. Classifier fills the rest.
- Scan speed target: lock-on under 800ms, confirm screen under 200ms after lock.

Implementation path:
- Audit existing `BarcodeScanner.tsx` for speed and failure UX.
- Ensure the "not found" path routes to a minimal `QuickMealLog` free-text entry, not a big form.
- Add OpenFoodFacts first, USDA fallback, local-submitted never.

---

## Pattern 4: Macro rings visualization

Lanae impact: 3 stars

### What it is

Three concentric rings showing protein, carbs, fat progress against daily targets. Apple Health popularized the visual. MFP and others adopted it.

### Why it works

Instant visual feedback. Glanceable. Does not require numeric literacy. Ring-close animations provide positive feedback without language.

### Trade-offs

- Diet-culture coded. Rings imply "close the ring" gamification which overlaps with streak guilt.
- Macros alone are the wrong target for chronic illness. Fiber, iron, omega-3, sodium matter more for endo/POTS.
- Ring metaphor implies "complete" and "incomplete" which can distort behavior.

### Adaptability to LanaeHealth

Medium. We can borrow the visual vocabulary but swap the metrics to what matters for Lanae:
- Iron intake vs RDA (iron deficiency risk from heavy bleeding).
- Sodium vs POTS target (2.5g to 10g/day per clinician).
- Omega-3 vs anti-inflammatory target.
- Fiber vs gut-health target.

Framing is critical. Rings are progress indicators, not "goals to hit." No celebration animation when closed. No guilt for incomplete.

Implementation path:
- New `MacroRings` or `NutrientRings` component in `src/components/log/`.
- Reads from a new view over `food_entries` that aggregates daily nutrient totals via `food-classification.ts`.
- Sage primary, blush secondary, no red/gold for "complete" states.

Lower priority than patterns 1-3. Defer to Cronometer subagent which will dig deeper on micronutrient visualizations.

---

## Pattern 5: Saved meals (recurring meal templates)

Lanae impact: 3 stars

### What it is

User defines a "saved meal" like "Morning oats" with a fixed set of food items. One tap adds the whole combo.

### Why it works

Codifies repeat patterns more explicitly than frequent-foods lists. User owns the template.

### Trade-offs

- Requires user effort to set up.
- Overlaps with frequent-foods pattern for simple cases.
- Strong value only for multi-item meals.

### Adaptability to LanaeHealth

We have a localStorage "favorite meals" system in `QuickMealLog.tsx`. It is functional but local-only. Moving it to Supabase would enable cross-device, but favorite meals is lower-impact than Pattern 1 and 2 combined would address the same need.

Defer unless Lanae specifically asks for cross-device sync of favorites.

---

## Pattern 6: Recipe URL import

Lanae impact: 2 stars

### What it is

Paste a recipe URL from a popular recipe site. MFP parses the ingredients, computes nutrition, saves as a recipe. Reuse across days.

### Why it works

Lowers effort for home cooks. Valuable for people who eat varied home-cooked meals.

### Trade-offs

- Parser brittleness. Recipe sites update and break parsers.
- Ingredient list accuracy depends on the underlying food database.
- Over-engineered for someone who eats ~30 stable meals.

### Adaptability to LanaeHealth

Skip for now. Lanae's MyNetDiary history shows she logs meals as free-text ("Thai curry, 1 cup rice") rather than recipes. If she shifts to recipe-based cooking, revisit.

---

## Anti-patterns to NEVER adopt

These are explicitly out of scope for LanaeHealth. Listing them here so no future subagent accidentally ships them.

### Streak and "days in a row" gamification

Breaks on bad POTS days. Patient feels like a failure. Design-decisions.md section 8 excludes streak guilt.

### Calorie deficit projections ("at this rate you'll weigh X in Y weeks")

ED trigger. Lanae is 24, female, with complex hormonal picture. Projections are dangerous.

### "Disappointed" warnings for over-target days

Parental tone. Does not belong in a clinical tool. Lanae is an adult managing chronic illness.

### Unmoderated community forums

Liability. Diet advice in weight-loss forums is often medically inappropriate. If we add social features later, they are clinician-moderated endo/POTS communities, not general "food friends."

### Ads of any kind in the logging flow

Full stop. Logging is a clinical act.

### Paywalled data export

Data is Lanae's. Export always free.

### Paywalled barcode scanner or logging rate limits

Core logging never paywalled.
