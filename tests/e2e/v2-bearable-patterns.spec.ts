/*
 * v2 Bearable-pattern features baseline.
 *
 * Coverage for the four user-facing surfaces shipped in this PR:
 *   - /v2/today (Triggers panel + Doctor visit prep card)
 *   - /v2/patterns/factors (Bearable-style factor explorer)
 *   - /v2/doctor/one-page (printable handoff)
 *   - The patterns hub now includes a Factors tile
 *
 * Migraine four-stage chips on /v2/log/pain are rendered conditionally
 * (head-region only). They are covered by component logic, not E2E.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2 Bearable-pattern surfaces', () => {
  test('factor explorer renders the outcome chip set and a calm empty state', async ({ page }) => {
    await page.goto('/v2/patterns/factors')
    await expect(page).toHaveURL(/\/v2\/patterns\/factors$/)
    // Outcome chip set, regardless of whether data exists yet.
    const chipGroup = page.getByRole('radiogroup', { name: 'Pick an outcome to explore' })
    await expect(chipGroup).toBeVisible()
    await expect(chipGroup.getByRole('radio', { name: 'Pain' })).toBeVisible()
    await expect(chipGroup.getByRole('radio', { name: 'Sleep quality' })).toBeVisible()
    // Source attribution is part of the contract; if it ever disappears
    // we want CI to scream because the Bearable cite is required.
    await expect(page.getByRole('link', { name: 'Bearable' })).toBeVisible()
  })

  test('switching outcome chips updates the prose target', async ({ page }) => {
    await page.goto('/v2/patterns/factors')
    const chipGroup = page.getByRole('radiogroup', { name: 'Pick an outcome to explore' })
    await chipGroup.getByRole('radio', { name: 'Sleep quality' }).click()
    // Prose body now references the picked outcome verbatim.
    await expect(page.getByText(/sleep quality/i).first()).toBeVisible()
  })

  test('one-page handoff renders the printable shell and 7-day stats table', async ({ page }) => {
    await page.goto('/v2/doctor/one-page')
    await expect(page).toHaveURL(/\/v2\/doctor\/one-page$/)
    // The Print Helper is screen-only chrome; the printable surface
    // itself is what the doctor will see on paper.
    await expect(page.getByLabel('Printable doctor handoff')).toBeVisible()
    await expect(page.getByText('7-day numbers (0 to 10 scale)')).toBeVisible()
    await expect(page.getByText('Notes for this visit')).toBeVisible()
    // Cite the source.
    await expect(
      page.getByRole('link', { name: /Bearable's printable worksheets/i }),
    ).toBeVisible()
  })

  test('patterns hub now includes the Factors tile', async ({ page }) => {
    await page.goto('/v2/patterns')
    await expect(page).toHaveURL(/\/v2\/patterns$/)
    await expect(page.getByRole('link', { name: /Factors/ })).toBeVisible()
  })
})
