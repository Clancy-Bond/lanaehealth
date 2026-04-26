/*
 * /v2/legal baseline.
 *
 * Three legal pages (privacy, terms, cookie-policy) plus the cookie
 * consent banner mounted in /v2/layout. All three must be reachable
 * without auth (signup links to them, app store reviewers read them
 * pre-account) so the middleware allowlist exposes the /v2/legal
 * prefix.
 *
 * We assert each page renders its heading, that the cross-links in
 * the page footer point at the other two, and that the consent
 * banner appears on first visit and disappears after Got it. We do
 * not exercise the full text of the policies; visual/legal sign-off
 * is a separate process.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/legal', () => {
  test('privacy page renders without auth', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/v2/legal/privacy')
    await expect(page.getByRole('heading', { name: /privacy policy/i }).first()).toBeVisible()
    // Cross-links in the footer.
    await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /cookie policy/i })).toBeVisible()
  })

  test('terms page renders without auth and shows the medical disclaimer callout', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/v2/legal/terms')
    await expect(page.getByRole('heading', { name: /terms of service/i }).first()).toBeVisible()
    // The medical disclaimer is the load-bearing clause; assert it
    // surfaces by name so a future refactor cannot silently demote it.
    await expect(page.getByRole('heading', { name: /medical disclaimer/i })).toBeVisible()
    await expect(page.getByText(/not a medical device/i).first()).toBeVisible()
  })

  test('cookie policy page renders without auth', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/v2/legal/cookie-policy')
    await expect(page.getByRole('heading', { name: /cookie policy/i }).first()).toBeVisible()
    await expect(page.getByText(/essential cookies/i).first()).toBeVisible()
  })
})

test.describe('CookieConsentBanner', () => {
  test('appears on first visit and dismisses', async ({ page, context }) => {
    await context.clearCookies()
    // Cookie banner uses local storage, not cookies; clear it via the
    // page itself before navigating.
    await page.addInitScript(() => {
      try {
        window.localStorage.removeItem('v2-cookie-consent')
      } catch {
        /* noop */
      }
    })
    await page.goto('/v2/legal/privacy')
    const banner = page.getByRole('region', { name: /cookie notice/i })
    await expect(banner).toBeVisible()
    await page.getByRole('button', { name: /got it/i }).click()
    await expect(banner).toBeHidden()

    // Reload: the banner should remember the dismissal.
    await page.reload()
    await expect(page.getByRole('region', { name: /cookie notice/i })).toHaveCount(0)
  })
})
