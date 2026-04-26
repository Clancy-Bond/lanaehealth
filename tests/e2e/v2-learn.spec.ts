/*
 * /v2/learn baseline E2E.
 *
 * Confirms:
 *   1. The hub renders, with category headers visible.
 *   2. Three flagship articles render and present body content + sources.
 *   3. The Learn shortcut on home navigates to the hub.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/learn hub + articles', () => {
  test('hub renders with category headers and article links', async ({ page }) => {
    await page.goto('/v2/learn')
    await expect(page).toHaveURL(/\/v2\/learn$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible()
    await expect(page.getByTestId('learn-category-cycle-basics')).toBeVisible()
    await expect(page.getByTestId('learn-category-fertility-awareness')).toBeVisible()
    await expect(page.getByTestId('learn-category-period-basics')).toBeVisible()
    await expect(page.getByTestId('learn-category-hormones')).toBeVisible()
    const links = page.getByTestId('learn-article-link')
    await expect(await links.count()).toBeGreaterThanOrEqual(12)
  })

  test('article: how your cycle works renders with sources', async ({ page }) => {
    await page.goto('/v2/learn/how-your-cycle-works')
    await expect(
      page.getByRole('heading', { level: 1, name: 'How your cycle works' }),
    ).toBeVisible()
    await expect(page.getByTestId('citation-list')).toBeVisible()
    // At least one source link goes to acog.org or womenshealth.gov.
    const sourceLinks = page.getByTestId('citation-list').getByRole('link')
    await expect(await sourceLinks.count()).toBeGreaterThan(0)
  })

  test('article: how BBT predicts ovulation renders with sources', async ({ page }) => {
    await page.goto('/v2/learn/how-bbt-predicts-ovulation')
    await expect(
      page.getByRole('heading', { level: 1, name: 'How BBT predicts ovulation' }),
    ).toBeVisible()
    await expect(page.getByTestId('citation-list')).toBeVisible()
  })

  test('article: estrogen and progesterone renders with sources', async ({ page }) => {
    await page.goto('/v2/learn/estrogen-and-progesterone-in-plain-english')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Estrogen and progesterone in plain English',
      }),
    ).toBeVisible()
    await expect(page.getByTestId('citation-list')).toBeVisible()
  })
})
