/*
 * v2 data export baseline.
 *
 * GDPR-style portability is a productization requirement. This suite
 * asserts the surface renders, the catalog is visible, and the
 * download button is reachable. The download itself is exercised at the
 * unit level for the underlying /api/export/full route; here we just
 * check the UX wires up.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/settings/data-export', () => {
  test('renders with the explanatory header, catalog, and download button', async ({ page }) => {
    await page.goto('/v2/settings/data-export')
    await expect(page).toHaveURL(/\/v2\/settings\/data-export$/)

    // Top app bar carries the page label.
    await expect(page.getByText('Data export').first()).toBeVisible()

    // Explanatory card with the "Download all your health data" header
    // is always present.
    await expect(page.getByText('Download all your health data')).toBeVisible()

    // The catalog lists every PHI category. Spot-check three so a
    // single rename does not break this entire suite.
    await expect(page.getByTestId('data-export-catalog')).toBeVisible()
    await expect(page.getByText('Daily logs').first()).toBeVisible()
    await expect(page.getByText('Cycle').first()).toBeVisible()
    await expect(page.getByText('AI conversations').first()).toBeVisible()

    // Primary download button is rendered and labeled.
    const downloadButton = page.getByTestId('data-export-download-button')
    await expect(downloadButton).toBeVisible()
    await expect(downloadButton).toHaveText(/Download all my data/i)
  })

  test('back link returns to /v2/settings', async ({ page }) => {
    await page.goto('/v2/settings/data-export')
    await page.getByRole('link', { name: /back to settings/i }).click()
    await expect(page).toHaveURL(/\/v2\/settings$/)
  })
})
