# Overnight Build Log — 2026-04-17 / 04-18

**Author:** Claude (autonomous mode)
**Rules (set by Clancy before sleep):** Don't stop. Don't ask permission.
Pick the best option and ship. Commit + push after each feature. Use
competitor-research mirrors + MCP Chrome tab with live MyNetDiary.

## Session shape

I write to this file every time I ship a tier. Read the **Completed
Tiers** section first in the morning — that's the punch list of what
works now. **Current Focus** is what's in progress. **Known Gaps** is
what I consciously deferred so morning-you doesn't redo them.

## Completed Tiers

_Populated as I ship. See git log for full details._

## Current Focus

_Whatever is actively in flight._

## Known Gaps / Defers

_Things I hit and chose to skip rather than block overnight work._

## Roadmap (15+ tiers)

### Tier 0 — Harvest MyNetDiary screens (research only)
Navigate every nav tab (Dashboard, Plan, Food, Exercise, Analysis,
Health, Community, Settings) + every sub-page. Screenshot + read-page
each. Cache findings in `docs/competitive/mynetdiary-observed-ux.md`
for reference when building.

### Tier 1 — Top navigation bar
`<TopNav>` component wired into `src/app/layout.tsx`. Tabs:
  - Home (/)
  - Calories (/calories)
  - Doctor (/doctor)
  - Symptoms (/log)
  - Cycle (/topics/cycle)
  - Labs (/records or /imaging-adjacent)
  - Patterns (/patterns)
  - Imaging (/imaging)
Highlight active tab by pathname. Responsive: tabs collapse to scroll
on narrow screens.

### Tier 2 — Food search sidebar
`/calories/search` with left-sidebar IA from MFN:
  - Search
  - Staple Foods
  - Favorites
  - Frequent Foods
  - Recent Meals
  - Custom Foods
  - Premium Recipes (call ours "Curated Recipes")
  - My Recipes
  - My Meals
Each navigator list uses existing `/api/food/search` for USDA foods
and food_entries for history.

### Tier 3 — Inline search + food detail
`/calories/food` gets inline `FoodSearchAutocomplete` per meal section
(no redirect to /log). Clicking a result opens `/calories/food/[fdcId]`
with portion/serving selector + full nutrient grid + "Add to [meal]"
button. Uses existing USDA + Open Food Facts backbone.

### Tier 4 — Plan (goals)
`/calories/plan` editable:
  - Calorie target
  - Macro split (carbs/protein/fat g or %)
  - Weight goal (current + target + timeline)
  - Activity level
Writes to `health_profile` jsonb (additive only).

### Tier 5 — Analysis
`/calories/analysis` uses CIE reasoning to produce diet tips based on:
  - Today's macros vs targets
  - Week's trends
  - Symptom + food correlation from existing correlation_results
  - POTS sodium sufficiency
  - Migraine trigger detection in today's foods
Falls back to "log 400+ calories" prompt when insufficient data.

### Tier 6 — Weight tracking
Migration 028: `weight_entries` table (id, date, weight_kg, notes).
Page at `/calories/health/weight` with: Weigh-In modal, trend chart,
7/30/90-day views. Weight Plan card on /calories dashboard.

### Tier 7 — Water intake
Migration 029: `water_intake_entries` (id, date, glasses_count).
Glass counter + tap to log on /calories dashboard (replaces the
placeholder Water tile).

### Tier 8 — Oura activity surfacing
Oura stores daily activity in `oura_daily.raw_json.oura.activity`
(not currently extracted). Lift steps + active calories to tiles on
/calories dashboard (replaces Exercise + Steps placeholders).

### Tier 9 — Food quality grade
Compute "Fd. Grade" (A-F) from USDA nutrient density:
  - A: high fiber, high protein, low saturated fat, no trans fat,
       low sodium relative to calories
  - F: ultra-processed, high sugar, high sodium, trans fat present
Show grade badge on search results + food detail.

### Tier 10 — Year-in-Pixels (Daylio)
`/home` component or `/calories/year` showing 365 days as a pixel
grid. Color by pain score (current CalendarHeatmap logic, extended).

### Tier 11 — Micronutrient expansion (Cronometer)
Extend macros jsonb to track 25+ micros: vit A, C, D, E, K, B1-B12,
folate, calcium, iron, magnesium, phosphorus, potassium, zinc, copper,
manganese, selenium, chromium, iodine, molybdenum. USDA already has
these; just map them through.

### Tier 12 — Hormone tracking (Stardust)
Migration 030: `hormone_levels` (id, date, hormone, value, unit,
source[self|lab|wearable]). Log estrogen/progesterone/testosterone
when Lanae has lab values.

### Tier 13 — Emergency wallet card (Guava)
`/emergency` route with wallet-sized (3.375"x2.125") print-mode CSS.
Populated from health_profile: conditions, meds, allergies, POTS
note, blood type, emergency contact, physician.

### Tier 14 — AI food photo
Wire existing `/api/food/identify` into a camera icon on
FoodSearchAutocomplete. Match MyFitnessPal's "Meal Scan" + Lose It's
"Snap It" but ours stays free.

### Tier 15 — Polish + graphics
  - Animated apple ring on /calories
  - Gradient headers on topic pages
  - Icon system (current emoji-sparse)
  - Loading skeletons
  - Empty-state illustrations

## Process rules

1. Typecheck after every change. If tsc fails, don't commit.
2. Test after every lib change. `npx vitest run <relevant>`.
3. Commit with real messages (not "wip"). Each commit stands alone.
4. Push after every commit. `git push`.
5. Each tier = 1-5 commits.
6. Progress updates appended to the **Completed Tiers** section here
   after each tier ships.
7. If a tier turns out to be harder than expected, I split it and
   ship what I have, log the remainder to **Known Gaps**, and move on.
8. Never modify existing Supabase data. Migrations are additive only.

## Emergency brake

If I hit something genuinely dangerous (data loss risk, destructive
git op, financial interaction, PII exfiltration risk) I stop and
write a clear note to this doc with tag `[BLOCKED]`. Morning-you
picks it up.
