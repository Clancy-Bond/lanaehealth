# MFN pixel-parity diff list (2026-04-19)

**Source:** official MFN web help screenshots hosted at
`s3.amazonaws.com/img.mynetdiary.com/help/web/*.jpg`. These are MFN's
own annotated UI screenshots from their public help docs — not
speculation.

Reference images downloaded to `/tmp/mfn-ref/`:
- `meals_log_analysis_and_plan.jpg` (Analysis tab)
- `web_food_entry.jpg` (Food tab with inline search open)
- `web_full_screen_food_entry.jpg` (Food Entry detail page)
- `customie_meal_log.jpg` (Food tab with column gear open)
- `food_search_recents.jpg` (Search view)
- `quick_calories.jpg` (Quick Calories modal)
- `same_meal.jpg` (Same Breakfast modal)
- `copy_move_delete.jpg` (Move Food entries modal)
- `web_create_custom_food_and_recipe.jpg` (LOG dropdown → Create submenu)
- `web_manage_custom_and_recipe.jpg` (My Favorites with multi-select)
- `web_manual_favorites.jpg` (Favorites with LOG TO LUNCH action)

Our side captured at 1440×900:
- `ours-calories-dashboard-1440x900.png`
- `ours-food-tab-1440x900.png`

## /calories/food (Food tab) — priority-ordered diffs

### P0 — visibly broken on desktop

1. **Bottom mobile nav overlaps the page on desktop.** Hide below
   ≥900px viewport. Fix target: first pass.
2. **Two visible FABs.** Mobile bottom-nav has a centered `+`, and
   `/calories` also has a QuickLogFab floating on the right. On
   `/calories/food` neither is in MFN's location (top-left, sticky
   above the left icon column).
3. **"Add food (USDA search)" full-width green CTA at the bottom.**
   MFN has nothing there. Delete.

### P1 — wrong information architecture

4. **Column order + Time column.** Our order is
   `Calories · Carbs · Protein · Total Fat · Fd.Grade · Sat Fat ·
   Trans Fat · Fiber · Sodium · Calcium`. MFN default is
   `Calories · Total Fat · Carbs · Protein · Fd.Grade · Cholester. ·
   Fiber · Sugars · Net Carbs · D.Carbs · Vitamin K · Time`. Fix:
   reorder to match MFN's Total-Fat-before-Carbs order; add Time
   column; swap Sat Fat / Trans Fat / Sodium / Calcium behind a
   column-customization gear (see P2).
5. **Bottom hero layout.** MFN lays this out as three columns:
   - Left: macro bars (Fat / Carbs / Protein horizontal, each with
     `0% cals, X% under` label).
   - Center: big Apple ring with "Calorie Budget 2,039" above and
     "0 Left 2,039" inside.
   - Right: nutrient-left column row (`0 left 79` under Fat column,
     etc.) — per-column vertical mini-bars.
   Ours: Apple ring + "Ring reads" text box in a 2-col flex. Delete
   "Ring reads", re-layout to 3-col.
6. **"Left vs target" row is redundant.** MFN merges the "left vs
   target" values into the Daily totals row (or displays them in
   the right-column widget at the bottom). Drop our second row.

### P2 — missing interactions

7. **Inline `✏️ add` input per meal.** Under each meal header
   (BREAKFAST ^ LOG) MFN shows an editable text row with a pencil
   icon, placeholder `Please enter food name, brand or restaurant
   name`. Focusing the row opens a horizontal link bar
   `SAME | RECENT | QUICK | SEARCH | CREATE ▾ | MY FOODS ▾` and a
   dropdown list of suggested foods. Our version has a static
   `+ ADD` link that navigates to `/calories/search` — totally
   different interaction.
8. **LOG dropdown menu.** Clicking a meal's `LOG` link in MFN opens
   a menu with:
   - Same [Meal]
   - Recent Meal
   - Quick (→ `Log Calories Quickly` modal)
   - Search
   - Create ▸ (Custom Food | Recipe from [Meal] Foods | Recipe from
     Scratch)
   - MyFoods ▸
   - Meal Planner
9. **Per-meal `⋮` = "Move Food entries" modal, not Copy/Delete.**
   MFN's kebab opens a modal with:
   - Title: "Move Food entries"
   - Subtitle: "Change selected entries"
   - Checkbox list of items (emoji + name + amount)
   - Date picker (e.g. `4 Aug 2018`)
   - Meal dropdown (`Lunch ▾`)
   - SAVE | CANCEL
   Our menu has Copy/Save/Reorder/Delete — different behavior.
