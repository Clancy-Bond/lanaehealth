# MyNetDiary Frames — Calories Section Curation

Curation map of canonical MFN reference frames to v2 calories routes. Used during Session 02 (v2 calories rebuild). All frames live under `docs/reference/mynetdiary/frames/full-tour/` (symlinked to sibling worktree; gitignored per `docs/reference/*/frames`).

Total source frames: 424. Canonical frames listed below; the rest are either duplicates, mid-animation captures, or explicitly excluded (upsell/social — see bottom).

---

## `/v2/calories` — Dashboard (today view)

Apple calorie ring + macros row + meals list + AI coach + trend content.

Canonical:
- `frame_0030.png` — Default dashboard. 1,896 cal budget, green ring showing 1,868 consumed, exercise/steps/water sidebar, meal cards (Breakfast 502 / Lunch 204 / Dinner 720 / Snacks 442), AI Coach section.
- `frame_0370.png` — Weight Goal & Plan section visible on dashboard.
- `frame_0380.png` — Daily Advice cards (On the Go, Top Picks for Travel, Recipe of the Day, Feature article preview).
- `frame_0390.png` — Weight In card (145.1 lb) + Weight Goal & Plan card.
- `frame_0400.png` — Dashboard variant, different date, Weight Goal & Plan section expanded.

Notes: use `frame_0030` as primary visual spec. v2 strips MFN's AI Coach / Daily Advice / 30% OFF badge; keeps the ring + macros + meals pattern.

Excluded: any frame with "Sale 30%" badge, "Expert Tips" carousel, "Go Premium" promo tile.

---

## `/v2/calories/food` — Food log (All Meals view)

List of all meals with per-meal headers, items beneath, per-meal totals, Day Totals, expandable Day Macros / Day Nutrients.

Canonical:
- `frame_0035.png` — All Meals default. Today date picker, Breakfast 502 / Lunch 204 / Dinner 720 / Snacks 442, individual items, Day Totals 2,368 cals, Day Macros + Day Nutrients expandable sections, bottom action buttons.
- `frame_0210.png` — All Meals variant, Breakfast 1,002 cals, Generic food item (500 cals).
- `frame_0305.png` — Extended scroll view, multiple food items per meal visible, bottom action buttons.

Notes: v2 MealSectionCard models the per-meal header pattern. Kebab menu per meal, inline add row beneath last item per MFN convention.

Excluded: `frame_0175.png`, `frame_0220.png`, `frame_0250.png`, `frame_0265.png`, `frame_0290.png`, `frame_0310.png` (all contain 30% OFF banner overlays).

---

## `/v2/calories/food/[fdcId]` — Food detail with FDA Nutrition Facts

Food photo, portion chip strip, big calorie total, macros pie, FDA nutrition facts table, save button.

Canonical:
- `frame_0045.png` — Milk detail. 2 fl oz = 33 cals, portion chip strip (2 fl oz, 2.25 fl oz, 2.30 fl oz, fl oz, ml), Save button, Macros pie (65% carbs, 25% protein), My Nutrients.
- `frame_0050.png` — Milk, numeric portion input visible.
- `frame_0055.png` — Full FDA Nutrition Facts table (Total Fat, Saturated, Trans, Total Carbs, Fiber, Sugar, Protein, Sodium, Calcium), "Show All Nutrients" link, supplementary actions (Send Photos, Add Auto Logging, Copy & Customize, Food Label, Compare, Settings, Help, Videos).
- `frame_0160.png` — Mochi Crunch, 25.8g = 97 cals, numeric entry pad with fraction buttons, Macros pie (3% carbs, 90% protein, 2% fat).
- `frame_0190.png` — Red Sauce Pasta Sauce, 276g = 204 cals, full portion pills and numeric pad.
- `frame_0230.png` — Butter salted, 7g = 51 cals (high-fat example, different pie distribution).
- `frame_0240.png` — Morning Rounds Blueberry, 2 buns = 320 cals (serving-unit example).
- `frame_0260.png` — Bourbon vanilla bean paste, 1/2 tsp = 8 cals (tiny-portion example).
- `frame_0280.png` — Organic blue agave, 1/2 tsp = 10 cals (broad portion-unit menu: tsp, tbsp, ml, fl oz, g, oz, cup, lb).

