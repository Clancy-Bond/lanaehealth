/*
 * v2 comprehensive auth.
 *
 * Verifies that /v2/login and /v2/signup expose all four sign-in
 * options:
 *   - Continue with Apple
 *   - Continue with Google
 *   - Use a passkey (login only; signup hides this until the user
 *     has an account)
 *   - Email + password (regression check)
 *
 * The passkey button visibility depends on PublicKeyCredential
 * being defined on `window`. Playwright's WebKit and Chromium
 * projects both have it.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2 auth - 4 sign-in options', () => {
  test('login page shows Apple, Google, passkey, and email + password', async ({ page }) => {
    await page.goto('/v2/login')

    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /continue with apple/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /use a passkey/i })).toBeVisible()

    // Email + password regression: fields exist, submit gates on inputs.
    await expect(page.getByText(/^Email$/i)).toBeVisible()
    await expect(page.getByText(/^Password$/i)).toBeVisible()
    const submit = page.getByRole('button', { name: /^sign in$/i })
    await expect(submit).toBeVisible()
    await expect(submit).toBeDisabled()
  })

  test('signup page shows Apple, Google, and email + password (passkey hint instead of button)', async ({ page }) => {
    await page.goto('/v2/signup')

    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /continue with apple/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
    // Hint about adding a passkey after signing up.
    await expect(page.getByText(/add a passkey for face id or touch id/i)).toBeVisible()

    const submit = page.getByRole('button', { name: /create account/i })
    await expect(submit).toBeVisible()
    await expect(submit).toBeDisabled()
  })

  test('Apple and Google buttons render with the right brand chrome', async ({ page }) => {
    await page.goto('/v2/login')

    // Apple button: black background, white text, has the Apple wordmark.
    const apple = page.getByRole('button', { name: /continue with apple/i })
    await expect(apple).toBeVisible()
    const appleBg = await apple.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(appleBg).toContain('0, 0, 0')

    // Google button: white background, dark text.
    const google = page.getByRole('button', { name: /continue with google/i })
    await expect(google).toBeVisible()
    const googleBg = await google.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(googleBg).toContain('255, 255, 255')
  })

  test('passkey sign-in shows a kind message when no passkey is registered', async ({ page }) => {
    await page.goto('/v2/login')

    // Intercept the options POST and return 401 so the UI reports
    // the "no passkey is registered" path without invoking the
    // browser's WebAuthn dialog.
    await page.route('**/api/auth/passkey/authenticate', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No passkey is registered for this device. Sign in another way and add one in Settings.' }),
      })
    })

    await page.getByRole('button', { name: /use a passkey/i }).click()
    await expect(page.getByText(/no passkey is registered/i)).toBeVisible()
  })
})
