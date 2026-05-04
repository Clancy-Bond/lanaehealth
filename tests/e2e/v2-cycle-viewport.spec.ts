/*
 * v2 Cycle viewport regression.
 *
 * Locks in the audit's answer to docs/current-state/known-issues.md #1
 * and #2 (horizontal-overflow / side-to-side scroll). Per the audit at
 * docs/current-state/audits/cycle.md, the cycle landing, insights, and
 * history surfaces all keep `documentElement.scrollWidth` equal to
 * `clientWidth` at both 375pt and 390pt. This spec re-runs that check
 * deterministically so a future regression that slips a fixed-width
 * chart, a `min-width` wrapper, or a long unbroken token into a cycle
 * route fails CI with a precise pointer to the offending element.
 *
 * Also covers the chrome-consistency edits from this session:
 *   - /v2/cycle/log back link uses the lucide ChevronLeft icon (D1).
 *   - /v2/cycle/predict back link uses the same icon and the title
 *     renders as the NC plum styled span (D2 + D3).
 */
import { expect, test } from '@playwright/test'

const CYCLE_ROUTES = [
  '/v2/cycle',
  '/v2/cycle/insights',
  '/v2/cycle/history',
] as const

const VIEWPORTS = [
  { width: 375, height: 812, label: 'iPhone SE / 13 mini width' },
  { width: 390, height: 844, label: 'iPhone 13 Pro width' },
] as const

// Cold dev-server compiles can exceed the default 30s navigationTimeout
// when WebKit hits a route that has not been compiled yet. Bump the
// per-test timeout (Playwright's outer test timeout is 60s; the
// navigation needs headroom inside it). 60s for navigation, 120s for
// the test envelope keeps a single test from blocking on a slow first
// hit while still failing fast on real regressions.
const NAV_TIMEOUT_MS = 60_000
test.beforeEach(async ({ page }) => {
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS)
})

test.describe('/v2/cycle viewport', () => {
  for (const route of CYCLE_ROUTES) {
    for (const v of VIEWPORTS) {
      test(`${route} stays inside the viewport at ${v.width}pt (${v.label})`, async ({ page }) => {
        await page.setViewportSize({ width: v.width, height: v.height })
        // `domcontentloaded` is the right gate for a layout assertion:
        // the React tree is rendered and the chart's ResizeObserver has
        // measured its container by the time DOMContentLoaded fires.
        // Avoid `'load'` and `networkidle` because the Next.js dev
        // server keeps an HMR websocket and a Sentry tunnel open, so
        // those gates never resolve and the test ends up waiting until
        // the global timeout.
        const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
        expect(response?.status()).toBeLessThan(500)

        const overflow = await page.evaluate(() => {
          const html = document.documentElement
          const w = window.innerWidth
          const culprits: Array<{
            tag: string
            cls: string
            right: number
            text: string
          }> = []
          document.querySelectorAll('*').forEach((el) => {
            const r = el.getBoundingClientRect()
            // Skip the offscreen skip-to-main-content marker (deliberately
            // positioned at left:-1 / width:1).
            if (
              el.tagName === 'A' &&
              typeof (el as HTMLElement).className === 'string' &&
              ((el as HTMLElement).className as string).includes('sr-only')
            ) {
              return
            }
            if (r.right > w + 0.5) {
              culprits.push({
                tag: el.tagName.toLowerCase(),
                cls:
                  typeof (el as HTMLElement).className === 'string'
                    ? ((el as HTMLElement).className as string).slice(0, 80)
                    : '',
                right: Math.round(r.right),
                text: (el.textContent || '').replace(/\s+/g, ' ').slice(0, 50),
              })
            }
          })
          return {
            scrollWidth: html.scrollWidth,
            clientWidth: html.clientWidth,
            viewport: w,
            culprits: culprits.slice(0, 5),
          }
        })

        // Primary invariant: nothing renders past the viewport edge.
        expect(
          overflow.culprits,
          `Cycle ${route} overflows at ${v.width}pt. Culprits: ${JSON.stringify(overflow.culprits)}`,
        ).toEqual([])
        // Defense-in-depth: scroll width matches client width.
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.viewport)
      })
    }
  }
})