Notes: v2 simplifies the full FDA table per `flows.md:33` — collapsed-by-default `NutritionFactsCardV2` with expand toggle. Portion chip strip is essential; keep horizontal-scroll pattern.

Excluded: supplementary helper links ("Send Photos", "Food Label", "Compare") — out of scope for v2.

---

## `/v2/calories/search` — Search modal with top tabs

Tab strip: **Search / Scan / Favorites / Staple Foods / Custom Foods / My Meals / My Recipes / Recent Meals** (8 tabs; Premium + Friends stripped).

Canonical:
- `frame_0040.png` — Search tab active. Query "M", frequent dinner foods (Meat beef filet mignon 166 cals, Crispy chili with garlic 43 cals), keyboard visible.
- `frame_0060.png` — Barcode Scan tab active. Full-screen camera with corner guides, "Hold at least 6" away. Avoid glare and shadows." guidance, green "Enter Barcode" button.
- `frame_0080.png` — Barcode Scan in progress state.
- `frame_0090.png` — Scan tab ready state.
- `frame_0100.png` — Scan header close-up.
- `frame_0180.png` — Custom Foods tab empty state.
- `frame_0200.png` — **Customize Search Tabs modal.** Confirms canonical tab order: Search, Scan, Favorites, Calories, Staple Foods, Custom Foods, My Meals, Premium (red dot = disabled/premium), My Recipes, Recent Meals, Friends (red dot = disabled/social). We map this to 8 tabs by dropping Premium, Friends, and the Calories sub-tab (MFN upsell-adjacent).

Notes: `frame_0200` is the authoritative source for tab order. v2 uses the new `TabStrip` primitive with horizontal scroll + auto-scroll-into-view on active. Scan tab ships as stub empty state.

Excluded: Premium tab (red dot in frame_0200), Friends tab (red dot), Calories sub-tab (upsell-adjacent — MFN uses it for Premium calorie analysis unlock).

---

## `/v2/calories/photo` — Photo meal log (STUB)

No dedicated photo-meal-capture screens observed in the 424-frame tour. Food-detail cards use product catalog imagery, not user-captured meal photos.

v2 implementation: ship honest "coming soon" `EmptyState` with link to Search tab, since `/api/food/identify` is a backend stub.

---

## `/v2/calories/plan` — Calorie + nutrition plan

Weight Goal & Plan tabs: Overview / Weight & Calories / Macros / Nutrients / Exercise / Advanced Plan.

Canonical:
- `frame_0340.png` — My Weight Goal & Plan, Overview tab. "I plan to lose 9.8 lb in 92 days by eating less than 1,807 cals." Weight Planning (Current 144.8 lb, Target 135 lb, Weekly Rate lose 0.75 / week, Projected Target Date Jul 20). Food Calorie Budget 1,807. Advanced Autopilot section.
- `frame_0350.png` — Plan History table. Columns: Date Updated, Target Weight (lb), Target Date, Rate (/week), Budget (cals). 10+ historical plan versions.
- `frame_0360.png` — Weight & Calories tab. Weight Planning details, Cycling tab indicator.

Notes: v2 ships Overview + Weight & Calories equivalents as a single editable form; Plan History and Advanced Autopilot are out of scope.

Excluded: Advanced Autopilot illustration (frame_0340 bottom half — MFN premium feature).

---

## `/v2/calories/analysis` — Trends / macros analysis

Three sub-tabs: Summary & Foods / Meal Analysis / Cals from Nutrients. Time range selector (7D / 14D / 30D / Custom).

Canonical:
- `frame_0010.png` — Summary & Foods tab. Date range Apr 13-19, top contributor (Taco Bell crunch wrap 442 cals), Day Food Report, Day Foods by Calorie.
- `frame_0020.png` — Meal Analysis tab. Calorie Distribution pie (30% / 57% / 13%), Actual vs Plan comparison bars, Average Daily Macronutrient Grams.
- `frame_0025.png` — Cals from Nutrients tab. Which foods provided most calories over 7-day / 14-day spans.
- `frame_0203.png` — Time range selector + Calorie Distribution pie + Actual vs Plan comparison.

