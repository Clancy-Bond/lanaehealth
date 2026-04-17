# MyNetDiary UX Patterns Worth Stealing

Last updated: Apr 16 2026

Observation-only patterns extracted from MyNetDiary reviews, help docs, public marketing, and feature descriptions. Ranked by Lanae impact (1 to 5 stars). Patterns that conflict with LanaeHealth design rules (diet-culture shame, streak guilt, ads in logging flow) are excluded.

Since MFP has its own folder, this doc focuses on what MyNetDiary does BETTER or DIFFERENTLY than MFP. Shared patterns (barcode, meal history) live in the MFP folder.

---

## Pattern 1: Dietitian-curated food database

Lanae impact: 5 stars

### What it is

Every food entry in MyNetDiary's core database was reviewed by a registered dietitian before shipping. The app claims around 900,000 items with verified macros and micros. User-submitted foods are clearly labeled and visually demoted in search results. Duplicate entries for the same food are merged rather than proliferating.

### Why it works

Users cite this as the single biggest reason they leave MFP. When you search "chicken breast" on MFP you get 50 entries with different calorie counts, half crowd-submitted and wrong. On MyNetDiary you get the canonical entry first and variants underneath.

For chronic illness tracking the correctness matters much more than for casual calorie counting. If Lanae is calculating iron intake to manage anemia from heavy endo bleeding, a wrong iron value in a crowd-sourced entry invalidates the correlation.

### Trade-offs

- Smaller total database than MFP (900K vs 14M). Some obscure ethnic or regional brands absent.
- Cold start cost for a new app. We can't hand-curate 900K rows.
- Authority bias: users trust numbers that may still be wrong, just vetted.

### Adaptability to LanaeHealth

High. Our existing stack already has USDA FoodData Central integration (`src/lib/api/usda-food.ts`) and OpenFoodFacts (`src/lib/api/open-food-facts.ts`) both government or semi-verified. We already do better than MFP on data quality. What we DON'T do is visually signal this trust to the user.

Implementation path:
- Add a "Verified" badge on foods that came from USDA FoodData Central or OpenFoodFacts with completeness score >= 0.8.
- Sort search results by: verified-first, then user-history frequency, then external database popularity.
- Never show user-submitted ("MFP-style") entries. Use NO crowd-sourced data path. Full stop.

---

## Pattern 2: Condition-aware meal plan generator

Lanae impact: 5 stars

### What it is

MyNetDiary Premium includes a meal plan generator with preset modes for Diabetes, PCOS, Thyroid (hypo and hyper), Hypertension, Pregnancy/Lactation, Vegan/Vegetarian/Keto/Mediterranean. Each preset applies different macro targets, nutrient priorities, and food allow-lists. Output is a 7-day plan with shopping list.

### Why it works

For clinical users the generic "lose weight" calorie deficit is wrong. PCOS users want low-GI carbs and higher protein. Thyroid users want adequate iodine and selenium. The preset encodes the clinician knowledge so the user doesn't have to manually research.

Reviews consistently mention this as a lock-in feature. Once a user has a working plan they stay subscribed to keep accessing it.

### Trade-offs

- Meal plans can feel prescriptive and trigger diet-culture anxiety. Must frame as "suggestions" not "rules."
- Generation is compute-heavy (thousands of food combinations). Might need caching.
- Plans can become repetitive without variety constraints.
- Missing endo preset is a notable gap.

### Adaptability to LanaeHealth

High, with a Lanae-specific twist. We build an "Endo and POTS" preset the market has nowhere else.

Implementation path:
- New lib: `src/lib/nutrition/meal-plan-generator.ts`.
- Preset: `endo-pots-friendly` with:
  - Anti-inflammatory score >= +3 per food (using existing `food-classification.ts`)
  - Low FODMAP preference during luteal phase (pull from `cycle-calculator.ts`)
  - Sodium target 5000mg (POTS), not the generic 2300mg
  - Iron density >= X mg per 1000 kcal (heavy bleeders)
  - Histamine load weighted down if user has flare
- Use Claude via `src/lib/context/assembler.ts` to generate plan text. Cache 7 days.
- Output as a suggestion card on the Log page, not a forced plan.
- "Swap" button per meal so user retains agency.

This is one of the highest-signal differentiation plays.

---

## Pattern 3: AI Dietitian Coach with condition context

Lanae impact: 5 stars

### What it is

MyNetDiary's premium tier includes "Ria", an AI dietitian chatbot that takes into account the user's stated condition (diabetes, PCOS, etc.) when answering questions. It's not a generic LLM; it's fed guardrails and context about dietitian-reviewed answers.

