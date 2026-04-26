# Manual Code Audit - Recent Implementation Push (PRs #95-#101)

Reviewer: manual code audit (CodeRabbit CLI not authenticated in env).
Date: 2026-04-26.
Scope: PRs #95 (NC wave 3 cycle insights), #96 (Oura wave 2 sleep), #97 (MFN wave 2 calories), #98 + #100 (Learn tab), #99 (motion wave 3), #101 (onboarding follow-ups).

## Critical (must fix)

- src/app/v2/cycle/insights/page.tsx:194-205 - new `legacySymptoms` query reads `symptoms` (PHI) without a `user_id` filter while using `createServiceClient()` (bypasses RLS). Introduced in PR #95 (commit 302c3569). Will leak symptom logs across users once a second account exists. Fix: thread `userId` from `getCurrentUser` and add `.eq('user_id', userId)`.
- tests/e2e/v2-motion-reduced.spec.ts:28,75 - shipped with two TS errors. `test.use({ reducedMotion: 'reduce' })` is invalid Playwright fixture syntax (must be wrapped in `contextOptions`), and the navigator.vibrate spy doesn't satisfy the overloaded `Navigator['vibrate']` signature. Both errors break `tsc --noEmit` cleanly. Introduced in PR #99.

## Medium (should fix)

- src/app/v2/sleep/_components/SleepStagesStrip.tsx:83,85 - em-dash character used as fallback string. CLAUDE.md rule: "DO NOT use em dashes anywhere in the codebase or output." Replace with a hyphen, en-dash, or short word. Introduced in PR #96.
- src/app/v2/sleep/_components/BedtimeRegularityChart.tsx:81,83,265 - same em-dash violation.
- src/app/v2/sleep/_components/BodyTempChart.tsx:213,216,220 - same em-dash violation.
- src/app/v2/sleep/_components/HrvBalanceCard.tsx:141,142,143 - same em-dash violation.
- src/app/v2/_components/RecoveryTimeCard.tsx:87,90 - same em-dash violation.
- src/app/v2/page.tsx:74 - em-dash in comment added in PR #96.

## Low (nice to fix)

- src/lib/calories/recipes.ts:147-152 (and loadRecipes:106-110) - `addRecipe` upserts `health_profile` with `onConflict: "section"` and no `user_id` filter on either read or write. Pre-existing from PR #83, NOT introduced in PR #97, but PR #97 builds heavily on this surface. Today only one user (Lanae) so impact is zero, but it will silently merge and overwrite recipes the moment a second account signs up. Track separately as part of the wider RLS-completion sweep already in flight.
- src/app/api/calories/recipes/route.ts:51-122 - same `addRecipe` issue: POST has no `requireUser` / `resolveUserId` call. Same pre-existing scope; flag in the wider sweep, not this audit's fix PR.
- src/lib/api/oura.ts:7-17 - `getOuraData` reads `oura_daily` (PHI) without user_id filter. Pre-existing infrastructure used by `/v2/sleep` and the new `RecoveryTimeCard`. Not new in scope, but the new card amplifies the surface area. Same wider-sweep recommendation.
- src/lib/api/nc-cycle.ts:119-156 - `getCombinedCycleEntries` reads `nc_imported` and `cycle_entries` (PHI) without user_id filter. Same wider-sweep classification.
- src/app/v2/calories/recipes/new/_components/RecipeBuilderForm.tsx:188-228 - submit handler has no client-side guard against double-submit between `setError` and the `startTransition` returning. `useTransition`'s `pending` covers it for the button, but a fast double-tap during the network round-trip would race the in-flight POST with a second one. Inserting a `pending` check at the top of `onSubmit` would tighten the optimistic path. Low priority because each recipe gets a fresh UUID server-side.

## Positive (what's good)

- ArticleBody (src/app/v2/learn/_components/ArticleBody.tsx) renders structured `ArticleBlock` types only - no raw HTML injection, no markdown parser. The Learn module is XSS-safe by construction. The inline `[LABEL]` regex linker only emits text or `<a href="#cite-...">` after a labelSet membership check - nothing user-supplied is rendered as HTML.
- All new write API routes (`/api/food/log` POST + PATCH, `/api/food/log/recent`, `/api/v2/onboarding/dismiss-skip-banner`) use `requireUser`/`resolveUserId` and explicit `.eq('user_id', userId)` filters on every read and write. Belt-and-suspenders against service-role bypass.
- `loadRecentFoods` (src/lib/calories/recent-foods.ts:58-104) does it correctly: resolves userId first, scopes the food_entries query to that user, and returns `[]` on auth failure rather than leaking other users' rows.
- `MealItemEditSheet` PATCH path explicitly fetches the row scoped by both `id` AND `user_id` before updating, then updates with both filters. Defense in depth against forged entryId.
- `dismissSkipBanner` reads userId from session, never from request body. Idempotent. Preserves existing `skipped` flag instead of overwriting.
- Symptom radar (src/lib/cycle/symptom-radar.ts) is pure data math, no PHI in errors, returns `[]` on empty input rather than throwing. Tests at src/lib/cycle/__tests__/symptom-radar.test.ts cover thresholds + sort order.
- Recovery-time (src/lib/v2/recovery-time.ts) handles empty input, all-null scores, and missing baseline gracefully. Returns trajectory `'flat'` rather than throwing. Unit tested.
- `RouteSlide` reads sessionStorage in a try/catch with hydration-safe SSR default `'none'`; reduced-motion respected.
- USDA nutrient route (`/api/food/nutrients`) is correctly NOT auth-gated - it returns publicly-derivable cached USDA data, no PHI. Comments document the choice.
- USDA `fdcId` and `meal_type` are validated as numbers/whitelisted strings before being inserted into food_entries; `clampServings`/`clampGrams` bound the inputs.
- `safeReturnPath` is reused from a single source to sanitize POST-redirect targets (no open redirect).
- TypeScript: no `any` types found in the new scope files. Strict typing on every component prop, all enums and unions are discriminated.
- Tests: each PR shipped at least one E2E spec (cycle insights, sleep oura wave 2, calories MFN wave 2, learn, motion-reduced, onboarding-followups) - matches CLAUDE.md "Every new user-facing feature MUST add at least one E2E test" rule.
