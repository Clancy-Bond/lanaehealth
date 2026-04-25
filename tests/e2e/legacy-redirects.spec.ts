import { test, expect } from '@playwright/test'

// Legacy → v2 unified cutover: every shipped section now redirects to its
// v2 counterpart. /doctor and /topics/{migraine,nutrition} are intentionally
// NOT redirected (held for parity gates). Source: next.config.ts redirects().

const cutoverRoutes: Array<{ from: string; to: string }> = [
  { from: '/cycle', to: '/v2/cycle' },
  { from: '/cycle/log', to: '/v2/cycle/log' },
  { from: '/cycle/history', to: '/v2/cycle/history' },
  { from: '/cycle/predict', to: '/v2/cycle/predict' },
  { from: '/calories', to: '/v2/calories' },
  { from: '/calories/food', to: '/v2/calories/food' },
  { from: '/calories/photo', to: '/v2/calories/photo' },
  { from: '/log', to: '/v2/log' },
  { from: '/sleep', to: '/v2/sleep' },
  { from: '/today', to: '/v2/today' },
  { from: '/records', to: '/v2/records' },
  { from: '/labs', to: '/v2/labs' },
  { from: '/imaging', to: '/v2/imaging' },
  { from: '/topics/cycle', to: '/v2/topics/cycle' },
  { from: '/topics/orthostatic', to: '/v2/topics/orthostatic' },
  { from: '/settings', to: '/v2/settings' },
  { from: '/import', to: '/v2/import' },
  { from: '/import/myah', to: '/v2/import/myah' },
  { from: '/patterns', to: '/v2/patterns' },
  { from: '/patterns/cycle', to: '/v2/patterns/cycle' },
  { from: '/patterns/calories', to: '/v2/patterns/calories' },
  { from: '/patterns/symptoms', to: '/v2/patterns/symptoms' },
  { from: '/chat', to: '/v2/chat' },
]

for (const { from, to } of cutoverRoutes) {
  test(`legacy ${from} redirects to ${to}`, async ({ page }) => {
    await page.goto(from)
    // The destination may further redirect (e.g. unauthed → /v2/login),
    // but the URL must at minimum leave the legacy path. We assert it
    // contains the v2 destination prefix or the v2 login flow.
    const url = page.url()
    const target = new URL(to, url).pathname
    expect(url.includes(target) || url.includes('/v2/login')).toBeTruthy()
  })
}

// Routes that must remain reachable on legacy (no redirect).
const heldRoutes = ['/doctor', '/topics/migraine', '/topics/nutrition']
for (const route of heldRoutes) {
  test(`legacy ${route} is NOT redirected to v2`, async ({ page }) => {
    await page.goto(route)
    // Must not have been bounced to /v2/<route>; auth bounce to /login is OK.
    const url = page.url()
    expect(url.includes(`/v2${route}`)).toBeFalsy()
  })
}
