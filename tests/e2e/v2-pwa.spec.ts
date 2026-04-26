/*
 * v2 PWA install + offline contract.
 *
 * Asserts the three install + offline guarantees:
 *
 *   1. Manifest is served, valid JSON, and contains the install-required
 *      fields (name, start_url, display, icons, theme_color).
 *   2. Service worker registers under /sw.js and reaches an active state
 *      after first navigation.
 *   3. OfflineIndicator renders when the page reports navigator.onLine
 *      is false (simulated via context.setOffline). The data-testid hook
 *      lets the test assert without coupling to copy.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2 PWA contract', () => {
  test('manifest.json is served and includes install-required fields', async ({ request }) => {
    const resp = await request.get('/manifest.json')
    expect(resp.ok()).toBeTruthy()
    const m = await resp.json()
    expect(m.name).toBeTruthy()
    expect(m.short_name).toBeTruthy()
    expect(m.start_url).toBeTruthy()
    expect(m.display).toBe('standalone')
    expect(Array.isArray(m.icons)).toBe(true)
    expect(m.icons.length).toBeGreaterThan(0)
    expect(m.theme_color).toBeTruthy()
    expect(m.background_color).toBeTruthy()
    // At least one maskable icon for adaptive launchers.
    const hasMaskable = m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')
    expect(hasMaskable).toBe(true)
  })

  test('sw.js is served and the page registers it', async ({ page, request }) => {
    const swResp = await request.get('/sw.js')
    expect(swResp.ok()).toBeTruthy()

    await page.goto('/v2')
    // Wait for the SW to register and activate. This can take a tick on a
    // cold Next.js dev server, so we poll up to 10s.
    const ready = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false
      try {
        const reg = await navigator.serviceWorker.ready
        return !!reg.active && reg.active.scriptURL.endsWith('/sw.js')
      } catch {
        return false
      }
    })
    expect(ready).toBe(true)
  })

  test('OfflineIndicator surfaces when the network drops', async ({ page, context }) => {
    await page.goto('/v2')
    // Indicator hidden while online.
    await expect(page.getByTestId('offline-indicator')).toHaveCount(0)

    // Simulate offline. The component listens for the 'offline' event.
    await context.setOffline(true)
    // Some browsers do not fire the event when toggled via CDP after
    // initial load; dispatch it manually to be safe.
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await expect(page.getByTestId('offline-indicator')).toBeVisible()
    await expect(page.getByTestId('offline-indicator')).toHaveAttribute('data-status', 'offline')

    // Back online.
    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    // Reconnecting flash visible briefly.
    await expect(page.getByTestId('offline-indicator')).toHaveAttribute('data-status', 'reconnecting')
  })
})
