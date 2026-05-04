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
 *   5. The provider directory search surfaces ingestion paths.
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
  // The link card lives in the "More settings" section near the bottom.
  // Scroll the page so the link is in view before asserting visibility.
  const link = page.getByRole('link', { name: /^connections/i }).first()
  await link.scrollIntoViewIfNeeded()
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', '/v2/connections')
})

test('provider search filters and reveals Apple Health Records guidance', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/v2/connections', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1:has-text("Connect your health")', {
    timeout: 90_000,
  })
  await page.waitForLoadState('networkidle')

  const search = page.getByRole('searchbox', { name: /search providers/i })
  await search.scrollIntoViewIfNeeded()
  await search.fill('queen')

  // The matching row is a button (the row itself is the toggle).
  const queenRow = page
    .getByRole('button')
    .filter({ hasText: /queen.*health systems/i })
    .first()
  await expect(queenRow).toBeVisible()
  await queenRow.click()

  // After expand, the "How to connect" guidance and the Apple search
  // term hint should be in the DOM.
  await expect(page.getByText(/how to connect/i)).toBeVisible()
  await expect(page.getByText(/apple search term/i)).toBeVisible()
})

test('provider search surfaces an entry for DLS (email-ingest path)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/v2/connections', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1:has-text("Connect your health")', {
    timeout: 90_000,
  })
  await page.waitForLoadState('networkidle')

  const search = page.getByRole('searchbox', { name: /search providers/i })
  await search.scrollIntoViewIfNeeded()
  await search.fill('DLS')

  await expect(
    page
      .getByRole('button')
      .filter({ hasText: /diagnostic laboratory services/i })
      .first(),
  ).toBeVisible()
})
