/*
 * v2 Home + bottom-nav baseline.
 *
 * Confirms the v2 shell loads, the four-tab navigation contract holds
 * (Home / Cycle / Food / More), and that tapping each tab moves to the
 * expected route. The active-tab affordance is verified through
 * aria-pressed since the underline is a layout-id motion element.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2 home + bottom navigation', () => {
  test('renders v2 home with the bottom tab bar', async ({ page }) => {
    await page.goto('/v2')
    await expect(page).toHaveURL(/\/v2$/)
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav).toBeVisible()
  })

  test('exposes Home, Cycle, Food, and More tabs', async ({ page }) => {
    await page.goto('/v2')
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('button', { name: 'Home' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Cycle' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Food' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'More' })).toBeVisible()
  })

  test('tapping Cycle navigates to /v2/cycle and marks the tab active', async ({ page }) => {
    await page.goto('/v2')
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Cycle' }).click()
    await expect(page).toHaveURL(/\/v2\/cycle(\/.*)?$/)
    const cycleTab = page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Cycle' })
    await expect(cycleTab).toHaveAttribute('aria-pressed', 'true')
  })

  test('tapping Food navigates to /v2/calories and marks the tab active', async ({ page }) => {
    await page.goto('/v2')
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Food' }).click()
    await expect(page).toHaveURL(/\/v2\/calories(\/.*)?$/)
    const foodTab = page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Food' })
    await expect(foodTab).toHaveAttribute('aria-pressed', 'true')
  })

  test('Home tab returns to /v2 from any section', async ({ page }) => {
    await page.goto('/v2/cycle')
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Home' }).click()
    await expect(page).toHaveURL(/\/v2$/)
    const homeTab = page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Home' })
    await expect(homeTab).toHaveAttribute('aria-pressed', 'true')
  })
})
