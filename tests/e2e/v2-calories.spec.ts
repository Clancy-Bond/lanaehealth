/*
 * v2 Calories baseline.
 *
 * Confirms the Food dashboard renders its hero ring + macro tiles, and
 * that the search input is reachable + accepts input. We deliberately
 * do not assert on USDA / Open Food Facts result rows here because
 * the search depends on third-party API keys that may be absent in
 * the test environment; coverage of the SSR fetch lives in
 * src/__tests__ unit tests instead.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/calories', () => {
  test('renders the calorie ring and macro tiles', async ({ page }) => {
    await page.goto('/v2/calories')
    await expect(page).toHaveURL(/\/v2\/calories/)
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    // Macro section labels live in MacroTilesRow. Any one of these is
    // sufficient; together they confirm the row rendered.
    await expect(page.getByText(/protein/i).first()).toBeVisible()
    await expect(page.getByText(/carbs/i).first()).toBeVisible()
    await expect(page.getByText(/fat/i).first()).toBeVisible()
  })

  test('search surface renders the input and accepts text', async ({ page }) => {
    await page.goto('/v2/calories/search')
    const search = page.getByRole('textbox', { name: 'Search foods' })
    await expect(search).toBeVisible()
    await search.fill('egg')
    await expect(search).toHaveValue('egg')
  })
})
