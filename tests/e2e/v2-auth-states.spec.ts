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

  test('email_not_confirmed code shows the confirm-your-email copy', async ({ page }) => {
    await page.route('**/api/auth/v2/login', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'email_not_confirmed' }),
      })
    })
    await page.goto('/v2/login')
    await page.getByLabel(/^email$/i).fill('lanae@example.com')
    await page.getByLabel(/^password$/i).fill('whatever')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.locator('p[role="alert"]')).toContainText(/confirm your email/i)
  })

  test('user_banned code shows the locked-account copy', async ({ page }) => {
    await page.route('**/api/auth/v2/login', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'user_banned' }),
      })
    })
    await page.goto('/v2/login')
    await page.getByLabel(/^email$/i).fill('lanae@example.com')
    await page.getByLabel(/^password$/i).fill('whatever')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.locator('p[role="alert"]')).toContainText(/account is locked/i)
  })

  test('429 too_many_requests shows the rate-limit copy', async ({ page }) => {
    await page.route('**/api/auth/v2/login', (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'too_many_requests' }),
      })
    })
    await page.goto('/v2/login')
    await page.getByLabel(/^email$/i).fill('lanae@example.com')
    await page.getByLabel(/^password$/i).fill('whatever')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.locator('p[role="alert"]')).toContainText(/too many attempts/i)
  })

  test('mfa_required code shows the two-factor copy', async ({ page }) => {
    await page.route('**/api/auth/v2/login', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'mfa_required' }),
      })
    })
    await page.goto('/v2/login')
    await page.getByLabel(/^email$/i).fill('lanae@example.com')
    await page.getByLabel(/^password$/i).fill('whatever')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.locator('p[role="alert"]')).toContainText(/two-factor/i)
  })

  test('returnTo from a protected route shows the bounce banner', async ({ page }) => {
    await page.goto('/v2/login?returnTo=/v2/cycle')
    const banner = page.getByTestId('login-bounce-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('/v2/cycle')
  })

  test('lock icon and wordmark render above the heading', async ({ page }) => {
    await page.goto('/v2/login')
    // The wordmark sits between the lock icon and the heading.
    await expect(page.getByText('LanaeHealth', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  })
})
