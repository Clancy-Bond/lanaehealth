# MyNetDiary Parity Audit (2026-04-19)

**Goal:** Achieve 1:1 feature parity in the `/calories` section.
Every feature MyNetDiary has, we have. Every gap is tracked here
and fixed before this doc can be marked closed.

**Source observations:** MCP Chrome tab logged into MyNetDiary on
2026-04-17, full text reads + screenshots of the Dashboard and Food
tabs. Plan / Exercise / Analysis / Health / Community / Settings
tabs required re-login and will be audited in a second pass.

## Bugs fixed today (2026-04-19)

- **Bug #1** (React #418, food detail): nested `<form>` tags caused
  hydration mismatch. Fixed in commit `a8376a4`.
- **Bug #2** (search sorted Branded first): alphabetical sort put
  junk-data Branded foods above Foundation. Fixed in `b700394`.
- **Bug #3** (all nutrients null): USDA `/food/{fdcId}?nutrients=`
  param returns 0 nutrients silently. Removed filter in `b700394`.
  Before fix: every food_entries row had `calories=null, macros={}`.
  After fix: cal=85 for banana, cal=395 for 0.25 serving oatmeal, etc.
- **Bug #4** (orthostatic 500): `test_time NOT NULL` constraint
  violated when caller omitted it. Fixed in `da420c8`.

## MyNetDiary DASHBOARD tab (dashboard.do)

| Feature | MFN has | We have | Gap |
|---|---|---|---|
| Apple ring central widget | ✅ green 1,761 / 0 / Left 1,761 | ✅ CalorieApple on /calories | none |
| Exercise tile (left) | ✅ shows calories burned | ✅ Exercise tile, reads Oura active calories | none |
| Steps tile (left) | ✅ shows step count | ✅ Steps tile, reads Oura daily_activity | none |
| Water tile (left) | ✅ glasses count | ✅ WaterStat with +/- buttons | none |
| Notes tile (left) | ✅ paperclip | ✅ Notes tile reads daily_logs.notes | none |
| Breakfast tile (right) | ✅ calories | ✅ MealBucket Breakfast | none |
| Lunch tile (right) | ✅ | ✅ MealBucket Lunch | none |
| Dinner tile (right) | ✅ | ✅ MealBucket Dinner | none |
| Snacks tile (right) | ✅ | ✅ MealBucket Snacks | none |
| Macro bars below ring | ✅ Carbs/Protein/Fat with % cals + left g | ✅ MacroBars component | none |
| Day strip 20+ days | ✅ small dots per day | ✅ WeekStrip 30 days with calorie totals | none (we have more) |
| Daily Analysis prompt | ✅ "Log more than 400 cal..." | ✅ DailyAnalysisPrompt | none |
| Weight Plan card with trajectory chart | ✅ "lose 20 lb in 140 days" + chart | ❌ **GAP #1** | FIX: add inline weight-plan card on /calories |
| Current Weight card (Weigh-in/Plan/Chart buttons) | ✅ | ⚠️ Weight tile links to /calories/health/weight but no inline buttons | FIX: expand weight tile or add Current Weight card |
| Tips/Advice card | ✅ "Foods to help you build an iron-rich diet..." | ❌ **GAP #2** | FIX: surface clinical advice card |
| Customize Dashboard button | ✅ gear icon, rearrange widgets | ❌ **GAP #3** | FIX: stub for now (Phase 2 full customization) |
| Calendar date nav | ✅ prev/today/next | ✅ DateNav | none |
| "PREMIUM PLANNING" banner | ✅ MFN upsell | N/A we're free | skip |

## MyNetDiary FOOD tab (meals.do)

