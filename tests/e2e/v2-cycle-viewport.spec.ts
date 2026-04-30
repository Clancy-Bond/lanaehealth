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