Users report it gives better advice than generic ChatGPT because the system prompt restricts output to evidence-based nutrition guidance and flags when something should be doctor-reviewed.

### Why it works

Lanae's reality: she has 6 active problems (POTS, endo, borderline TSH, high cholesterol, etc.). A generic "eat more vegetables" coach is useless. A coach that knows "Lanae has POTS so recommend 5000mg sodium, not 2300" is transformative.

### Trade-offs

- LLM hallucination risk on clinical advice.
- Cost per call (Opus is expensive).
- Must surface disclaimers properly.
- Users may over-trust AI answers.

### Adaptability to LanaeHealth

High. We already have the infrastructure.

Implementation path:
- Route through existing `src/lib/context/assembler.ts` (static-dynamic boundary already set up).
- Add `nutrition-coach` persona to `src/lib/intelligence/personas/` alongside the clinical-analyst one.
- System prompt: dietitian-scope-only, reference her conditions from `health_profile`, flag anything beyond scope as "ask your doctor."
- Surface in Chat page as a tab or in the Log page as "Ask Nutrition Coach" button.
- Use `claude-sonnet-4-6` with prompt caching.
- Every suggestion includes pgvector lookup of prior similar meals so advice is data-grounded.

---

## Pattern 4: Fast-add with serving size memory

Lanae impact: 4 stars

### What it is

MyNetDiary claims 10-second meal logging in the re-add flow. The trick: when you log "2 eggs" at 150g, the next time you tap the eggs entry it auto-fills 150g, not 100g. Serving-size defaults are per-food and per-user.

### Why it works

Real users don't log "100g chicken" they log "my usual chicken portion." The app learning "my usual" by remembering last-used serving per food trims tap count dramatically.

### Trade-offs

- Requires a `last_serving` column or separate table. We have neither. Food_entries doesn't store serving size separately, it's baked into `food_items` string.
- Multi-serving foods (a whole recipe) muddy the concept.

### Adaptability to LanaeHealth

Medium. Our 5,781 existing `food_entries` store `food_items` as free text like "2 eggs (150g)" with no structured quantity field. To add true serving memory we'd need a new additive table or modify how `food_items` parses.

Implementation path:
- Defer until we have ranked features 1 through 3 shipped.
- When ready, add `food_servings` table keyed on normalized food name, with last-used quantity and unit.
- On autocomplete select, pre-fill the quantity from this table.

---

## Pattern 5: Water and intermittent fasting as first-class top-level tabs

Lanae impact: 4 stars

### What it is

Water tracker and IF timer aren't buried in settings. They're on the main dashboard, same level as "Log food." Water has glass-fill animation per unit consumed. IF timer shows fasting window progress ring.

### Why it works

For POTS patients hydration is prescribed therapy. Burying water in a sub-menu is friction. Elevating it makes daily compliance more likely. IF timing can help some endo patients with inflammation (though evidence is mixed).

### Trade-offs

- IF for Lanae specifically may not be appropriate. She has low BMI and endo flares can worsen with caloric restriction. Show IF only if user opts in.
- Visual real-estate cost on a small screen.

### Adaptability to LanaeHealth

High for water. Medium for IF.

Implementation path:
- Water: we already have `HydrationRow.tsx` on the log page. Check if it's prominent enough. Add glass-fill micro-animation. Hydration reminder push notifications already exist via `src/lib/notifications.ts`.
- IF timer: build as optional add-on, off by default. Only surface if user explicitly enables in settings. Frame as "eating window" not "fasting" to soften diet-culture tone.

---

## Pattern 6: Weight trend prediction with adaptive TDEE

Lanae impact: 2 stars

### What it is

MyNetDiary has weight trend prediction that extrapolates current calorie deficit into future weight based on historical intake and weight logs. Similar to MacroFactor's adaptive TDEE but simpler.

### Why it works

Users want a visual "you'll hit goal by X date" line. Motivating for weight-focused users.

### Trade-offs

- Diet-culture core. Lanae does not track for weight. Skip.

### Adaptability to LanaeHealth

Skip. Conflicts with our anti-diet-culture stance. Document considered and declined.

---

## Pattern 7: Photo food logging

Lanae impact: 3 stars

### What it is

Camera button on log screen. Snap a meal photo, AI identifies foods and quantities, user confirms.

### Why it works

On days when fatigue is high, typing a meal is too much. A photo is 2 taps.

### Trade-offs

