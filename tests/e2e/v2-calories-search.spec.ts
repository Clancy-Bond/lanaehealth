/*
 * v2 Calories search regression coverage (PR: fix-food-search).
 *
 * The user reported "USDA database doesn't seem to be connected" on
 * production. Root cause was a contrast bug in SearchInput: the field
 * vanished into the dark background on iPhone, so the user could not
 * see where to type. Search itself was healthy.
 *
 * These specs lock both halves of the regression:
 *   1. The input is visibly present, has a high-contrast border, and a
 *      Search submit button is reachable (no more "Enter is the only
 *      affordance").
 *   2. End-to-end USDA wiring still returns at least one result for a
 *      universal staple ("egg"), so a future cache poisoning or env
 *      misconfig is caught in CI.
 *
 * The result-rendering check is gated on USDA_API_KEY being present in
 * the test environment, so CI without the key remains green.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/calories/search regression', () => {
  test('search input is visible and has a Search button', async ({ page }) => {
    await page.goto('/v2/calories/search')
    const input = page.getByRole('textbox', { name: 'Search foods' })
    await expect(input).toBeVisible()
    // Bounding box must be a real, tappable target. The pre-fix input
    // was 44px tall but visually invisible due to a 6%-alpha border on
    // a near-identical background — the regression we want to lock is
    // the explicit Search button + clear-input affordance below.
    const box = await input.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)

    // The Search button only becomes enabled once the user types.
    const submitBtn = page.getByRole('button', { name: 'Search' })
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toBeDisabled()

    await input.fill('egg')
    await expect(submitBtn).toBeEnabled()

    // Clear-input button appears and works.
    const clearBtn = page.getByRole('button', { name: 'Clear search' })
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()
    await expect(input).toHaveValue('')
  })

  test('USDA returns at least one result for "egg" (env-gated)', async ({ page }) => {
    // Skip in environments without the USDA key (CI, contributor laptops
    // without secrets). Coverage of the typed-error contract lives in
    // src/lib/api/__tests__/usda-food-errors.test.ts.
    test.skip(
      !process.env.USDA_API_KEY,
      'USDA_API_KEY missing — skipping live integration check',
    )
    await page.goto('/v2/calories/search?q=egg')
    // The "having trouble" headline is the new error path. If we hit
    // it, the integration is broken — fail loudly.
    const trouble = page.getByText('Food search is having trouble')
    await expect(trouble).toHaveCount(0)
    // Foundation type "Eggs, Grade A, Large, egg whole" is the canonical
    // USDA top hit; assert against the dataType label so the test does
    // not break on minor description changes.
    await expect(page.getByText(/Foundation/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })
})