Notes: v2 uses 3-tab `AnalysisSubTabs` + 30-day sparkline across all tabs. Derive meal breakdown locally from `getFoodEntriesByDateRange`.

---

## `/v2/calories/custom-foods/new` — Add custom food

No dedicated form-editor screenshots captured in the tour. MFN Custom Foods tab (frame_0180) shows empty state only.

v2 implementation: minimal form — name, serving label, calories, macros. Lower polish per session brief.

---

## `/v2/calories/recipes/new` — Add recipe

No dedicated recipe-editor screenshots captured in the tour. Recipe menu items visible in the Me screen (frame_0410: Recipe Import, Recipe Database).

v2 implementation: minimal form — name, ingredients picker, servings. Lower polish per session brief.

---

## `/v2/calories/meal-delete` — Meal bulk delete confirmation

No dedicated delete-confirmation screenshots in the tour. MFN delete flow likely inline (kebab → Delete → confirm).

v2 implementation: dedicated confirmation route per legacy pattern (`/calories/meal-delete?id=&returnTo=`). POST to `/api/calories/meal/delete` with `{ confirm: "yes" }` (required by existing API).

---

## `/v2/calories/health/weight` — Weight tracker

- `frame_0350.png` — Plan History table showing weight targets + budgets over time.

No dedicated current-weight-view screenshot in the tour (weight is embedded in Plan view).

v2 implementation: standalone route with current weight card, 30-day sparkline, weigh-in form. Reuses Sparkline pattern from dashboard + analysis.

---

## Quick Calories entry (secondary — not in session scope)

- `frame_0170.png` — Quick Calories modal. Dinner selected, Calories required field, Macros dropdown (T. Carbs, Protein, Fat optional), Name field optional, green Log button, numeric keypad.

Notes: v2 does not ship a separate "Quick Calories" entry point. The `QuickLogFabV2` menu on the dashboard covers fast entry via meal links.

---

## Explicitly excluded (DO NOT replicate)

Upsell / promo patterns:
- "Limited time offer / 30% OFF / Claim Now" banner — appears on frames 0035, 0175, 0220, 0250, 0265, 0290, 0305, 0310
- "MyNetDiary Premium 30%" badge — frames 0030, 0400 bottom
- "Go Premium, Get Results" CTA — frame 0360
- "Unlock Premium tools for your success" + "Explore Premium" — frame 0410

Premium / subscription tabs and features:
- Premium tab in search — frame 0200 (red dot)
- Advanced Autopilot illustration — frame 0340
- Recipe Database / Recipe Import menu items — frame 0410
- Vary Calorie Budget by days upsell — frame 0360

Social:
- Friends tab in search — frame 0200 (red dot)
- Social feed (if any)

Lifestyle marketing:
- "5 Expert Tips for Maintaining Weight Loss" — frame 0390
- "Top Picks for Healthy Travel Snacks" — frame 0380
- "Recipe of the Day" — frame 0380
- "On the Go?" advice card — frames 0370, 0380, 0390
- Feature Articles / Trends content

Login / account setup:
- Personal Info menu item — frame 0410 (we use Supabase auth)

Brand:
- MFN's green (#1E9B4E) — v2 uses teal `--v2-accent-primary`

---

## Tab-order reference (from frame_0200)

MFN's full tab inventory:

| # | Tab | In v2? |
|---|---|---|
| 1 | Search | yes |
| 2 | Scan | yes (stub) |
| 3 | Favorites | yes |
| 4 | Calories | NO (MFN upsell-adjacent) |
| 5 | Staple Foods | yes |
| 6 | Custom Foods | yes |
| 7 | My Meals | yes |
| 8 | Premium | NO (red dot) |
| 9 | My Recipes | yes |
| 10 | Recent Meals | yes |
| 11 | Friends | NO (red dot) |

v2 order: **Search / Scan / Favorites / Staple Foods / Custom Foods / My Meals / My Recipes / Recent Meals** (8 tabs).
