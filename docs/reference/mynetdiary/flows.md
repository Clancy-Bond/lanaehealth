# MyNetDiary flows

From the 424-frame full tour under `docs/reference/mynetdiary/frames/full-tour/`. MFN is our reference for **food logging UX only**; we do not adopt its chrome or voice.

## Log a meal

1. Open to Today. See meal cards (Breakfast, Lunch, Dinner, Snacks) each with a total-cal chip and an add button.
2. Tap add → opens a meal picker with five sub-tabs (Search / Scan / Favs / Calories / Staples / Custom).
3. Most-used flow: Search → type → results list → tap a food → opens a food detail with a portion picker and a big numeric total.
4. Adjust portion → Save → returns to Today with the meal total updated.

## Barcode scan

1. In the meal picker, tap Scan. Full-screen camera opens with "Hold at least 6" away" guidance.
2. On detection, the food detail card appears as a bottom sheet with the same portion picker + total pattern.

## Custom food and recipe creation

- Custom food: a form with name, serving size, macros, and optional micronutrients. Validation is inline.
- Recipes: a list of ingredients (each an existing food item) + a number of servings. Total macros compute live.

## Patterns worth adopting verbatim

1. The portion chip strip: fast, thumbable, covers 80% of entries without a text input.
2. The big-number, small-unit total ("33 cals") pattern for live recomputation.
3. The "All Meals" scoped dropdown at the top: lets the user narrow the view to a meal (breakfast/lunch/etc.) without a full modal.
4. Favorites as a dedicated tab: the long tail of food logging is eating the same things repeatedly; surfacing the short list is a huge time-saver.

## Patterns NOT to adopt

- MFN's brand green as chrome: we use `--v2-accent-primary` (teal) for the food section's accent.
- Promotional banners ("30% OFF Claim Now"): v2 is ad-free.
- The FDA Nutrition Facts full-card: too dense for v2's preferred disclosure; the food-section session will adapt it to a macro ring + expandable detail card.
