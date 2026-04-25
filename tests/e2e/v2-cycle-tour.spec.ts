/*
 * /v2/cycle 7-step in-app tutorial.
 *
 * On first visit (when no tutorial_progress.cycle.completed and
 * no dismissed flag exist), the CoachmarkTour auto-starts and
 * presents step 1/7. The user can Skip to dismiss, or advance
 * through 7 steps. Replay is available from /v2/settings.
 *
 * Because the tour persists progress per-user, this spec is
 * tolerant of the tour having been dismissed already in the test
 * environment: we assert the Replay control is reachable from
 * /v2/settings either way.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/cycle in-app tour', () => {
  test('tour control is reachable from /v2/settings', async ({ page }) => {
    await page.goto('/v2/settings')
    await expect(page.getByRole('heading', { name: 'Replay cycle tour' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Replay tour/ })).toBeVisible()
  })

  test('replay starts the tour and step counter shows 1 / 7', async ({ page }) => {
    await page.goto('/v2/settings')
    await page.getByRole('button', { name: /Replay tour/ }).click()
    await expect(page).toHaveURL(/\/v2\/cycle$/)
    // The coachmark step counter renders as "1 / 7".
    await expect(page.getByText(/^1 \/ 7$/)).toBeVisible({ timeout: 5000 })
    // Skipping closes the overlay.
    await page.getByRole('button', { name: 'Skip tour' }).click()
    await expect(page.getByText(/^1 \/ 7$/)).not.toBeVisible({ timeout: 3000 })
  })
})
