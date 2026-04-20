# Session 02 — Calories / Food (Phase 2)

> **Copy this entire file as the opening message of a fresh Claude Code session in the calories worktree.**

---

You are building Phase 2 of the LanaeHealth v2 mobile UI rebuild — the **Calories / Food** section. This is the largest section by page count (11 routes) but the highest-velocity because heavy MyNetDiary parity work has already been done in legacy. Run after Session 01 lands and proves the pattern.

## Worktree setup (run this in your terminal first)

```bash
cd /Users/clancybond/lanaehealth/.claude/worktrees/sweet-rosalind-cea925/
scripts/v2-worktree-setup.sh calories
cd ../v2-calories
claude
```

Then paste this prompt as your first message.

## Hard prerequisite

Do not start until **Session 00 (Foundation)** AND **Session 01 (Cycle)** have merged to `main`. Foundation gives you the design system; Cycle proves the pattern. Rebase your branch on `main` to pull them in.

## Read first (in order)

1. `docs/sessions/README.md` — design philosophy, coordination rules
2. `docs/v2-design-system.md` — tokens, primitives, conventions
3. `docs/sessions/01-cycle.md` and the merged `claude/v2-cycle` branch — see the pattern in action
4. `docs/reference/mynetdiary/frames/full-tour/` — **424 reference frames; this IS your visual spec.** Browse them all once.
5. `src/lib/calories/home-data.ts` and `src/lib/calories/goals.ts` — data loaders
6. `src/lib/api/food.ts`, `src/lib/api/nutrient-targets.ts`, `src/lib/api/open-food-facts.ts`
7. Existing legacy MFN-parity components in `src/components/calories/*` — model the layout, but rebuild against v2 primitives

## Scope: routes to build

Build the v2 versions of these 11 routes:

- `src/app/v2/calories/page.tsx` — today's food dashboard (MFN's "Dashboard")
- `src/app/v2/calories/food/page.tsx` — food log table (MFN's "All Meals")
- `src/app/v2/calories/food/[fdcId]/page.tsx` — food detail with FDA Nutrition Facts
- `src/app/v2/calories/search/page.tsx` — USDA food search (with the 6 top tabs from MFN)
- `src/app/v2/calories/photo/page.tsx` — photo log a meal
- `src/app/v2/calories/plan/page.tsx` — calorie + nutrition plan
- `src/app/v2/calories/analysis/page.tsx` — trends/macros analysis
- `src/app/v2/calories/custom-foods/new/page.tsx` — add custom food
- `src/app/v2/calories/recipes/new/page.tsx` — add recipe (lower frequency, lighter polish OK)
- `src/app/v2/calories/meal-delete/page.tsx` — bulk meal delete
- `src/app/v2/calories/health/weight/page.tsx` — weight tracker

## Design layer assignments

- **Visual chrome:** Oura (use v2 primitives; don't reinvent)
- **Voice / pedagogy:** Natural Cycles. Replace MFN's marketing-y, sales-pushy copy with NC-style gentle, educational micro-copy. (MFN frames will show "Sale 30%" banners and upsell prompts — IGNORE those, never replicate.)
- **Section UX patterns:** MyNetDiary. Direct clone of how MFN tracks and presents food/calorie data. Specifically:
  - The today/dashboard with calorie-apple ring + macro tiles
  - The meal log with per-meal headers, items beneath, calorie totals
  - The 6-tab search header (Search / Scan / Favorites / Calories / Staple Foods / Custom Foods / My Meals / Premium / My Recipes / Recent / Friends — match the order and labeling MFN uses, modulo Premium/Friends which we don't have)
  - The FDA Nutrition Facts card on food detail
  - The MFN-style add-row inline pattern per meal
  - The kebab menu per meal row for actions

## Reference frames to focus on

MFN reference frames (browse `docs/reference/mynetdiary/frames/full-tour/`):

- Dashboard / today screen — apple ring centerpiece, macro tiles, AI Coach, daily content
- All Meals view — list with meal headers, items, FAB
- Search — top tabs, search input, results
- Food detail — FDA Nutrition Facts card layout
- Customize Search Tabs — settings subscreen (saw at frame ~200, great example of subtle subscreen)
- Plan / Analysis — trends, charts

**First task:** scrub `docs/reference/mynetdiary/frames/full-tour/` and rename canonical frames semantically (`dashboard-default.png`, `food-log-all-meals.png`, `search-results.png`, `food-detail-fda.png`, etc.). Delete obvious non-canonicals (especially upsell modals, "Sale 30%" overlays). Output curation as `docs/reference/mynetdiary/frames/calories-section.md` mapping each canonical frame to which v2 route it informs.

## Reuse from `src/lib/`

- `src/lib/calories/home-data.ts` — `getDayTotals(date)`
- `src/lib/calories/goals.ts` — `loadNutritionGoals()`
- `src/lib/api/food.ts` — food log CRUD
- `src/lib/api/nutrient-targets.ts` — nutrient targets
- `src/lib/api/open-food-facts.ts`, USDA fetch logic in API routes
- Existing v2-clean components to model after: `src/components/calories/home/CaloriesTodayRing.tsx` (great example), `src/components/calories/home/MacrosToday.tsx`, `src/components/calories/home/WeeklyCalorieDelta.tsx`
- Existing food entry handlers in `src/app/api/food/log/route.ts` and `src/app/api/calories/**`

## Reuse from foundation primitives

`MetricRing` (centerpiece for the calorie apple), `MetricTile` (macro tiles), `ListRow` (meal items), `Card`, `Sheet`, `Stepper`, `EmptyState`, `Skeleton`, `Button`, `FAB`. Plus shell.

## Acceptance criteria (per route)

1. **Visual match:** side-by-side screenshot of your `/v2/calories/*` page vs the corresponding MFN reference frame passes visual match.
2. **Voice match:** all upsell/marketing copy stripped. Replace with NC-style educational copy. ("You're 28 calories under your target — there's still room for a snack if you'd like.")
3. **Mobile correctness:** iOS Safari at 375/390/428pt. Tap targets ≥ 44pt. No overflow. Safe area.
4. **Data parity:** legacy `/calories` vs `/v2/calories` for same date — identical data.
5. **FDA Nutrition Facts card** on food detail matches MFN's typography and density precisely.
6. **No engine touch.**

## Locked files (DO NOT EDIT)

- `src/v2/components/primitives/*`
- `src/v2/components/shell/*`
- `src/v2/theme/*`
- `src/lib/*`
- `src/app/api/**`
- Other sessions' work

FOUNDATION-REQUEST process if a primitive is missing: same as Session 01.

## Submission

- PR title: `feat(v2/calories): Phase 2 — calories section (MFN clone)`
- PR description: side-by-side screenshots for each route, data parity confirmation, list of any FOUNDATION-REQUEST markers, list of MFN upsell/marketing patterns explicitly NOT replicated.
- Rebase on `main` daily.
