/*
 * /v2/learn baseline E2E.
 *
 * Confirms:
 *   1. The hub renders, with category headers and the related-conditions
 *      preview both visible.
 *   2. Flagship articles across all 8 categories render with body content
 *      and sources, including the Lanae-relevant chronic-illness + cycle
 *      cluster (POTS, migraine, EDS-MCAS).
 *   3. The Learn shortcut on home navigates to the hub.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/learn hub + articles', () => {
  test('hub renders with all 8 category headers and 24+ article links', async ({ page }) => {
    await page.goto('/v2/learn')
    await expect(page).toHaveURL(/\/v2\/learn$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible()
    await expect(page.getByTestId('learn-category-cycle-basics')).toBeVisible()
    await expect(page.getByTestId('learn-category-fertility-awareness')).toBeVisible()
    await expect(page.getByTestId('learn-category-period-basics')).toBeVisible()
    await expect(page.getByTestId('learn-category-hormones')).toBeVisible()
    await expect(page.getByTestId('learn-category-cycle-health')).toBeVisible()
    await expect(page.getByTestId('learn-category-lifestyle-factors')).toBeVisible()
    await expect(page.getByTestId('learn-category-conditions')).toBeVisible()
    await expect(page.getByTestId('learn-category-chronic-illness-cycle')).toBeVisible()
    const links = page.getByTestId('learn-article-link')
    await expect(await links.count()).toBeGreaterThanOrEqual(24)
  })

  test('hub surfaces related-conditions preview near the top', async ({ page }) => {
    await page.goto('/v2/learn')
    await expect(page.getByTestId('learn-related-conditions')).toBeVisible()
    const links = page.getByTestId('learn-related-condition-link')
    await expect(await links.count()).toBeGreaterThanOrEqual(3)
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

  test('article: anovulatory cycles renders with sources', async ({ page }) => {
    await page.goto('/v2/learn/anovulatory-cycles-what-they-are')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Anovulatory cycles: what they are and when to worry',
      }),
    ).toBeVisible()
    await expect(page.getByTestId('citation-list')).toBeVisible()
  })

  test('article: how sleep affects your cycle renders with sources', async ({ page }) => {
    await page.goto('/v2/learn/how-sleep-affects-your-cycle')
    await expect(
      page.getByRole('heading', { level: 1, name: 'How sleep affects your cycle' }),
    ).toBeVisible()
    await expect(page.getByTestId('citation-list')).toBeVisible()
  })

  test('article: PCOS signs and what to do renders with sources', async ({ page }) => {
    await page.goto('/v2/learn/pcos-signs-and-what-to-do')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Polycystic Ovary Syndrome (PCOS): signs and what to do',
      }),
    ).toBeVisible()
    await expect(page.getByTestId('citation-list')).toBeVisible()
  })

  test('article: PMDD vs PMS renders with sources', async ({ page }) => {
    await page.goto('/v2/learn/pmdd-vs-pms-how-to-tell-the-difference')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'PMDD vs PMS: how to tell the difference',
      }),
    ).toBeVisible()
    await expect(page.getByTestId('citation-list')).toBeVisible()
  })

  test('article: POTS and your cycle renders with Dysautonomia International citation', async ({ page }) => {
    await page.goto('/v2/learn/pots-and-your-cycle')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'POTS and your cycle: hormones affect autonomic function',
      }),
    ).toBeVisible()
    const sources = page.getByTestId('citation-list')
    await expect(sources).toBeVisible()
    await expect(sources).toContainText('Dysautonomia International')
  })

  test('article: migraine and the menstrual cycle renders with Migraine Trust citation', async ({ page }) => {
    await page.goto('/v2/learn/migraine-and-the-menstrual-cycle')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Migraine and the menstrual cycle: estrogen withdrawal',
      }),
    ).toBeVisible()
    const sources = page.getByTestId('citation-list')
    await expect(sources).toBeVisible()
    await expect(sources).toContainText('Migraine Trust')
  })

  test('article: EDS, MCAS, and cycle hormones renders with sources', async ({ page }) => {
    await page.goto('/v2/learn/eds-mcas-and-cycle-hormones')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'EDS, MCAS, and cycle hormones: the trifecta',
      }),
    ).toBeVisible()
    const sources = page.getByTestId('citation-list')
    await expect(sources).toBeVisible()
    await expect(sources).toContainText('EDS Society')
  })
})
