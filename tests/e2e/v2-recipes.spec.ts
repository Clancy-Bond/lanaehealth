import { test, expect } from '@playwright/test'

/**
 * v2 recipes (Edamam + URL import + custom).
 *
 * The full flow (search Edamam, save, log) requires EDAMAM_APP_ID +
 * EDAMAM_APP_KEY in the test env, which CI does not have. So we
 * cover the deterministic surfaces here:
 *   1. /v2/calories/recipes loads with the three CTAs.
 *   2. /v2/calories/recipes/search shows the input (or warning banner
 *      if API not configured).
 *   3. /v2/calories/recipes/import shows the URL form.
 *   4. The search CTA navigates from the index to the search page.
 */

test.describe('v2 recipes', () => {
  test('recipes index renders three CTAs', async ({ page }) => {
    await page.goto('/v2/calories/recipes')
    await expect(page.getByText('Search recipes')).toBeVisible()
    await expect(page.getByText('Paste a URL')).toBeVisible()
    await expect(page.getByText('Build your own')).toBeVisible()
  })

  test('search page renders input', async ({ page }) => {
    await page.goto('/v2/calories/recipes/search')
    await expect(page.getByTestId('recipe-search-input')).toBeVisible()
  })

  test('import page renders URL form', async ({ page }) => {
    await page.goto('/v2/calories/recipes/import')
    await expect(page.getByTestId('recipe-url-input')).toBeVisible()
    await expect(page.getByTestId('recipe-parse-btn')).toBeVisible()
  })

  test('search CTA navigates from index to search page', async ({ page }) => {
    await page.goto('/v2/calories/recipes')
    await page.getByTestId('recipe-search-cta').click()
    await expect(page).toHaveURL(/\/v2\/calories\/recipes\/search/)
  })
})
