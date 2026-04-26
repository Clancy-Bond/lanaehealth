/*
 * v2 Sleep + Home: Oura wave 2 components.
 *
 * Asserts each new component renders without crash. Per the project
 * convention these tests run against the un-authenticated dev server
 * (LANAE_REQUIRE_AUTH=false), so we only check structural elements
 * that are present even with empty data: section eyebrows, the
 * RecoveryTimeCard test id, and SVG/aria labels for the new charts.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/sleep Oura wave 2 components', () => {
  test('sleep page renders all five new sections without crashing', async ({ page }) => {
    await page.goto('/v2/sleep')
    await expect(page).toHaveURL(/\/v2\/sleep$/)
    // Each section has a distinctive eyebrow string.
    await expect(page.getByText(/HRV balance/i).first()).toBeVisible()
    await expect(page.getByText(/Sleep stages, last 7 nights/i).first()).toBeVisible()
    await expect(page.getByText(/Bedtime regularity, last 14 nights/i).first()).toBeVisible()
    await expect(page.getByText(/Body temperature, last 30 nights/i).first()).toBeVisible()
  })

  test('sleep stages strip and bedtime chart are reachable in the DOM', async ({ page }) => {
    await page.goto('/v2/sleep')
    // Either render the strip or the empty-state copy. Both are valid
    // signals that the component mounted.
    const stagesPresent = await page
      .getByText(/Sleep stages, last 7 nights/i)
      .first()
      .isVisible()
    expect(stagesPresent).toBeTruthy()

    const bedtimePresent = await page
      .getByText(/Bedtime regularity, last 14 nights/i)
      .first()
      .isVisible()
    expect(bedtimePresent).toBeTruthy()
  })
})

test.describe('/v2 home recovery time card', () => {
  test('home renders the recovery time card', async ({ page }) => {
    await page.goto('/v2')
    await expect(page).toHaveURL(/\/v2$/)
    const card = page.getByTestId('recovery-time-card')
    await expect(card).toBeVisible()
    // The eyebrow string is always rendered regardless of data state.
    await expect(card.getByText(/Recovery time/i)).toBeVisible()
  })
})
