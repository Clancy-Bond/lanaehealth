# Overnight Build Log — 2026-04-17 / 04-18

**Author:** Claude (autonomous mode)
**Rules:** Don't stop. Don't ask permission. Pick the best option, ship,
push, move on.

## Morning summary (read this first)

**17 commits shipped. Full test suite green (993 passing, 53 skipped).
All additive — no existing tables or data touched.**

New routes live in production:

| URL | What it does |
|-----|--------------|
| `/calories` | MyNetDiary-style daily dashboard (apple ring, meals, macros, day strip, weight/exercise/water tiles) |
| `/calories/food` | Dense 9-column meal-log table, 4 meal sections + daily totals + "left vs target" row |
| `/calories/food/[fdcId]` | USDA food detail with portion selector, 16 macro+micro fields, Fd. Grade A-F, Add-to-meal |
| `/calories/search` | MyNetDiary food navigator: Search / Staple / Favorites / Frequent / Recent / Custom / Recipes |
| `/calories/plan` | Editable calorie + macro + weight goals (POTS-tuned sodium defaults) |
| `/calories/analysis` | Pattern-based daily diet insights (POTS sodium, endo iron, migraine triggers, consistency) |
| `/calories/photo` | AI meal photo (free) — matches MFP's Meal Scan and Lose It's Snap It |
| `/calories/health/weight` | Weigh-in form, lb/kg converter, trend chart with goal line, delta vs week/month |
| `/cycle` | Natural Cycles-equivalent landing: big fertility status, 30-day strip, BBT log, countdown |
| `/topics/cycle/hormones` | Stardust-pattern explicit hormone tracking (9 hormones, F/C units, sparklines) |
| `/emergency` | Guava-pattern wallet card (3.375"x2.125" print), POTS floated to top, allergies + meds |

New global surfaces:

- **TopNav** with 8 tabs (Home / Calories / Doctor / Symptoms / Cycle / Labs / Patterns / Imaging), sticky with backdrop blur, hides on mobile to keep BottomNav as primary. In `src/components/TopNav.tsx`.
- **Year-in-Pixels** (Daylio pattern) — 365-day pain grid on Home, color-coded, taps through to `/log?date=X`.
- **CalorieCard** on Home (existing) now labeled "CALORIES" (uppercase sage) and links to `/calories`.

## Completed tiers

- Tier 1: Top nav bar — commit `d5e45a4`
- Tier 2: Food search sidebar — commit `ea2150c`
- Tier 3: Food detail page + `/api/food/log` — commit `6da3414`
- Tier 4: `/calories/plan` editable goals — commit `ea5125e`
- Tier 4.5: Wire goals into dashboard — commit `b994f81`
- Tier 5: `/calories/analysis` pattern insights — commit `1491091`
- Tier 6: Weight tracking (jsonb-backed) — commit `d55a61b`
- Tier 7: Water intake log — commit `918072b`
- Tier 8: Oura activity surface + wire tiles — commit `872774b`
- Tier 9: Food quality grade (A-F) — commit `d5655c8`
- Tier 10: Year-in-Pixels on Home — commit `908ca97`
- Tier 11: Micronutrients (covered by Tier 3 food detail) — no commit
- Tier 12: Hormone tracking (Stardust) — commit `3279645`
- Tier 13: Emergency wallet card (Guava) — commit `ba007d5`
- Tier 14: AI food photo (Snap-It) — commit `37c25f6`
- Tier 16: Natural Cycles clone (`/cycle`) — commit `c96852b`
- Test fix (Oura sync) — commit `ab6190b`

## Persistence strategy

All new writable surfaces go through `health_profile` jsonb sections
(additive only; no schema migrations overnight):

- `section='nutrition_goals'` — calorie/macro/weight targets
- `section='weight_log'` — weigh-in array
- `section='water_log'` — glass counts per day
- `section='hormone_log'` — hormone entries
- `section='bbt_log'` — BBT entries

Existing sections untouched:
`personal`, `confirmed_diagnoses`, `medications`, `supplements`,
`allergies`, `emergency_notes`, `providers`.

Future migration (when these grow large):
- Tier 6 note: split `weight_log` into a `weight_entries` table if
  the jsonb array exceeds ~500 entries (~18 months daily).
- Tier 7 note: same for `water_log`.
- Tier 12 note: `hormone_levels` table once we integrate with lab imports.

## Known gaps / deferred

- **Tier 15 polish + graphics**: deliberately skipped to maximize feature surface area. Current pages use the warm-modern palette but could benefit from more loading skeletons, empty-state illustrations, and micro-animations. Log this for a dedicated design pass tomorrow.
- **Custom Foods / Recipes views** on `/calories/search`: stubbed as EmptyHint cards. Needs a `custom_foods` table or another jsonb section + form.
- **Favorites** on `/calories/search`: stubbed — needs a star toggle and `food_favorites` persistence.
- **Exercise sub-page**: the dashboard surfaces exercise calories from Oura activity, but there's no `/calories/health/exercise` page yet with detailed activity breakdown.
- **FDA-cleared contraception**: `/cycle` is explicit that it is NOT contraception. For actual contraception, point users at Natural Cycles.
- **Weight plan chart on /calories dashboard**: the dashboard shows Weight as a side tile linking to /calories/health/weight, but there's no inline weight-plan chart matching MyNetDiary's signature "lose 20 lb in 140 days" card yet. Add that on the next pass.

## Architecture principle (reminder)

Still holding: **pull-add-rebrand**. Every new feature this session
layers on top of existing data sources:

- Food database: USDA FoodData Central (via existing `src/lib/api/usda-food.ts`)
- Barcode + branded foods: Open Food Facts (via existing lib)
- Readiness + contributors: Oura API (stored as raw_json)
- Meal photo: Claude Vision (via existing `/api/food/identify`)
- Fertile window: derived from cycle_entries + nc_imported (existing)

We do not reinvent these calculations. We present them better.

## Process rules

1. Typecheck after every change. If tsc fails, don't commit.
2. Test after every lib change.
3. Commit with real messages. Each commit stands alone.
4. Push after every commit. Standing git push authorization.
5. Each tier = 1-5 commits.
6. Never modify existing Supabase data. Migrations additive only.

## Emergency brake

No emergency brake triggered this session. All additive changes.