10. **Settings gear → column customization dropdown.** MFN's ⚙ in
    the table header opens:
    - Show Nutrients in Food Log ▸
    - Hide Nutrients from Food Log ▸
    - Hide Time
    - Sort by ▸
    - Settings
    Ours just links to `/calories/plan`.
11. **Left icon column (🔍 ⭐ 🍔).** MFN shows three vertical icons
    on the far left of the Food tab for quick nav to search,
    favorites, and the food menu. Ours has none.

## /calories/search — diffs

12. **Tab count + order.** MFN = 6 top tabs:
    `SEARCH | MY FAVORITES | MY FREQUENT FOODS | MY RECENT MEALS |
    MY CUSTOM FOODS | MY RECIPES`. Ours = 9 left-sidebar entries
    including `Staple Foods`, `My Recipes`, `My Meals`, `Curated
    Recipes` that MFN doesn't have.
13. **Search label position.** MFN puts "Please enter food name,
    brand or restaurant name" as a label ABOVE the input. We put
    it as a placeholder inside.
14. **Recent foods injected at top of search results.** MFN
    pre-pends up to 5 matching recent foods. We don't.
15. **Search results per-row `⋮`.** MFN shows a kebab on every
    result for quick log-to-meal.
16. **My Favorites multi-select + "LOG TO [meal]" button.** MFN has
    checkboxes per row, `ADD FOOD TO FAVORITES` label, a `LOG`
    button + `TO LUNCH ▾` meal picker, and SETTINGS link.
17. **SETTINGS link is on the search tab.** MFN shows it top-right
    of every search subview.
18. **My Recipes vs My Custom Foods.** MFN separates "Custom Foods"
    (single items) from "Recipes" (combinations). We do too but
    also have `Curated Recipes` and `My Meals` as separate things
    MFN doesn't have.

## /calories/food/[fdcId] (Food Entry detail) — diffs

19. **3-column layout missing.** MFN = left column (amount + unit
    picker + weight/grade), center column (big calorie number +
    LOG FOOD TO [MEAL] button + macro bars F/C/P), right column
    (FDA-style Nutrition Facts card with % Daily Value). Ours
    stacks vertically.
20. **FDA Nutrition Facts card.** MFN renders the full FDA label
    with % DV column (Total Fat 11g 17%, Saturated Fat 3g 15%,
    Cholesterol 420mg 140%, etc.). We show none of this.
21. **"COPY & CUSTOMIZE" + "SETTINGS" actions top-right.** Missing.
22. **Meal dropdown + Time picker at the bottom of the left
    column.** We only accept meal via URL param.
23. **"SHOW STANDARD NUTRIENTS" toggle.** Missing.
24. **"% Daily Value" personalization radios.** MFN lets users pick
    between "Use 2,000 calorie diet" and "Show percentages of my
    personal Nutrient Targets". Missing.
25. **Green dark footer bar.** Marketing artifact, skip.

## Cross-cutting

26. **Color palette.** MFN green is olive-muted (~#6FA032). Ours
    is warm-sage (~#6B9080). Both green, different hue. MFN also
    uses tab green ~#62A431 with a crisper white selected-tab.
27. **Corner radii.** MFN uses 2-4px on most elements. Ours uses
    12-16px everywhere. Fixing this would shift our whole
    aesthetic — defer as a palette-level change.
28. **Font.** MFN looks like plain sans-serif (Arial/Roboto/Open
    Sans derivative). We use whatever sage-warm picked. Defer.

## Implementation order

Going from highest visual impact + lowest risk:

1. P0 hide bottom nav on desktop + kill extra FAB + delete
   "Add food (USDA search)" button.
2. P0 merge Daily totals + "Left vs target" row.
3. P1 re-layout bottom hero to 3-column (macro bars | ring |
   column stats), drop "Ring reads".
4. P1 reorder columns to MFN's default + add Time column.
5. P2 rework per-meal `⋮` → "Move Food entries" modal
   (replaces Copy/Save/Reorder/Delete).
6. P2 rework settings gear → column customization dropdown.
7. P2 rework search left sidebar → 6 top tabs to match MFN.
8. P2 inline `✏️ add` input per meal + SAME/RECENT/QUICK/SEARCH/
   CREATE/MYFOODS link bar + suggestions dropdown.
9. P2 LOG dropdown on each meal header.
10. Food Entry page re-layout to 3-column + FDA Nutrition Facts card.
