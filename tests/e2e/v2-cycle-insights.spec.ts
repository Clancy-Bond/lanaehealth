/*
 * /v2/cycle/insights baseline.
 *
 * Population comparison stats. Confirms the page renders the
 * comparison rows with both "You" and "All cyclers" columns and
 * cites the published sources, plus all four wave-3 surfaces:
 *
 *   A. CycleInsightsChart (landscape BBT view)
 *   B. MultiCycleCompare (side-by-side cycles)
 *   C. StatisticsRollup (population reference ranges)
 *   D. SymptomRadarCard (detected patterns)
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/cycle/insights', () => {
  test('renders the comparison rows with population context', async ({ page }) => {
    await page.goto('/v2/cycle/insights')
    await expect(page).toHaveURL(/\/v2\/cycle\/insights$/)
    await expect(page.getByRole('heading', { name: 'Cycle insights' })).toBeVisible()
    // Each insight row carries a "You" and "All cyclers" stat label.
    await expect(page.getByText(/All cyclers/).first()).toBeVisible()
    await expect(page.getByText(/^You$/).first()).toBeVisible()
    // Cycle length insight is always rendered (the metric is
    // always in the registry, even with no user data).
    await expect(page.getByRole('heading', { name: 'Cycle length' })).toBeVisible()
    // The Sources section names the published references.
    await expect(page.getByText(/Bull JR et al./)).toBeVisible()
    await expect(page.getByText(/Lenton EA et al./)).toBeVisible()
  })

  test('back arrow returns to /v2/cycle', async ({ page }) => {
    await page.goto('/v2/cycle/insights')
    await page.getByRole('link', { name: 'Back to cycle' }).click()
    await expect(page).toHaveURL(/\/v2\/cycle$/)
  })

  test('renders the four wave-3 surfaces (chart, multi-cycle, rollup, radar)', async ({
    page,
  }) => {
    const response = await page.goto('/v2/cycle/insights')
    expect(response?.status()).toBeLessThan(400)

    // Feature A: Cycle Insights chart card.
    await expect(page.getByRole('heading', { name: 'Temperature pattern' })).toBeVisible()
    // Either the chart itself or its empty state must be present, never both.
    const chartOrEmpty = page.locator(
      '[data-testid="cycle-insights-chart"], [data-testid="cycle-insights-chart-empty"]',
    )
    await expect(chartOrEmpty.first()).toBeVisible()

    // Feature B: Multi-cycle comparison card.
    await expect(page.getByRole('heading', { name: 'Recent cycles side by side' })).toBeVisible()
    const compareOrEmpty = page.locator(
      '[data-testid="multi-cycle-compare"], [data-testid="multi-cycle-compare-empty"]',
    )
    await expect(compareOrEmpty.first()).toBeVisible()

    // Feature C: Statistics rollup card.
    await expect(page.getByTestId('statistics-rollup')).toBeVisible()
    await expect(page.getByText(/Bull et al\. 2019/).first()).toBeVisible()
    await expect(page.getByText(/Lenton et al\. 1984/).first()).toBeVisible()
    await expect(page.getByText(/Bauman 1981/).first()).toBeVisible()

    // Feature D: Symptom radar card.
    await expect(page.getByTestId('symptom-radar-card')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Symptom radar' })).toBeVisible()
  })
})
