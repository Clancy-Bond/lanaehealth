/*
 * /v2/cycle/messages baseline.
 *
 * Smart-logging Messages inbox. Confirms the page renders with
 * either an empty state or a list of cards, and that the back
 * arrow round-trips to /v2/cycle.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/cycle/messages', () => {
  test('renders the inbox with header and back link', async ({ page }) => {
    await page.goto('/v2/cycle/messages')
    await expect(page).toHaveURL(/\/v2\/cycle\/messages$/)
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible()
    // Either we have the empty-state copy or at least one inbox card.
    const empty = page.getByText(/Inbox is empty/)
    const intro = page.getByText(/Phase-aware reminders/)
    await expect(intro).toBeVisible()
    await expect(empty.or(page.getByRole('button', { name: 'Dismiss message' }).first())).toBeVisible()
  })

  test('back arrow returns to /v2/cycle', async ({ page }) => {
    await page.goto('/v2/cycle/messages')
    await page.getByRole('link', { name: 'Back to cycle' }).click()
    await expect(page).toHaveURL(/\/v2\/cycle$/)
  })
})
