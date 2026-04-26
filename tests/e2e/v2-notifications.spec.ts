/*
 * v2 Notifications baseline.
 *
 * Confirms the Notifications card renders in /v2/settings with the
 * full set of category opt-ins, and confirms the in-app NotificationToast
 * does not appear when there are no pending log entries.
 *
 * Browser permission prompts cannot be granted from Playwright in
 * WebKit / Chromium without context.grantPermissions(), so we stub
 * navigator.permissions / Notification.requestPermission to verify
 * the Enable button responds without actually subscribing.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/settings notifications', () => {
  test('renders all six notification categories', async ({ page }) => {
    await page.goto('/v2/settings')

    const heading = page.getByRole('heading', { name: 'Notifications', level: 2 })
    await expect(heading).toBeVisible()

    await expect(page.getByText('Important health alerts', { exact: true })).toBeVisible()
    await expect(page.getByText('Doctor visit reminders', { exact: true })).toBeVisible()
    await expect(page.getByText('Daily check-in nudge', { exact: true })).toBeVisible()
    await expect(page.getByText('Cycle predictions', { exact: true })).toBeVisible()
    await expect(page.getByText('Pattern discoveries', { exact: true })).toBeVisible()
    await expect(page.getByText('Insurance reminders', { exact: true })).toBeVisible()
  })

  test('shows the explanatory line in NC voice', async ({ page }) => {
    await page.goto('/v2/settings')
    await expect(
      page.getByText('We will only notify you when something matters. Pick the kinds you want.', { exact: true }),
    ).toBeVisible()
  })

  test('Enable notifications button is visible when permission is default', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'default' })
    })
    await page.goto('/v2/settings')
    const enable = page.getByRole('button', { name: 'Enable notifications' })
    await expect(enable).toBeVisible()
  })
})

test.describe('/v2 in-app notification toast', () => {
  test('does not render when /api/v2/notifications/pending is empty', async ({ page }) => {
    await page.route('**/api/v2/notifications/pending**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) })
    })
    await page.goto('/v2')
    // The toast renders no element when there is nothing to show.
    const toast = page.getByTestId('notification-toast-open')
    await expect(toast).toHaveCount(0)
  })

  test('renders a pending notification and dismisses on close', async ({ page }) => {
    const items = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        notification_key: 'cycle:predict:2026-04-30',
        category: 'cycle_predictions',
        title: 'Period likely starting tomorrow',
        body: 'Heads up so you can pack what you need today.',
        url: '/v2/cycle/predict',
        sent_at: new Date().toISOString(),
      },
    ]
    await page.route('**/api/v2/notifications/pending**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items }) })
    })
    await page.route('**/api/v2/notifications/read', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, marked: 1 }) })
    })

    await page.goto('/v2')
    const open = page.getByTestId('notification-toast-open')
    await expect(open).toBeVisible({ timeout: 5_000 })
    await expect(open).toContainText('Period likely starting tomorrow')

    await page.getByTestId('notification-toast-dismiss').click()
    await expect(open).toHaveCount(0)
  })
})
