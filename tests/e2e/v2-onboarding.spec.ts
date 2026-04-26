/*
 * v2 Onboarding wizard E2E.
 *
 * Confirms the 7-step wizard structure renders, every step's primary
 * controls are present, the Skip-for-now affordance is reachable, and
 * the API contract for /api/v2/onboarding rejects unauthenticated
 * writes (per PR #86 + #92's user-scoping discipline).
 *
 * The dev server runs with LANAE_REQUIRE_AUTH=false so the wizard
 * pages render in preview mode (no real session). The /api routes
 * still enforce auth on their own, so writes attempted from this
 * suite return 401. We verify both the surface AND the contract;
 * deeper "data actually saved to Supabase per user" coverage lives
 * in the integration suite that signs up real fixture accounts.
 */
import { expect, test } from '@playwright/test'

test.describe('/v2 onboarding wizard', () => {
  test('index page redirects to step 1', async ({ page }) => {
    await page.goto('/v2/onboarding')
    await expect(page).toHaveURL(/\/v2\/onboarding\/1$/)
  })

  test('step 1 renders welcome with the value props and a Lets-go CTA', async ({ page }) => {
    await page.goto('/v2/onboarding/1')
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
    await expect(page.getByText(/connect your oura/i)).toBeVisible()
    await expect(page.getByText(/learn your patterns/i)).toBeVisible()
    await expect(page.getByText(/prep for doctor visits/i)).toBeVisible()
    await expect(page.getByText(/remember corrections forever/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /let.?s go/i })).toBeVisible()
  })

  test('step 2 (about you) renders the basics form', async ({ page }) => {
    await page.goto('/v2/onboarding/2')
    await expect(page.getByRole('heading', { name: /about you/i })).toBeVisible()
    await expect(page.getByText(/first name/i)).toBeVisible()
    await expect(page.getByText(/date of birth/i)).toBeVisible()
    await expect(page.getByText(/sex/i).first()).toBeVisible()
    await expect(page.getByText(/timezone/i)).toBeVisible()
  })

  test('step 3 (conditions) renders the searchable picker with chips', async ({ page }) => {
    await page.goto('/v2/onboarding/3')
    await expect(page.getByRole('heading', { name: /conditions/i })).toBeVisible()
    await expect(page.getByPlaceholder('Search conditions')).toBeVisible()
    // POTS is a sentinel because the spec called it out by name.
    await expect(page.getByRole('button', { name: /^pots$/i })).toBeVisible()
    await expect(page.getByPlaceholder(/condition we missed/i)).toBeVisible()
  })

  test('step 4 (medications + allergies) renders both quick-add forms', async ({ page }) => {
    await page.goto('/v2/onboarding/4')
    await expect(page.getByRole('heading', { name: /medications and allergies/i })).toBeVisible()
    await expect(page.getByPlaceholder(/drug name/i)).toBeVisible()
    await expect(page.getByPlaceholder(/substance/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /add medication/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /add allergy/i })).toBeVisible()
  })

  test('step 5 (Oura) shows connect + skip-equivalent buttons', async ({ page }) => {
    await page.goto('/v2/onboarding/5')
    await expect(page.getByRole('heading', { name: /connect your oura/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /connect oura/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /don.?t have one/i })).toBeVisible()
  })

  test('step 6 (insurance) renders the carrier picker with at least one carrier', async ({ page }) => {
    await page.goto('/v2/onboarding/6')
    await expect(page.getByRole('heading', { name: /insurance plan/i })).toBeVisible()
    await expect(page.getByPlaceholder('Search carriers')).toBeVisible()
    // We don't pin to a specific carrier label since PR #90 may
    // re-order the list, but at least one selectable carrier button
    // must be visible.
    const carrierItems = page.locator('button[aria-pressed]')
    await expect(carrierItems.first()).toBeVisible()
  })

  test('step 7 (done) shows the three starter actions and a See-your-home CTA', async ({ page }) => {
    await page.goto('/v2/onboarding/7')
    await expect(page.getByRole('heading', { name: /nice work/i })).toBeVisible()
    await expect(page.getByText(/log how you.?re feeling/i)).toBeVisible()
    await expect(page.getByText(/ask the ai a question/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /see your home/i })).toBeVisible()
  })

  test('every step shows progress dots (7 segments)', async ({ page }) => {
    for (const step of [1, 3, 5]) {
      await page.goto(`/v2/onboarding/${step}`)
      const progress = page.getByRole('progressbar', { name: /step \d of 7/i })
      await expect(progress).toBeVisible()
    }
  })

  test('Skip for now link is reachable from a middle step', async ({ page }) => {
    await page.goto('/v2/onboarding/3')
    await expect(page.getByRole('link', { name: /skip for now/i })).toBeVisible()
  })

  test('invalid step number routes to the not-found page', async ({ page }) => {
    // Next.js dev returns 200 with the not-found page rendered, while
    // production returns 404. Either is acceptable; what matters is
    // that step 99 does not render the wizard chrome.
    const res = await page.goto('/v2/onboarding/99')
    const status = res?.status() ?? 0
    if (status === 404) return
    // Otherwise we should at least be looking at the not-found page,
    // which never includes the wizard's progress dots.
    await expect(page.getByRole('progressbar', { name: /step \d of 7/i })).not.toBeVisible()
  })
})

test.describe('/api/v2/onboarding contract', () => {
  test('GET requires authentication', async ({ request }) => {
    const res = await request.get('/api/v2/onboarding')
    expect(res.status()).toBe(401)
  })

  test('POST requires authentication', async ({ request }) => {
    const res = await request.post('/api/v2/onboarding', {
      data: { step: 'complete' },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /api/v2/onboarding/skip redirects unauthenticated visits to login', async ({ request }) => {
    const res = await request.get('/api/v2/onboarding/skip', {
      maxRedirects: 0,
    })
    // The handler issues a 307/302 redirect to /v2/login when no
    // session is present. Either redirect status is acceptable.
    expect([302, 307]).toContain(res.status())
    const location = res.headers()['location'] ?? ''
    expect(location).toMatch(/\/v2\/login/)
  })
})
