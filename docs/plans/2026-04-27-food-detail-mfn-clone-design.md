# Food detail MFN clone — design

**Date:** 2026-04-27
**Scope:** `/v2/calories/food/[fdcId]` ONLY. Other calories surfaces (today,
search, plan, custom foods, recipes, vitals) are deferred per user direction.

## Why

The shipped page renders the right data (eggs = 55 cal correctly post-PR #129)
but the layout is generic and does not match MyNetDiary, the explicit visual
spec captured in `docs/reference/mynetdiary/`. User has stated repeatedly that
"reference is the spec" and approved this design after one round of
clarification.

## Reference frames

Canonical (from `docs/reference/mynetdiary/calories-section.md`):
- `frame_0045.png` — milk detail with chip strip + portion input
- `frame_0050.png` — milk detail with Food Macros pie + numeric breakdown
- `frame_0055.png` — full FDA Nutrition Facts table

Already saved at `docs/reference/mynetdiary/frames/full-tour/frame_0045.png`
(and 0050, 0055).

## Approach: surgical replacement

Keep the existing `FoodDetailProvider` React context. It correctly handles
portion scaling and is not what's broken. Replace only the rendering of the
six visual layers below.

**Rejected alternatives:**
- *Single mega-component*: cleanest visual outcome, highest regression risk on
  portion scaling math.
- *Whole-page rewrite*: throws away working state plumbing for nothing.

## Six visual layers (page top → bottom)

### 1. Photo banner with name overlay (frame_0045)
- Edge-to-edge `~280pt` tall image.
- Linear gradient `transparent → rgba(0,0,0,0.7)` overlay top→bottom so the
  food name reads on any background.
- Food name in white, `--v2-text-2xl`, bold, bottom-left of banner with
  `--v2-space-4` inset.
- Back chevron icon top-left, favorite star top-right.
- No-photo fallback: solid `--v2-bg-card-muted` placeholder, same dimensions,
  name still bottom-left.

### 2. Inline portion + cals row (frame_0045)
- Single horizontal flex row, `--v2-space-4` padding.
- LEFT: `<input type="number">` showing the current portion amount, blue
  underlined; trailing chip showing the unit (`fl oz`).
- `Weight: N/A` muted caption beneath the number.
- RIGHT: `33` in `--v2-text-3xl` blue + `cals` muted.

### 3. Multi-row portion chip strip (frame_0045)
- `flex-wrap: wrap`, gap `--v2-space-2`.
- Each chip: `--v2-radius-md`, `--v2-bg-card-muted` fill, gray text default.
- Selected state: `1.5px solid var(--v2-accent-primary)` border + accent text.
- Last chip: green-tinted `🔎 Portion Guide`.
- Source: `nutrients.portions` from USDA. We already have these.

### 4. Meal text link + green Log pill (frame_0045)
- Same row, justify-space-between.
- LEFT: meal name (`Breakfast`) styled as link, opens a Sheet for picker.
- RIGHT: green pill `Log` (replaces the existing teal full-width "Add to
  Breakfast" button — MFN's button is short, right-aligned).

### 5. Food Macros section (frame_0050)
- Section header `Food Macros` + chevron right (collapsible, default expanded).
- Layout: `display: grid; grid-template-columns: 96px 1fr` with gap.
- Pie chart: 96pt SVG, three slices for carbs/protein/fat with labels at the
  outer edge showing percent of cals.
- Right column: tabular numeric breakdown. `Carbs Xg / Protein Xg / Fat Xg`.
- Pagination dot row beneath pie (decorative — MFN suggests carousel; ours is
  static for v1, no swipe wired up).

### 6. My Nutrients FDA-style table (frames 0050 + 0055)
- Section header `My Nutrients` + chevron + green `Show % Food Label Daily
  Value` link right-aligned.
- Alternating-row table:
  | Row | Bold | Value | %DV |
  |---|---|---|---|
  | Total Fat | yes | `Xg` | `X%` |
  | ↳ Saturated Fat | no | `Xg` | `X%` |
  | ↳ Trans Fat | no | `Xg` | `X%` |
  | Total Carbs | yes | `Xg` | `X%` |
  | ↳ Dietary Fiber | no | `Xg` | `X%` |
  | Protein | yes | `Xg` | `X%` |
  | Sodium | yes | `Xmg` | `X%` |
  | Calcium | yes | `Xmg` | `X%` |
- Sub-rows indented 16pt. Alternating row backgrounds (`--v2-bg-card` white
  / `--v2-bg-card-muted` gray-50).
- `Show All Nutrients` link in green at table bottom.

%DV values use the FDA general adult reference (Total Fat 78g, Sat Fat 20g,
Trans Fat 0g [no DV — show `--`], Total Carbs 275g, Fiber 28g, Protein 50g,
Sodium 2300mg, Calcium 1300mg).

## Out of scope

- Supplementary helper actions: Send Photos / Food Label / Compare / Settings
  / Help / Videos. Excluded per `calories-section.md` line 58.
- Photo carousel under Food Macros (MFN shows a swipeable nutrient ring set;
  ours stays static for v1).
- Numeric portion entry pad with fraction buttons (frames 0160, 0190). Defer
  to a v2 of the chip strip; the existing `<input type="number">` is enough
  for parity at this layer.

## Files to change

| File | Action |
|---|---|
| `src/app/v2/calories/food/[fdcId]/_components/FoodDetailHero.tsx` | Drop the centered 64pt calorie display. Keep `FoodDetailProvider` context export only. |
| `src/app/v2/calories/food/[fdcId]/_components/FoodDetailHeader.tsx` (NEW) | Photo banner + name overlay + back/star icons. |
| `src/app/v2/calories/food/[fdcId]/_components/PortionInputRow.tsx` (NEW) | `[input] [unit-chip] | [cals]` row. |
| `src/app/v2/calories/food/[fdcId]/_components/PortionChipStrip.tsx` | Rewrite to multi-row wrap with selected/Portion-Guide states. |
| `src/app/v2/calories/food/[fdcId]/_components/AddToMealForm.tsx` | Replace tab strip + stepper with meal-link + Log pill. |
| `src/app/v2/calories/food/[fdcId]/_components/NutritionFactsCardV2.tsx` | Replace donut + tiles with Food Macros pie + side breakdown + FDA alternating-row table. |
| `src/app/v2/calories/food/[fdcId]/page.tsx` | Re-assemble in MFN order. |
| `src/lib/nutrition/daily-values.ts` (NEW) | FDA %DV reference values + helper. |

## Verification

1. Visual: side-by-side screenshot of `/v2/calories/food/<eggs-fdcId>` vs
   `frames/full-tour/frame_0045.png` — every layer matches.
2. Data: portion change still scales nutrients (FoodDetailProvider unchanged).
3. Log: tapping `Log` still POSTs to `/api/food/log` with the right payload.
4. E2E: extend `tests/e2e/v2-calories-mfn-wave-2.spec.ts` to assert the new
   visual sections render (photo, chip strip, Food Macros pie, FDA table).
