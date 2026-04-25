/*
 * /v2/cycle/insights baseline.
 *
 * Population comparison stats. Confirms the page renders the
 * comparison rows with both "You" and "All cyclers" columns and
 * cites the published sources.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/cycle/insights', () => {
  test('renders the comparison rows with population context', async ({ page }) => {
    await page.goto('/v2/cycle/insights')
    await expect(page).toHaveURL(/\/v2\/cycle\/insights$/)
    await expect(page.getByRole('heading', { name: 'Cycle insights' })).toBeVisible()
    // Each insight row carries a "You" and "All cyclers" stat label.
    await expect(page.getByText(/All cyclers/).first()).toBeVisible()
    await expect(page.getByText(/^You$/).first()).toBeVisible()
    // Cycle length insight is always rendered (the metric is
    // always in the registry, even with no user data).
    await expect(page.getByRole('heading', { name: 'Cycle length' })).toBeVisible()
    // The Sources section names the published references.
    await expect(page.getByText(/Bull JR et al./)).toBeVisible()
    await expect(page.getByText(/Lenton EA et al./)).toBeVisible()
  })

  test('back arrow returns to /v2/cycle', async ({ page }) => {
    await page.goto('/v2/cycle/insights')
    await page.getByRole('link', { name: 'Back to cycle' }).click()
    await expect(page).toHaveURL(/\/v2\/cycle$/)
  })
})
