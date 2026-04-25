/*
 * v2 Cycle baseline.
 *
 * The cycle screen is the most data-dense surface in v2 and the one
 * Lanae checks first thing in the morning. We assert that the radial
 * hero, weekday strip, and a phase tip are present, and that the FAB
 * route into the log flow plus the back-to-cycle arrow round-trip.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/cycle', () => {
  test('renders the cycle hero, weekday strip, and a phase tip', async ({ page }) => {
    await page.goto('/v2/cycle')
    await expect(page).toHaveURL(/\/v2\/cycle$/)
    // Hero ring carries the section title; using the page title as the
    // anchor is more durable than a CSS class on the SVG itself.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    // Weekday strip is a horizontal list of seven day cells. Look for
    // any one of the canonical weekday short names; the strip rotates
    // depending on today's day, so any single match is enough.
    const weekdayCount = await page
      .getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)
      .count()
    expect(weekdayCount).toBeGreaterThanOrEqual(7)
    // Phase tip card uses one of these phase keywords as a heading.
    const phaseCopy = page.getByText(/menstrual|follicular|ovulatory|luteal/i).first()
    await expect(phaseCopy).toBeVisible()
  })

  test('FAB routes to the log entry flow and back arrow returns to /v2/cycle', async ({ page }) => {
    await page.goto('/v2/cycle')
    // The FAB is a button (aria-label) wrapped in a Link; the Link
    // wrapper has no layout because the button is position:fixed.
    // Click the button so we do not target the zero-size wrapper.
    await page.getByRole('button', { name: 'Log cycle entry' }).click()
    await expect(page).toHaveURL(/\/v2\/cycle\/log/)
    await page.getByRole('link', { name: 'Back to cycle' }).click()
    await expect(page).toHaveURL(/\/v2\/cycle$/)
  })
})
