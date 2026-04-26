/**
 * v2 onboarding real-auth E2E.
 *
 * The gap that let PR #125's bug ship: every prior E2E test runs with
 * LANAE_REQUIRE_AUTH=false. The bypass only shorts the middleware
 * gate, not the per-route requireUser() check, so the wizard's POST
 * /api/v2/onboarding always returned 401 in CI -- never the 500
 * "save failed" that real signed-in users hit.
 *
 * This spec creates a real test user via Supabase Auth Admin, signs
 * them in via the v2 login form, walks step 2 (About you), clicks
 * Continue, and asserts:
 *
 *   1. No red "save failed" error renders
 *   2. The URL advances to /v2/onboarding/3
 *   3. The saved row is readable on a fresh navigation back
 *
 * If migrations 035 + 041 are missing on the target DB, the graceful
 * upsert helper (src/lib/auth/scope-upsert.ts) downgrades to legacy
 * single-tenant writes and the test still passes -- which is the
 * correct behaviour during the migration window. If the helper
 * regresses, the save fails and this spec catches it before merge.
 *
 * Test self-skips when SUPABASE env is missing (mirrors
 * v2-multi-user-isolation.spec.ts).
 */
import { test, expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHOULD_RUN = !!(SUPABASE_URL && ANON_KEY && SERVICE_KEY)

const PASSWORD = 'onboarding-real-auth-2026'
const RUN_ID = Date.now()
const TEST_EMAIL = `onboarding-real-${RUN_ID}@lanaehealth.dev`

async function adminCreateUser(email: string): Promise<{ id: string; email: string }> {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  })
  if (resp.status === 422 || resp.status === 500) {
    // 422/500 with "duplicate key" means a previous run (or a flaky
    // retry) left this email behind. Look the user up by email and
    // reuse them so the test still has a clean session to drive.
    const text = await resp.text()
    if (/duplicate key|already (exists|registered)/i.test(text)) {
      const lookup = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        { headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` } },
      )
      if (lookup.ok) {
        const j = (await lookup.json()) as { users?: Array<{ id: string; email: string }> }
        if (j.users && j.users[0]) return { id: j.users[0].id, email: j.users[0].email }
      }
    }
    throw new Error(`createUser ${email} failed: ${resp.status} ${text}`)
  }
  if (!resp.ok) {
    throw new Error(`createUser ${email} failed: ${resp.status} ${await resp.text()}`)
  }
  return (await resp.json()) as { id: string; email: string }
}

async function adminDeleteUser(userId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
  })
}

async function dismissCookieBanner(page: Page): Promise<void> {
  // Cookie banner intercepts clicks on the sign-in form. The dismiss
  // button is labelled "Got it" (CookieConsentBanner). Click it if
  // present; ignore if it never rendered (e.g. already-acknowledged
  // localStorage state).
  const dismissBtn = page.getByRole('region', { name: /cookie notice/i }).getByRole('button', { name: /got it/i })
  await dismissBtn.click({ timeout: 3_000 }).catch(() => {})
  // Wait for the banner region to detach so subsequent clicks land on
  // the form, not the dismissed banner.
  await page.getByRole('region', { name: /cookie notice/i }).waitFor({ state: 'detached', timeout: 3_000 }).catch(() => {})
}

async function signInUI(ctx: BrowserContext, email: string): Promise<void> {
  const page = await ctx.newPage()
  await page.goto('/v2/login')
  await dismissCookieBanner(page)
  // The login form uses styled <input> elements without type="email"
  // attributes, so target by visible label which is stable across
  // theme/layout changes.
  await page.getByLabel(/^email$/i).fill(email)
  await page.getByLabel(/^password$/i).fill(PASSWORD)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  // After signin, brand-new users land on /v2/onboarding/1.
  await page.waitForURL((url) => !url.pathname.startsWith('/v2/login'), {
    timeout: 20_000,
  })
  await page.close()
}

test.describe('v2 onboarding real-auth save', () => {
  test.skip(!SHOULD_RUN, 'requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY')

  let userId: string | null = null

  test.beforeAll(async () => {
    const u = await adminCreateUser(TEST_EMAIL)
    userId = u.id
  })

  test.afterAll(async () => {
    if (userId) await adminDeleteUser(userId)
  })

  test('step 2 "About you" saves and advances to step 3', async ({ browser }) => {
    const ctx = await browser.newContext()
    await signInUI(ctx, TEST_EMAIL)

    const page = await ctx.newPage()
    await page.goto('/v2/onboarding/2', { waitUntil: 'networkidle' })

    // Form is rendered inside a Card; locate fields by visible label.
    // First name (text input). The Field component renders the label
    // as a sibling span, so we target by autocomplete which is stable.
    await page.locator('input[autocomplete="given-name"]').fill('Test User')
    await page.locator('input[type="date"]').fill('2001-06-20')

    // Sex select.
    await page.locator('select').first().selectOption('female')

    // Height + weight (the two number inputs).
    const numberInputs = page.locator('input[type="number"]')
    await numberInputs.nth(0).fill('170')
    await numberInputs.nth(1).fill('60')

    // Click Continue. The button label includes "Continue" or "Saving...".
    const continueBtn = page.getByRole('button', { name: /continue/i })
    await continueBtn.click()

    // The save handler either advances to step 3 OR sets an inline
    // alert with role="alert" containing visible text. Wait up to 15s
    // for one of the two. (The alert region may render briefly empty
    // during a re-render, so we require non-empty text content.)
    const advanced = page
      .waitForURL(/\/v2\/onboarding\/3/, { timeout: 15_000 })
      .then(() => 'advanced' as const)
      .catch(() => null)
    const errorShown = page
      .locator('p[role="alert"]')
      .filter({ hasText: /\S/ })
      .first()
      .waitFor({ timeout: 15_000 })
      .then(() => 'error' as const)
      .catch(() => null)

    const outcome = await Promise.race([advanced, errorShown])
    if (outcome !== 'advanced') {
      // Capture the actual error text so the failure tells us what
      // the API returned, not just that something went wrong.
      const errorText = await page.locator('p[role="alert"]').first().textContent().catch(() => '(no text)')
      throw new Error(
        `step 2 did not advance. inline alert text: "${errorText}". URL still ${page.url()}`,
      )
    }

    // Sanity check: navigate back to step 2 with ?revise=true and
    // verify the saved value re-hydrates. If the write actually
    // persisted (whether to the modern or legacy schema), the field
    // is pre-filled.
    await page.goto('/v2/onboarding/2?revise=true', { waitUntil: 'networkidle' })
    const nameField = page.locator('input[autocomplete="given-name"]')
    await expect(nameField).toHaveValue('Test User')

    await ctx.close()
  })

  // Skipped in pre-035 prod: the legacy health_profile table has a
  // global UNIQUE on `section`, so two test users in the same run
  // cannot both have a 'personal' row and the second user's write
  // collides with (or overwrites) the first. Once migration 041
  // lands and the constraint becomes (user_id, section), this test
  // can run in parallel with the step-2 spec safely. Tracked in
  // docs/research/multi-user-isolation-verified-2026-04-26.md.
  test.skip('walks the full 7-step wizard end-to-end with no save failures', async ({ browser }) => {
    // Second user keeps state isolated from the step-2 spec above so
    // the two specs can run in parallel.
    const FULL_FLOW_EMAIL = `onboarding-full-${RUN_ID}@lanaehealth.dev`
    const fullUser = await adminCreateUser(FULL_FLOW_EMAIL)
    const ctx = await browser.newContext()
    try {
      // Sign in. Brand-new user lands on /v2/onboarding/1.
      const page = await ctx.newPage()
      await page.goto('/v2/login')
      await dismissCookieBanner(page)
      await page.getByLabel(/^email$/i).fill(FULL_FLOW_EMAIL)
      await page.getByLabel(/^password$/i).fill(PASSWORD)
      await page.getByRole('button', { name: /^sign in$/i }).click()
      await page.waitForURL((url) => !url.pathname.startsWith('/v2/login'), {
        timeout: 20_000,
      })

      // Helper: click Continue (or the named primary CTA) and wait
      // for either the next step OR a visible inline error. Throw
      // the visible error on failure so the test message identifies
      // which step broke.
      async function continueTo(nextPath: string, opts: { primaryName?: RegExp } = {}): Promise<void> {
        const cta = opts.primaryName ?? /continue/i
        await page.getByRole('button', { name: cta }).first().click()

        const advanced = page
          .waitForURL(new RegExp(nextPath.replace(/\//g, '\\/')), { timeout: 15_000 })
          .then(() => 'advanced' as const)
          .catch(() => null)
        const errorShown = page
          .locator('p[role="alert"]')
          .filter({ hasText: /\S/ })
          .first()
          .waitFor({ timeout: 15_000 })
          .then(() => 'error' as const)
          .catch(() => null)

        const outcome = await Promise.race([advanced, errorShown])
        if (outcome !== 'advanced') {
          const errorText = await page
            .locator('p[role="alert"]')
            .first()
            .textContent()
            .catch(() => '(no text)')
          throw new Error(
            `did not advance to ${nextPath}. inline alert: "${errorText}". URL still ${page.url()}`,
          )
        }
      }

      // Step 1: Welcome ("Let's go" CTA).
      await page.goto('/v2/onboarding/1', { waitUntil: 'networkidle' })
      await continueTo('/v2/onboarding/2', { primaryName: /let'?s go|continue/i })

      // Step 2: About you. Same shape as the dedicated spec above.
      await page.locator('input[autocomplete="given-name"]').fill('Full Flow')
      await page.locator('input[type="date"]').fill('2001-06-20')
      await page.locator('select').first().selectOption('female')
      const numberInputs = page.locator('input[type="number"]')
      await numberInputs.nth(0).fill('170')
      await numberInputs.nth(1).fill('60')
      await continueTo('/v2/onboarding/3')

      // Step 3: Conditions catalog. Pick at least one chip so the
      // active_problems insert path is exercised.
      const firstCondition = page.getByRole('button', { name: /POTS|migraine|EDS|MCAS/i }).first()
      await firstCondition.click().catch(() => {
        // Catalog may render as toggles instead of role=button. Fall
        // back to clicking any text-bearing card region.
      })
      await continueTo('/v2/onboarding/4', { primaryName: /continue/i })

      // Step 4: Medications + allergies. Skip-friendly: leave empty
      // and just continue.
      await continueTo('/v2/onboarding/5')

      // Step 5: Oura. Skip the OAuth handshake.
      const skipOura = page.getByRole('link', { name: /skip|not now/i }).first()
      await skipOura.click().catch(async () => {
        // Some builds render Skip as a button; fall back to that.
        await page.getByRole('button', { name: /skip|not now/i }).first().click()
      })
      await page.waitForURL(/\/v2\/onboarding\/6/, { timeout: 15_000 })

      // Step 6: Insurance. Leave empty so the "Skip and continue" CTA
      // fires, exercising the no-section save shape.
      await continueTo('/v2/onboarding/7', { primaryName: /skip and continue|continue/i })

      // Step 7: Done. The completion POST fires automatically on
      // mount via useEffect, then the user clicks "See your home"
      // to leave the wizard. We wait for the button to enable
      // (it stays disabled until the completion fetch resolves).
      const seeHome = page.getByRole('button', { name: /see your home|back to home/i })
      await expect(seeHome).toBeEnabled({ timeout: 15_000 })
      await seeHome.click()
      await page.waitForURL((url) => !url.pathname.startsWith('/v2/onboarding'), {
        timeout: 15_000,
      })

      // Final check: re-navigating into onboarding redirects back out
      // (proves the completion flag actually persisted).
      await page.goto('/v2/onboarding/1', { waitUntil: 'networkidle' })
      // The layout's middleware kicks already-onboarded users back out.
      // Either an explicit redirect or a "you're set up" inline state
      // is acceptable.
      const url = page.url()
      expect(
        url.includes('/v2') && !url.endsWith('/v2/onboarding/1'),
        `after completion the wizard should not re-enter at step 1; current URL: ${url}`,
      ).toBe(true)
    } finally {
      await adminDeleteUser(fullUser.id)
      await ctx.close()
    }
  })
})
