/**
 * Regression test: clicking into a food the user logged must render
 * the food detail page, not "Food not found".
 *
 * Anchored to fdcId 747997 ("Eggs, Grade A, Large, egg white") --
 * the exact URL the user reported broken on 2026-04-26
 * (lanaehealth.vercel.app/v2/calories/food/747997?meal=breakfast&date=...).
 * This food is a USDA Foundation entry whose direct /food/{id}
 * endpoint returns 404 even though the search endpoint has it. The
 * search-fallback added in 8d6cb3c must cover that case.
 *
 * The test is intentionally thin: we do not need to be signed in
 * because the playwright config boots the dev server with
 * LANAE_REQUIRE_AUTH=false. We just navigate to the URL and assert
 * the detail surface renders rather than the not-found banner.
 *
 * If this spec ever fails, the food-detail flow has regressed: USDA
 * gateway behavior is unstable and we cannot rely on the direct
 * endpoint alone.
 */
import { test, expect } from '@playwright/test'

test.describe('food detail / fdcId 747997 (Eggs, egg white)', () => {
  test('renders the egg-white detail card instead of "Food not found"', async ({ page }) => {
    // Page does USDA + photo lookups server-side; cold compiles on
    // Turbopack push the first render past 10s. Use `load` (not
    // `networkidle`) and a 60s budget so the spec is not flaky on a
    // cold dev server.
    await page.goto('/v2/calories/food/747997?meal=breakfast&date=2026-04-27', {
      waitUntil: 'load',
      timeout: 60_000,
    })
    const body = (await page.textContent('body')) ?? ''

    // Negative: the not-found copy must NOT be on the page.
    expect(body).not.toMatch(/food not found/i)
    expect(body).not.toMatch(/USDA no longer has this food/i)

    // Positive: the food name must render somewhere.
    expect(body).toMatch(/egg/i)

    // Positive: the calorie number must render. Foundation egg white
    // is 55 kcal per 100g; the page may scale to a default portion,
    // so we only assert the digits are visible somewhere on the
    // detail surface (not zero, not blank).
    expect(body).toMatch(/\b\d+\s*(kcal|cal\b)/i)
  })

})
