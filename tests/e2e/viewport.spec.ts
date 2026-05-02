/*
 * Viewport overflow guard.
 *
 * Asserts that no v2 surface ever renders wider than the device
 * viewport. This is the regression test for the foundation overflow
 * fix landed in `foundation: fix horizontal overflow across v2`.
 *
 * Why this spec exists: prior to the fix, real medical content (long
 * lab values, PubMed URLs, slash-separated hypothesis names) caused
 * markdown surfaces and hypothesis cards to widen past the viewport
 * on a 390pt iPhone, clipping text on the left and right edges of
 * chat, doctor, and cycle screens.
 *
 * What the spec checks: for each route below, the document scroll
 * width must not exceed the window inner width by more than 1px (the
 * 1px slack absorbs sub-pixel rounding on some browsers). When it
 * does fail, the spec walks the DOM to surface the offending
 * elements so the next failure has actionable diagnostics.
 *
 * Both the WebKit (iPhone 13 Pro) and mobile Chromium (Pixel 7)
 * Playwright projects from `playwright.config.ts` exercise this spec
 * because rendering quirks differ between iOS Safari (the production
 * Capacitor WebView) and Chromium.
 */
import { expect, test, type Page } from '@playwright/test'

// Hardcoded list of routes drawn from the 2026-04-29 app tour
// recording plus the major v2 surfaces a user reaches in the first
// minute. Each route is a server-rendered v2 page; we are not
// asserting the response body, only that the layout fits the viewport
// after the page has settled.
const ROUTES: readonly string[] = [
  '/v2',
  '/v2/chat',
  '/v2/cycle',
  '/v2/cycle/insights',
  '/v2/cycle/log',
  '/v2/cycle/history',
  '/v2/calories',
  '/v2/doctor',
  '/v2/log',
  '/v2/today',
  '/v2/sleep',
  '/v2/timeline',
  '/v2/settings',
  '/v2/login',
  '/v2/signup',
  '/v2/forgot-password',
  '/v2/learn',
  '/v2/records',
  '/v2/labs',
  '/v2/imaging',
  '/v2/import',
  '/v2/topics',
  '/v2/patterns',
  '/v2/demo',
]

interface Offender {
  tag: string
  cls: string
  scrollWidth: number
  clientWidth: number
  text: string
}

async function findOverflowOffenders(page: Page): Promise<{
  doc: number
  win: number
  offenders: Offender[]
}> {
  return page.evaluate(() => {
    const doc = document.documentElement.scrollWidth
    const win = window.innerWidth
    const offenders = Array.from(document.querySelectorAll<HTMLElement>('*'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      // Screen-reader-only utilities are intentionally larger than
      // their 1px clip box and never visible to the user.
      .filter((el) => !el.matches('.sr-only, .sr-only *'))
      .slice(0, 10)
      .map((el) => ({
        tag: el.tagName,
        cls:
          typeof el.className === 'string'
            ? el.className.slice(0, 80)
            : '',
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        text: (el.textContent ?? '').slice(0, 80),
      }))
    return { doc, win, offenders }
  })
}

test.describe('viewport overflow guard', () => {
  // Long-tail v2 pages can take a beat in dev mode while the Next.js
  // JIT compiles the route for the first time. The default 30s
  // navigation timeout from playwright.config.ts is tight for cold
  // routes like /v2/labs and /v2/imaging; bump per-test budget so a
  // slow first compile does not flake the spec.
  test.setTimeout(120_000)

  test('document never bounces (overscroll-behavior: none on html and body)', async ({
    page,
  }) => {
    // The iOS WebKit / Capacitor WebView rubber-band bounce is killed
    // at the document root by globals.css. If a future change unsets
    // this, scrolling past the top or bottom will spring back with
    // the elastic bounce that makes the app feel webby. Assert the
    // computed style on a single canonical route.
    await page.goto('/v2', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    const overscroll = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overscrollBehaviorY,
      body: getComputedStyle(document.body).overscrollBehaviorY,
    }))
    expect(overscroll.html).toBe('none')
    expect(overscroll.body).toBe('none')
  })

  for (const route of ROUTES) {
    test(`${route} fits the viewport at load`, async ({ page }) => {
      // We wait for `domcontentloaded` rather than `networkidle` so
      // background SSE / polling does not stall the test, and bump
      // the navigation budget for cold dev-mode JIT compiles.
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90_000 })

      // Give layout a tick to settle after fonts load and any
      // useEffect-driven measurements run. The poll assertion below
      // is the actual guard; this is just to give a settled snapshot
      // for the diagnostic dump on failure.
      await page.waitForTimeout(500)

      // The actual contract: document never exceeds the viewport.
      // Polled because hydration can briefly widen content while
      // images / fonts settle on slower CI.
      await expect
        .poll(
          async () =>
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <=
                window.innerWidth + 1,
            ),
          { timeout: 5000 },
        )
        .toBe(true)

      // If the assertion above passed but inner offenders remain
      // (for example: a runaway flex child that <main>'s overflow-x
      // hidden silently clips), report them as a soft failure so the
      // foundation fix authors see them in CI logs without blocking
      // the merge. This is the early-warning channel.
      const { doc, win, offenders } = await findOverflowOffenders(page)
      if (offenders.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[viewport] ${route}: doc=${doc} win=${win}, ${offenders.length} inner offender(s):\n` +
            offenders
              .map(
                (o, i) =>
                  `  ${i + 1}. <${o.tag.toLowerCase()}> sw=${o.scrollWidth} cw=${o.clientWidth} cls="${o.cls}" text="${o.text}"`,
              )
              .join('\n'),
        )
      }
    })
  }
})
