/*
 * v2 Onboarding follow-ups E2E (PR #93 follow-up).
 *
 * Two coverage areas:
 *   1. Settings has a "Walk through setup again" card that links to
 *      /v2/onboarding/1?revise=true. Loading the wizard with that
 *      param renders the standard step chrome and a "Stop revising"
 *      footer link instead of the usual "Skip for now".
 *   2. /api/v2/onboarding/dismiss-skip-banner enforces auth, matching
 *      the rest of the onboarding API surface.
 *
 * The dev server runs with LANAE_REQUIRE_AUTH=false so the surface
 * pages render in preview mode without a fixture session. The /api
 * routes still enforce auth on their own; deeper "banner actually
 * disappears for this user" coverage lives in the integration suite.
 */
import { expect, test } from '@playwright/test'

test.describe('Settings re-link to re-run onboarding', () => {
  test('settings page exposes a "Walk through setup again" card', async ({ page }) => {
    await page.goto('/v2/settings')
    await expect(page.getByRole('heading', { name: /walk through setup again/i })).toBeVisible()
    // The CTA is rendered as a Link, so it appears as a role=link.
    const cta = page.getByRole('link', { name: /walk through setup again/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/v2/onboarding/1?revise=true')
  })

  test('opening the wizard with ?revise=true renders the welcome step in revise mode', async ({ page }) => {
    await page.goto('/v2/onboarding/1?revise=true')
    // Welcome heading switches to the revise copy.
    await expect(page.getByRole('heading', { name: /let.?s revise/i })).toBeVisible()
    // The progress dots still show 7 segments.
    await expect(page.getByRole('progressbar', { name: /step 1 of 7/i })).toBeVisible()
  })

  test('revise mode renders "Stop revising" instead of "Skip for now" on a middle step', async ({ page }) => {
    await page.goto('/v2/onboarding/3?revise=true')
    await expect(page.getByRole('link', { name: /stop revising/i })).toBeVisible()
    // The original "Skip for now" link is hidden in revise mode so we
    // never re-mark a returning user as skipped.
    await expect(page.getByRole('link', { name: /skip for now/i })).toHaveCount(0)
  })

  test('index page forwards ?revise=true to step 1', async ({ page }) => {
    await page.goto('/v2/onboarding?revise=true')
    // The index page redirects server-side. page.url() is the final
    // landing URL after the redirect chain settles. response.url()
    // can return the first request URL even when the page navigated
    // away, so we read page.url() directly.
    await page.waitForURL(/\/v2\/onboarding\/1\?revise=true$/)
    expect(page.url()).toMatch(/\/v2\/onboarding\/1\?revise=true$/)
  })
})

test.describe('Skip-onboarding banner contract', () => {
  test('POST /api/v2/onboarding/dismiss-skip-banner requires auth', async ({ request }) => {
    const res = await request.post('/api/v2/onboarding/dismiss-skip-banner')
    expect(res.status()).toBe(401)
  })
})
