/*
 * /v2/calories/plan - weight loss plan calculator E2E.
 *
 * Verifies:
 *  1. Page renders the calculator with TDEE + Daily target stats.
 *  2. Adjusting the weekly rate slider updates Daily target live.
 *  3. Saving the plan returns success (banner appears).
 *  4. After reload, the saved plan is the seed for the calculator
 *     (slider value persists across reloads).
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/calories/plan', () => {
  test('calculator renders, recomputes, saves, and persists', async ({ page }) => {
    await page.goto('/v2/calories/plan')
    await expect(page).toHaveURL(/\/v2\/calories\/plan/)

    // Hero copy + stats
    await expect(page.getByRole('heading', { name: /About you/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /How fast/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Your plan/i })).toBeVisible()

    // The TDEE + Daily target stat tiles render.
    await expect(page.getByText(/Maintenance \(TDEE\)/i)).toBeVisible()
    await expect(page.getByText(/Daily target/i)).toBeVisible()

    // The slider may start anywhere (saved plan persists). Read its
    // current value, then move enough ticks in the direction that has
    // headroom so the change is observable.
    const slider = page.getByRole('slider', { name: /weekly weight loss rate/i })
    await slider.focus()
    const startValue = parseFloat(
      await slider.evaluate((el) => (el as HTMLInputElement).value),
    )
    const dailyTargetBefore = await page
      .locator('text=/Daily target/i')
      .locator('..')
      .innerText()

    // Slider min=0.25 step=0.05, so up to 15 ticks of headroom in the
    // safer direction (left). Pick whichever direction has more room.
    const goLeft = startValue > 0.5
    const key = goLeft ? 'ArrowLeft' : 'ArrowRight'
    for (let i = 0; i < 10; i++) {
      await slider.press(key)
    }

    const dailyTargetAfter = await page
      .locator('text=/Daily target/i')
      .locator('..')
      .innerText()
    expect(dailyTargetAfter).not.toBe(dailyTargetBefore)

    // Hit Save plan.
    const saveBtn = page.getByRole('button', { name: /Save plan/i })
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Success banner appears.
    await expect(page.getByText(/Saved at/i)).toBeVisible({ timeout: 15_000 })

    // Reload and confirm the slider re-seeds from the saved plan.
    await page.reload()
    await expect(page.getByRole('heading', { name: /Your plan/i })).toBeVisible()
    const sliderAfterReload = page.getByRole('slider', { name: /weekly weight loss rate/i })
    const valueAfter = parseFloat(
      await sliderAfterReload.evaluate((el) => (el as HTMLInputElement).value),
    )
    // Should be different from the starting value (we moved it 10 ticks).
    expect(Math.abs(valueAfter - startValue)).toBeGreaterThan(0.2)
  })
})
