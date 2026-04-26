/*
 * v2 error and not-found page contract.
 *
 * Two productization-required surfaces:
 *   1. /v2/<unknown> renders the v2 not-found surface (NC voice, not
 *      the default Next 404 page).
 *   2. The not-found surface includes a "Go to home" primary action
 *      that round-trips back to /v2.
 *
 * The error.tsx boundary is harder to trigger from a deployed surface
 * because it requires a live render error. We assert via the static
 * components imports + the existing error boundary tests in the cycle
 * regression suite (PR #87) that the boundary surface itself renders.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2 not-found surface', () => {
  test('an unknown /v2 route renders the NC voice not-found page', async ({ page }) => {
    const response = await page.goto('/v2/this-route-definitely-does-not-exist-' + Date.now())
    // Next.js notFound() responses return 404 but render the v2 not-found
    // surface. Either is acceptable; we just need a 4xx and the surface.
    expect(response?.status()).toBeGreaterThanOrEqual(400)
    expect(response?.status()).toBeLessThan(500)

    const surface = page.getByTestId('v2-not-found')
    await expect(surface).toBeVisible()
    await expect(page.getByText("We couldn't find what you were looking for")).toBeVisible()
  })

  test('the not-found page surfaces three next-step actions', async ({ page }) => {
    await page.goto('/v2/another-missing-route-' + Date.now())
    await expect(page.getByTestId('v2-not-found-home')).toBeVisible()
    await expect(page.getByTestId('v2-not-found-chat')).toBeVisible()
    await expect(page.getByTestId('v2-not-found-report')).toBeVisible()
  })

  test('the home action returns the user to /v2', async ({ page }) => {
    await page.goto('/v2/yet-another-missing-' + Date.now())
    await page.getByTestId('v2-not-found-home').click()
    await expect(page).toHaveURL(/\/v2$/)
  })
})
