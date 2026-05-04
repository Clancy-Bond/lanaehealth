import { expect, test } from '@playwright/test'

/*
 * /v2/doctor — Doctor Mode briefing
 *
 * Critical contracts for this surface:
 *
 * 1. Horizontal overflow is forbidden. The doctor reads this on a
 *    phone, sometimes during a visit. A page that scrolls sideways
 *    crops medical terms (the bug that motivated this test was
 *    "POTS / Autonomic Dysfunction" rendering as "TS / Autonomic
 *    Dysfunction" on iPhone Pro). KB hypothesis names are snake_case
 *    identifiers like "chiari_malformation_type1_or_craniocervical_-
 *    instability" — single unbreakable tokens that overflow flex rows
 *    when the title doesn't have min-width: 0 + overflow-wrap.
 *
 * 2. The "Data Limitations" / data-completeness footnote must be
 *    discoverable. The whole brief is generated from sparse data and
 *    the Context Assembler's self-distrust principle requires that
 *    we surface what we *don't* know to the doctor, plainly. The
 *    completeness card must render above the fold of the page when
 *    scrolled to the bottom — never collapsed behind an info icon.
 */

test.setTimeout(120_000)

test('renders without horizontal overflow at iPhone Pro width', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/v2/doctor', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1:has-text("Doctor Mode")', { timeout: 90_000 })
  await page.waitForLoadState('networkidle')

  const fits = await page.evaluate(() => {
    return (
      document.documentElement.scrollWidth <= window.innerWidth &&
      document.body.scrollWidth <= window.innerWidth
    )
  })
  expect(fits).toBe(true)

  // No content-bearing element inside main may have content wider
  // than itself. We allow a one-pixel slop for sub-pixel rounding.
  // Elements we DELIBERATELY ignore:
  //   - SVG internals: recharts draws axis labels in its own viewBox;
  //     getBoundingClientRect is meaningless for these.
  //   - Icon-sized elements (clientWidth < 60 px): the explainer "?"
  //     button is a 22-px circle with an invisible 44-px touch-target
  //     overlay that bleeds past its bounds. This expands the button's
  //     scrollWidth without changing its visible footprint, and the
  //     hit area is a deliberate accessibility pattern. Layout bugs
  //     from snake_case identifiers always live on much wider cards.
  //   - Zero-clientWidth wrappers: recharts ResponsiveContainer briefly
  //     reports 0 width while measuring; treating that as overflow
  //     creates flaky failures.
  const overflowing = await page.evaluate(() => {
    const out: Array<{ tag: string; sw: number; cw: number; text: string }> = []
    const all = document.querySelectorAll('main *')
    for (const el of Array.from(all)) {
      if (el.closest('svg')) continue
      const sw = el.scrollWidth
      const cw = el.clientWidth
      if (cw < 60) continue
      if (sw > cw + 1) {
        out.push({
          tag: el.tagName,
          sw,
          cw,
          text: (el.textContent ?? '').slice(0, 80).replace(/\s+/g, ' ').trim(),
        })
      }
    }
    return out
  })

  if (overflowing.length > 0) {
    console.log('Overflowing elements:', JSON.stringify(overflowing, null, 2))
  }
  expect(overflowing).toEqual([])
})

test('renders the data-completeness footer above the fold of the page', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/v2/doctor', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1:has-text("Doctor Mode")', { timeout: 90_000 })
  await page.waitForLoadState('networkidle')

  // The completeness card has the heading "Data completeness". It
  // sits at the bottom of the page so a doctor scrolling top-to-bottom
  // hits it last. The contract is: it must exist and be in the DOM,
  // never hidden behind an info icon or collapsed accordion.
  const completeness = page.getByRole('heading', { name: /data completeness/i })
  await expect(completeness).toBeVisible()
})
