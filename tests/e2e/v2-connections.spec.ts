import { expect, test } from '@playwright/test'

/*
 * /v2/connections — Phase 1 of the medical-data-aggregation plan.
 *
 * Contracts:
 *   1. Page renders with the headline copy and at least one card per
 *      registered connector.
 *   2. The always-on file-import fallback link is visible.
 *   3. Settings surfaces the Connections entry point.
 *   4. No horizontal overflow at iPhone Pro width (393x852).
 */

test.setTimeout(120_000)

test('renders the connections page at iPhone Pro width without overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/v2/connections', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1:has-text("Connect your health")', {
    timeout: 90_000,
  })
  await page.waitForLoadState('networkidle')

  // The file-import fallback is always reachable from this page.
  await expect(
    page.getByRole('link', { name: /open file import/i }),
  ).toBeVisible()

  // The page enumerates the registered connectors. At least one card
  // for the FHIR Patient Portal connector should be present (it's the
  // only medical-records source in the registry today).
  await expect(
    page.getByRole('heading', { name: /patient portal \(fhir\)/i }),
  ).toBeVisible()

  // Strict no-overflow contract.
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )
  expect(fits).toBe(true)
})

test('settings links to /v2/connections', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/v2/settings', { waitUntil: 'domcontentloaded' })
  // The Connections row lives in the "More settings" card.
  await expect(
    page.getByRole('link', { name: /^connections/i }).first(),
  ).toBeVisible()
})