- AI accuracy drops on mixed dishes, ethnic cuisine, leftovers.
- Network-dependent.
- Premium feature gated in MyNetDiary.
- Users report 8-12s latency, not the "15 seconds" MyNetDiary advertises.

### Adaptability to LanaeHealth

Medium. We already have Claude vision available via the Anthropic SDK. Our food classifier can post-process.

Implementation path:
- New component `PhotoFoodLog.tsx` under `src/components/log/`.
- API route `src/app/api/food/photo/route.ts` that accepts image, calls Claude with structured output schema, returns food_items string and estimated calories.
- Auto-run existing `classifyFood` on the result.
- Fallback: if confidence low, show user the best guess and let them edit before saving.
- This is a medium-sized build. Defer until top 3 ship.

---

## Pattern 8: Weekly nutrient summary email or report

Lanae impact: 4 stars

### What it is

MyNetDiary Premium sends a weekly email summarizing average macros, micros, water intake, calories, and trend. Simple text format with a few bar charts.

### Why it works

Passive surface for people who log daily but don't review. The summary triggers self-reflection without demanding it.

### Trade-offs

- Needs a scheduled job. We don't have one for emails yet.
- Email deliverability is a whole other problem.

### Adaptability to LanaeHealth

Medium. For Lanae specifically we could surface this as a "Weekly" tab in the Patterns page rather than email. Pull from her 5,781 food_entries and compute rolling weekly averages.

Implementation path:
- Extend `src/lib/api/food.ts` with `getWeeklyNutrientSummary(date)`.
- New component `WeeklyNutrientSummary.tsx` on Patterns page.
- Include iron, sodium, fiber, anti-inflammatory score, FODMAP load, histamine load.
- Cycle-aware: compare luteal vs follicular averages.

---

## Pattern 9: Body measurements tracking (non-weight)

Lanae impact: 3 stars

### What it is

MyNetDiary lets users track neck, chest, waist, hips, thighs, arms, body fat percentage separately from weight. Charts over time.

### Why it works

Weight can be misleading, especially for bloating-heavy conditions like endo, PCOS, POTS. Waist circumference and body composition are more informative.

### Trade-offs

- Not a high-value feature for Lanae specifically. She already tracks bloating via `BloatingSlider.tsx`.

### Adaptability to LanaeHealth

Low priority. Skip unless Lanae explicitly requests it.

---

## Pattern 10: Diabetes diary with blood sugar alongside carbs

Lanae impact: 3 stars

### What it is

Premium+ tier shows glucose reading next to each meal's carb count. Scatter plot of carbs vs post-meal glucose shows insulin sensitivity patterns.

### Why it works

Diabetics need to see carb-to-glucose correlation directly. Clinical signal.

### Trade-offs

- Lanae isn't diabetic (as far as we know). Borderline fasting glucose from POTS but no CGM.
- Low utility without a CGM or manual glucose input.

### Adaptability to LanaeHealth

Low for Lanae now. Keep in matrix as future-ready if she ever wears a CGM (Nutrisense, Levels, etc.).

---

## Signal summary: What MyNetDiary beats MFP on

| Axis | MFP | MyNetDiary | Lanae implication |
|------|-----|------------|-------------------|
| Database curation | Crowd-sourced, inconsistent | Dietitian-reviewed | MyNetDiary wins. We build on USDA/OpenFoodFacts. |
| Condition presets | None | Diabetes, PCOS, Thyroid, etc. | MyNetDiary wins. We add endo and POTS (market gap). |
| AI coach | None | Yes (Ria) | MyNetDiary wins. We build cycle-aware coach. |
| Meal plan generator | Recipe tools only | Full 7-day plans | MyNetDiary wins. |
| Water as first-class | Weak | Strong | MyNetDiary wins. |
| IF timer | None | Yes | MyNetDiary wins. Lanae-optional. |
| Weekly nutrient report | Limited | Strong | MyNetDiary wins. |
| Photo food | Yes (premium) | Yes (premium) | Tied. We can match. |
| Community | Very strong (social) | Very weak | MFP wins. Not a Lanae priority. |
| Barcode scanner | Strong | Strong | Tied. |
| Ad experience | Hostile | Tolerable | MyNetDiary wins. |
| Non-diet-culture tone | Bad | Moderate | MyNetDiary wins. We push further. |

Net conclusion: for a chronically-ill single-patient app MyNetDiary is a better replication target than MFP across every axis that matters except database size. Our MFP research gave us the import fundamentals; MyNetDiary research gives us the clinical depth.
