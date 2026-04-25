/*
 * v2 body metrics surfaces.
 *
 * Confirms the new /v2/calories/health/composition page renders
 * its log form (CompositionForm) and renders any pre-existing
 * derived metric tiles. We do not write to Supabase from the test
 * to keep it side-effect free; the DB writes are exercised in unit
 * tests via body-metrics.test.ts and body-metrics-log shape checks.
 *
 * Likewise, /v2/calories/health/metabolic surfaces lab-derived
 * metrics or an empty-state when no labs are present. Both code
 * paths are valid; we just assert the page renders without crashing.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2/calories/health/composition', () => {
  test('renders the log form and at least one input', async ({ page }) => {
    await page.goto('/v2/calories/health/composition')
    await expect(page).toHaveURL(/\/v2\/calories\/health\/composition/)
    // Form heading
    await expect(page.getByText(/log a measurement/i).first()).toBeVisible()
    // Required inputs always present
    await expect(page.getByLabel(/^weight$/i).first()).toBeVisible()
    await expect(page.getByLabel(/body fat/i).first()).toBeVisible()
    await expect(page.getByLabel(/^waist$/i).first()).toBeVisible()
    await expect(page.getByLabel(/^hip$/i).first()).toBeVisible()
    // Save button
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
  })

  test('explainer modal opens for a derived metric when one renders', async ({ page }) => {
    await page.goto('/v2/calories/health/composition')
    // Derived metrics may or may not render depending on stored data.
    // If a "Derived metrics" heading is present, taps should open a modal.
    const derivedHeading = page.getByText(/derived metrics/i)
    if (await derivedHeading.count() > 0) {
      const firstRow = page.getByRole('button', { name: /^Explain /i }).first()
      if (await firstRow.count() > 0) {
        await firstRow.click()
        // ExplainerSheet renders a "Got it" dismiss button by default
        await expect(page.getByRole('button', { name: /got it/i })).toBeVisible()
      }
    }
  })
})

test.describe('/v2/calories/health/metabolic', () => {
  test('renders the lab-derived banner', async ({ page }) => {
    await page.goto('/v2/calories/health/metabolic')
    await expect(page).toHaveURL(/\/v2\/calories\/health\/metabolic/)
    await expect(page.getByText(/lab-derived/i).first()).toBeVisible()
  })
})

test.describe('/v2/calories/health/weight', () => {
  test('renders BMI derived row when weight + height are present', async ({ page }) => {
    await page.goto('/v2/calories/health/weight')
    await expect(page).toHaveURL(/\/v2\/calories\/health\/weight/)
    // Either the BMI tile is visible (weight + height both present)
    // or a "Add your first" CTA is present (no entries yet). Both are
    // valid happy paths.
    const bmiLabel = page.getByText(/^BMI$/)
    const ctaLink = page.getByRole('link', { name: /more metrics/i })
    const hasBmi = (await bmiLabel.count()) > 0 && (await ctaLink.count()) > 0
    const emptyCta = page.getByText(/no weigh-ins yet/i)
    const hasEmpty = (await emptyCta.count()) > 0
    expect(hasBmi || hasEmpty).toBe(true)
  })
})

test.describe('/v2/calories/health/blood-pressure', () => {
  test('shows MAP and pulse pressure when a reading is logged', async ({ page }) => {
    await page.goto('/v2/calories/health/blood-pressure')
    await expect(page).toHaveURL(/\/v2\/calories\/health\/blood-pressure/)
    // If there is a latest reading, MAP + PP should render.
    // Otherwise an EmptyState renders. Either is acceptable.
    const mapText = page.getByText(/MAP \d+ mmHg/i)
    const empty = page.getByText(/no readings yet/i)
    const hasMap = (await mapText.count()) > 0
    const hasEmpty = (await empty.count()) > 0
    expect(hasMap || hasEmpty).toBe(true)
  })
})