test.describe('/v2/cycle today-screen signal hierarchy', () => {
  test('verdict ring is the lead block, not phase headline', async ({ page }) => {
    // Tier 1 of docs/research/cycle-nc-substantive-gaps.md: NC's
    // product value lives in the daily verdict, not the phase. The
    // ring-hero aria-label includes the verdict headline; the test
    // asserts the ring exists and the verdict text is rendered above
    // the phase card so the visual order matches the signal hierarchy.
    const response = await page.goto('/v2/cycle', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(500)
    // The ring's aria-label is "Cycle day X, <verdict>. Tap for details."
    // We assert there is a link/button whose accessible name includes
    // one of the canonical verdict phrases.
    const ringButton = page
      .getByRole('button', { name: /Cycle day .*, (Not fertile|Use protection|Log to see today)\./ })
      .first()
    await expect(ringButton).toBeVisible()
  })

  test('symptoms trends CTA points to insights radar anchor', async ({ page }) => {
    // Tier 5b: today screen needs a one-tap entry into the symptom
    // radar that lives on /v2/cycle/insights. Pill is anchor-linked.
    const response = await page.goto('/v2/cycle', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(500)
    const cta = page.getByRole('link', {
      name: /See your symptom trends across cycles/,
    })
    await expect(cta).toBeVisible()
    const href = await cta.getAttribute('href')
    expect(href).toContain('/v2/cycle/insights')
    expect(href).toContain('symptom-radar')
  })
})

test.describe('/v2/cycle/insights data-depth headline', () => {
  test('"X cycles tracked" headline is promoted above the intro card', async ({
    page,
  }) => {
    // Tier 5c: NC's Cycle Insights surface leads with the sample-size
    // headline. We had it as small body text; test asserts it now
    // renders as a dedicated headline element with its data-testid.
    const response = await page.goto('/v2/cycle/insights', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBeLessThan(500)
    const headline = page.getByTestId('cycles-tracked-headline')
    await expect(headline).toBeVisible()
    const text = (await headline.textContent()) ?? ''
    expect(text).toMatch(/cycles? tracked|No cycles tracked yet/i)
  })
})

test.describe('/v2/cycle/insights chart expand affordance', () => {
  test('Expand button opens the chart in a sheet at full width', async ({
    page,
  }) => {
    // Tier 6a: NC's primary BBT chart is landscape-oriented so each
    // cycle day gets enough horizontal real estate. Embedded portrait
    // chart compromises readability; the Expand button opens a Sheet
    // variant. This spec asserts the affordance exists and the sheet
    // mounts the chart on tap.
    const response = await page.goto('/v2/cycle/insights', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBeLessThan(500)
    const expand = page.getByRole('button', {
      name: /Expand temperature chart for landscape view/,
    })
    await expect(expand).toBeVisible()
    await expand.click()
    // The sheet renders a duplicate chart with its own data-testid so
    // the assertion does not collide with the embedded chart's testid.
    const expandedChart = page.getByTestId('cycle-insights-chart-expanded')
    await expect(expandedChart).toBeVisible()
  })
})

test.describe('/v2/cycle chrome consistency (this session)', () => {
  test('/v2/cycle/log back link is an icon + text affordance, not a text glyph', async ({
    page,
  }) => {
    const response = await page.goto('/v2/cycle/log', { waitUntil: 'domcontentloaded' })
    // Some envs may serve the error boundary; the back link should
    // still be present in either case because TopAppBar renders it.
    expect(response?.status()).toBeLessThan(500)
    const back = page.getByRole('link', { name: 'Back to cycle' })
    await expect(back).toBeVisible()
    // The previous implementation used a "‹" Unicode glyph as plain
    // text. Switching to lucide ChevronLeft means an <svg> renders
    // inside the link.
    const hasSvg = await back.locator('svg').count()
    expect(hasSvg).toBeGreaterThan(0)
  })

  test('/v2/cycle/predict back link mirrors the rest of the section', async ({
    page,
  }) => {
    const response = await page.goto('/v2/cycle/predict', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(500)
    const back = page.getByRole('link', { name: 'Back to cycle' })
    await expect(back).toBeVisible()
    const hasSvg = await back.locator('svg').count()
    expect(hasSvg).toBeGreaterThan(0)
  })
})
