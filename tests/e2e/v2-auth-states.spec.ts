/*
 * v2 /v2/login state coverage.
 *
 * Verifies the form's branch handling for the states the UI is
 * supposed to handle today (401 / network failure / ?reset=1 banner /
 * ?error= surfacing) plus a 375x812 viewport regression that catches
 * any horizontal-bleed bug on this surface.
 *
 * No auth-logic changes are exercised. Each test stubs the
 * /api/auth/v2/login endpoint or pre-populates query params so the
 * real Supabase call never runs.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/login state coverage', () => {
  // Pre-acknowledge the cookie banner so it does not overlay the Sign in
  // button on a clean storage state (WebKit gets a fresh profile per test).
  // The banner itself is verified elsewhere; this surface only cares
  // about form behavior.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('v2-cookie-consent', 'acknowledged')
      } catch {
        // Storage blocked (private mode); banner self-handles that case.
      }
    })
  })

  test('401 invalid credentials renders friendly inline error', async ({ page }) => {
    await page.route('**/api/auth/v2/login', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid credentials' }),
      })
    })

    await page.goto('/v2/login')

    // Use a regex to scope to the actual <input type="email"> rather
    // than the OAuth buttons, which also contain "Email" copy.
    await page.getByLabel(/^email$/i).fill('lanae@example.com')
    await page.getByLabel(/^password$/i).fill('not-the-real-pw')

    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.locator('p[role="alert"]')).toHaveText(/wrong email or password/i)
  })

  test('network failure renders an inline error with the thrown message', async ({ page }) => {
    await page.route('**/api/auth/v2/login', (route) => route.abort('failed'))

    await page.goto('/v2/login')
    await page.getByLabel(/^email$/i).fill('lanae@example.com')
    await page.getByLabel(/^password$/i).fill('correct-horse-battery')

    await page.getByRole('button', { name: /^sign in$/i }).click()

    // The form catches the fetch rejection and shows err.message ?? 'Network error.'
    // WebKit and Chromium report different messages for an aborted request,
    // so we just assert that the alert region renders with non-empty text.
    const alert = page.locator('p[role="alert"]')

    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/\S/)
  })

  test('?reset=1 shows the reset-email confirmation card above the form', async ({ page }) => {
    await page.goto('/v2/login?reset=1')

    await expect(
      page.getByText(/password reset email sent\. open it on this device/i),
    ).toBeVisible()
    // The form is still rendered; the banner is additive.
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()
  })

  test('?error=<msg> populates the inline alert on mount', async ({ page }) => {
    const message = 'OAuth provider returned an unexpected response.'
    await page.goto(`/v2/login?error=${encodeURIComponent(message)}`)

    await expect(page.locator('p[role="alert"]')).toContainText(message)
  })

  test('375x812 viewport has no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/v2/login')
    // Wait until the form has hydrated; the heading is the cheapest signal.
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()

    const overflow = await page.evaluate(() => ({
      vw: window.innerWidth,
      scrollW: document.documentElement.scrollWidth,
    }))
    expect(overflow.scrollW).toBeLessThanOrEqual(overflow.vw)
  })
})
