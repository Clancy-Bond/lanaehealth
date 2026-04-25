/*
 * v2 Theme persistence baseline.
 *
 * Lanae cannot read the default Oura-dark chrome, so the theme toggle
 * is a critical accessibility surface. This suite confirms that the
 * /v2/settings Appearance card flips data-theme on the .v2 root and
 * that the choice survives a reload via localStorage.
 *
 * Implementation note: useV2Theme writes data-theme="light" when
 * Light is selected, and removes the attribute (rather than setting
 * data-theme="dark") for Dark. The assertions follow that contract.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/settings appearance', () => {
  test('renders the Appearance section with three theme options', async ({ page }) => {
    await page.goto('/v2/settings')
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
    const radios = page.getByRole('radiogroup', { name: 'Theme' })
    await expect(radios.getByRole('radio', { name: 'Dark' })).toBeVisible()
    await expect(radios.getByRole('radio', { name: 'Light' })).toBeVisible()
    await expect(radios.getByRole('radio', { name: 'System' })).toBeVisible()
  })

  test('selecting Light flips data-theme on the .v2 root and persists across reload', async ({ page }) => {
    await page.goto('/v2/settings')
    // The page renders the .v2 wrapper twice (layout shell + nested
    // section wrapper). The hook writes to the topmost match so we
    // pin the assertion to .first(). Reset back to Dark for hygiene.
    const root = page.locator('.v2').first()
    await page.getByRole('radio', { name: 'Light' }).click()
    await expect(root).toHaveAttribute('data-theme', 'light')
    await page.reload()
    await expect(root).toHaveAttribute('data-theme', 'light')
    await page.getByRole('radio', { name: 'Dark' }).click()
    await expect(root).not.toHaveAttribute('data-theme', /.+/)
  })
})
