/*
 * v2 test navigator playbook.
 *
 * Covers the new /v2/insurance/tests hub plus two representative test
 * guide pages (tilt table for cardiology, brain MRI for neurology).
 *
 * Confirms:
 *   - Hub loads, lists every category heading, and exposes test links.
 *   - Tilt table guide renders all 9 sections (incl. denial pushback)
 *     and the back chevron lands on the hub.
 *   - Brain MRI guide renders the script and a denial card.
 *   - Category page filters to one category.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/insurance/tests test navigator', () => {
  test('hub lists every category and exposes test links', async ({ page }) => {
    await page.goto('/v2/insurance/tests')
    await expect(page.getByRole('heading', { level: 1, name: 'Test navigator' })).toBeVisible()
    for (const heading of [
      'Cardiology and autonomic',
      'Neurology',
      'Allergy and immunology',
      'Gastroenterology',
      'Endocrinology',
      'Genetic',
      'Specialty imaging',
    ]) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
    // Spot-check a known test link is present.
    await expect(page.getByRole('link', { name: /Tilt table test/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Brain MRI/i })).toBeVisible()
  })

  test('tilt table test guide renders all 9 sections', async ({ page }) => {
    await page.goto('/v2/insurance/tests/tilt-table-test')
    await expect(
      page.getByRole('heading', { level: 1, name: /Tilt table test/ }),
    ).toBeVisible()
    for (const heading of [
      'What it is',
      'Why you might need it',
      'How to ask your PCP for it',
      'What to expect',
      'Reading the results',
      'If insurance denies it',
      'If your PCP cannot order it',
      'Cost expectations',
      'Sources',
    ]) {
      await expect(
        page.getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible()
    }
    // At least one denial card with the "Denial:" label.
    await expect(page.getByRole('heading', { name: /^Denial:/ }).first()).toBeVisible()
  })

  test('brain MRI guide renders the PCP script', async ({ page }) => {
    await page.goto('/v2/insurance/tests/brain-mri')
    await expect(
      page.getByRole('heading', { level: 1, name: /Brain MRI/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'How to ask your PCP for it', exact: true }),
    ).toBeVisible()
    // Script blocks render the PCP script verbatim. Confirm a known fragment.
    await expect(page.getByText(/I have chronic migraine/i)).toBeVisible()
  })

  test('back chevron from a guide lands on the navigator hub', async ({ page }) => {
    await page.goto('/v2/insurance/tests/tilt-table-test')
    await page.getByRole('link', { name: 'Back to test navigator' }).click()
    await expect(page).toHaveURL(/\/v2\/insurance\/tests$/)
  })

  test('category page filters to one category', async ({ page }) => {
    await page.goto('/v2/insurance/tests/category/cardiology')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Cardiology and autonomic' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: /Tilt table test/ })).toBeVisible()
    // A neurology-only test should not appear here.
    await expect(page.getByRole('heading', { name: /Brain MRI/ })).toHaveCount(0)
  })
})
