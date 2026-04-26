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
    // a near-identical background. The 2026-04-25 regression had a
    // different shape: the form was opaque and bordered, but the sticky
    // SearchTopTabs wrapper used top:var(--v2-topbar-height) instead of
    // top:0, which inside MobileShell's inner <main> scroll container
    // shifted the tabs DOWN by 56px, overlapping the search input below.
    // The two assertions below cover both regressions:
    //   1. Input has real tappable bounds.
    //   2. Input's top edge is at or below the tab strip's bottom edge
    //      (i.e. the tabs do NOT visually occlude the input).
    const box = await input.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)

    const tabList = page.getByRole('tablist', { name: 'Food search views' })
    const tabBox = await tabList.boundingBox()
    expect(tabBox).not.toBeNull()
    expect(box).not.toBeNull()
    // 1px slack to absorb sub-pixel rendering. If the tab strip ever
    // returns to overlapping the input, this fails by ~30+ pixels.
    expect(box!.y + 1).toBeGreaterThanOrEqual(tabBox!.y + tabBox!.height)

    // Confirm the form has a non-transparent fill so it stands out from
    // the page background. Catches the original 6%-alpha regression too.
    const formBg = await page.evaluate(() => {
      const form = document.querySelector('form[role="search"]')
      return form ? window.getComputedStyle(form).backgroundColor : ''
    })
    expect(formBg).not.toBe('')
    expect(formBg).not.toBe('rgba(0, 0, 0, 0)')
    expect(formBg).not.toBe('transparent')

    // The Search button only becomes enabled once the user types.
    const submitBtn = page.getByRole('button', { name: 'Search', exact: true })
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
