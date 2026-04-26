/*
 * v2 insurance carrier expansion baseline.
 *
 * Confirms the new dynamic [slug] route renders carrier guides for the
 * 12 carriers added in the "page for every insurance" expansion. Spot
 * checks UnitedHealthcare (the largest US private insurer) end to end:
 * page loads, the 9-section template renders, the sources block is
 * present, and the back chevron lands on the hub.
 *
 * Also asserts the hub now exposes the Browse-all carriers card with
 * the search input.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/insurance carrier expansion', () => {
  test('hub exposes the Browse all carriers search and groups', async ({ page }) => {
    await page.goto('/v2/insurance')
    await expect(page.getByRole('heading', { name: 'Browse all carriers' })).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Find your insurance' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Private carriers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Government programs' })).toBeVisible()
  })

  test('UnitedHealthcare guide renders all 9 sections', async ({ page }) => {
    await page.goto('/v2/insurance/unitedhealthcare')
    await expect(
      page.getByRole('heading', { level: 1, name: /UnitedHealthcare/ }),
    ).toBeVisible()
    // Use exact match because the renderer also emits h3 sub-headings
    // (e.g. "Find an in-network provider") that loosely match short
    // h2 names like "Network".
    for (const heading of [
      'At a glance',
      'Network',
      'Referrals',
      'Specialist access',
      'Tests and procedures',
      'Appeals',
      'Anti-gaslighting strategies',
      'For chronic illness specifically',
      'Contact and member services',
      'Sources',
    ]) {
      await expect(
        page.getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible()
    }
  })

  test('Medicare and Medicaid guides render', async ({ page }) => {
    await page.goto('/v2/insurance/medicare')
    await expect(page.getByRole('heading', { level: 1, name: /Medicare/ })).toBeVisible()

    await page.goto('/v2/insurance/medicaid')
    await expect(page.getByRole('heading', { level: 1, name: /Medicaid/ })).toBeVisible()
  })

  test('search filters the carrier list', async ({ page }) => {
    await page.goto('/v2/insurance')
    const search = page.getByRole('searchbox', { name: 'Find your insurance' })
    await search.fill('aetna')
    await expect(page.getByRole('link', { name: /Aetna/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /UnitedHealthcare/ })).toHaveCount(0)
  })

  test('back chevron from a guide lands on the hub', async ({ page }) => {
    await page.goto('/v2/insurance/cigna')
    await page.getByRole('link', { name: 'Back to insurance hub' }).click()
    await expect(page).toHaveURL(/\/v2\/insurance$/)
  })
})