| Feature | MFN has | We have | Gap |
|---|---|---|---|
| 9-column nutrient table | ✅ Food/Cal/Carb/Pro/Fat/Fd.Grade/Sat.Fat/Trans Fat/Fiber/Sodium/Calcium | ⚠️ Have columns but NO **Fd. Grade column** | FIX: add Fd. Grade column (GAP #4) |
| BREAKFAST section + ADD button + inline search | ✅ | ⚠️ Have section + Add link but no inline search field | FIX: add inline quick-search per meal (GAP #5) |
| LUNCH / DINNER / SNACKS same pattern | ✅ | ⚠️ same as above | FIX: same |
| Daily totals row | ✅ | ✅ | none |
| "Left vs target" row | ✅ | ✅ | none |
| Macro summary bars at bottom | ✅ 3 bars (Carbs/Protein/Fat) with % cals + X% under | ✅ MacroSummary component | none |
| Apple ring at bottom of Food tab | ✅ | ❌ we only show it on Dashboard | FIX: add same ring (GAP #6) |
| Vertical nutrient bars (Sat.Fat, Trans Fat, Fiber, Sodium, Calcium) | ✅ | ⚠️ "left vs target" row has them but not as bars | acceptable, nice-to-have only |
| Collapse/expand per meal section | ✅ chevron per section | ❌ **GAP #7** | FIX: collapsible sections |
| Overflow menu per meal (copy, reorder) | ✅ | ❌ **GAP #8** | FIX: per-meal ⋮ menu |

## MyNetDiary FOOD SEARCH (sidebar opened from Add button)

| Feature | MFN has | We have | Gap |
|---|---|---|---|
| Search navigator sidebar | ✅ 9 items | ✅ 9 items | none |
| Popular [meal-type] foods list | ✅ 9 breakfast staples on empty search | ✅ STAPLE_BREAKFAST array | none (but only breakfast; MFN dynamically picks by meal) |
| Search by name/brand/restaurant | ✅ | ✅ USDA search | none |
| Staple Foods | ✅ categorized list | ⚠️ only breakfast hard-coded | FIX: expand to lunch/dinner/snack (GAP #9) |
| Favorites (star to pin) | ✅ | ❌ stub | FIX: star action + persistence (GAP #10) |
| Frequent Foods | ✅ | ✅ from food_entries grouped | none |
| Recent Meals | ✅ | ✅ | none |
| Custom Foods | ✅ + form | ✅ + form | none |
| Premium Recipes | ✅ MFN paywalled | ❌ stub | skip (we call these Curated Recipes) |
| My Recipes | ✅ | ✅ builder at /calories/recipes/new | none |
| My Meals (save meal combo) | ✅ | ❌ stub | FIX: meal templates (GAP #11) |
| BACK TO MEALS link top-left | ✅ | ✅ | none |
| SETTINGS gear top-right | ✅ customize columns shown | ❌ **GAP #12** | FIX: stub |
| Help icon | ✅ | ❌ | acceptable, low priority |

## MyNetDiary FAB ("+" button on Dashboard)

| Feature | MFN has | We have | Gap |
|---|---|---|---|
| Log Breakfast | ✅ | ❌ no FAB | FIX: add FAB (GAP #13) |
| Log Lunch | ✅ | ❌ | same |
| Log Dinner | ✅ | ❌ | same |
| Log Snacks | ✅ | ❌ | same |
| Log Exercise | ✅ | ❌ | same |
| Enter Body Weight | ✅ | ❌ | same |

We have `/log` and QuickActions on Home, but `/calories` itself
does NOT have a MFN-style blue "+" FAB. Adding that closes the gap.

## MyNetDiary PLAN / EXERCISE / ANALYSIS / HEALTH / COMMUNITY / SETTINGS tabs

Requires re-login in MCP Chrome tab to audit live. From memory /
prior text dumps:

- **Plan tab**: weight goal editor (current + target + date), calorie
  + macro targets, activity level. We have this at `/calories/plan`.
- **Exercise tab**: log workouts. We have this via Oura integration
  (sync) and `/activity` dashboard, but no manual workout logger.
  **GAP #14**: manual workout entry form.
- **Analysis tab**: MFN's Daily Analysis. We have `/calories/analysis`
  (pattern-based insights). MFN also has longer-form reports
  (weekly, monthly). **GAP #15**: period-over-period comparison.
- **Health tab**: blood pressure, weight, HR, etc. We have weight at
  `/calories/health/weight`. **GAP #16**: BP + HR log pages under
  `/calories/health/*`.
- **Community tab**: MFN forums. Out of scope.
- **Settings tab**: account + data export + preferences. We have
  `/settings` already (pre-existing).

## Prioritized fix list (all tracked as GAP #N above)

**Tier A — Dashboard parity (highest visual impact):**
- GAP #1: Weight Plan card on /calories
- GAP #4: Fd. Grade column in Food tab
- GAP #13: "+" FAB on /calories

**Tier B — Table / section polish:**
- GAP #7: Collapsible meal sections
- GAP #6: Apple ring at bottom of Food tab
- GAP #2: Tips/Advice card on Dashboard
- GAP #8: Per-meal ⋮ menu (copy, reorder)

**Tier C — Search sidebar completion:**
- GAP #9: Staple foods for all 4 meal types
- GAP #10: Favorites star-toggle persistence
- GAP #11: My Meals template save
- GAP #12: Settings gear for Food tab customization

**Tier D — Backlog (requires re-login or larger build):**
- GAP #3: Customize Dashboard drag-drop (Phase 2)
- GAP #5: Inline search field per meal (alternative to FAB / sidebar)
- GAP #14: Manual workout entry
- GAP #15: Weekly / monthly Analysis reports
- GAP #16: BP / HR log at /calories/health/\*

## Exit criteria

This doc is marked CLOSED only when:
1. Every ✅ for MFN has a matching ✅ for us in Tier A + B.
2. Tier C is either shipped or marked "Phase 2" by Clancy.
3. Tier D gets a dated follow-up plan.
4. All fixes E2E-verified via Playwright (click-through + data
   persistence + console error = 0).
