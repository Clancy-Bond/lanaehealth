/**
 * v2 multi-user isolation E2E.
 *
 * Locks in the productization gate from PR #87 with REAL accounts:
 * a request that resolves a user_id (via Supabase session) must NEVER
 * see PHI from a different user.
 *
 * This spec creates two test users via the Supabase Auth Admin API,
 * signs them in via the v2 login form, then asserts:
 *
 *   1. A brand-new authenticated user with zero PHI does not see
 *      another user's cycle data on /v2/cycle.
 *   2. Two users in separate browser contexts see independent
 *      /v2/calories totals (zero each, no cross-bleed).
 *   3. GET /api/v2/cycle/messages returned to user B contains only
 *      user B's messages (or none).
 *
 * The spec creates the test users in beforeAll and deletes them in
 * afterAll. It needs SUPABASE_SERVICE_ROLE_KEY to call the Auth admin
 * API; without it the spec is skipped.
 *
 * IMPORTANT (2026-04-26): Test #1 (the cycle leak) FAILS today
 * against production-equivalent data because migration 035 (add
 * user_id to PHI tables) has not been applied. See
 * docs/research/multi-user-isolation-verified-2026-04-26.md for the
 * full audit and the steps required to make the spec pass. The spec
 * is intentionally written to fail loudly so the next operator
 * catches the regression before claiming the productization gate is
 * closed.
 */
import { test, expect } from '@playwright/test'
import type { BrowserContext } from '@playwright/test'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHOULD_RUN = !!(SUPABASE_URL && ANON_KEY && SERVICE_KEY)

const PASSWORD = 'isolation-test-2026'
const RUN_ID = Date.now()
const USER_A_EMAIL = `isolation-a-${RUN_ID}@lanaehealth.dev`
const USER_B_EMAIL = `isolation-b-${RUN_ID}@lanaehealth.dev`

interface AuthAdminUser {
  id: string
  email: string
}

async function adminCreateUser(email: string): Promise<AuthAdminUser> {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  })
  if (!resp.ok) {
    throw new Error(`createUser ${email} failed: ${resp.status} ${await resp.text()}`)
  }
  const j = (await resp.json()) as { id: string; email: string }
  return { id: j.id, email: j.email }
}

async function adminDeleteUser(userId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}` },
  })
}

async function signInUI(ctx: BrowserContext, email: string): Promise<void> {
  const page = await ctx.newPage()
  await page.goto('/v2/login')
  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.locator('button[type="submit"]').first().click().catch(() => {
    /* form may auto-submit on Enter */
  })
  // After successful login the app redirects away from /v2/login. We
  // accept any non-login destination including /v2/onboarding/1 for
  // brand-new accounts.
  await page.waitForURL((url) => !url.pathname.startsWith('/v2/login'), {
    timeout: 15_000,
  })
  await page.close()
}

test.describe('multi-user isolation (real accounts)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY',
  )

  let userAId: string | null = null
  let userBId: string | null = null

  test.beforeAll(async () => {
    const a = await adminCreateUser(USER_A_EMAIL)
    const b = await adminCreateUser(USER_B_EMAIL)
    userAId = a.id
    userBId = b.id
  })

  test.afterAll(async () => {
    if (userAId) await adminDeleteUser(userAId)
    if (userBId) await adminDeleteUser(userBId)
  })

  test('a brand-new authenticated user does not see another user cycle data on /v2/cycle', async ({ browser }) => {
    const ctxA = await browser.newContext()
    await signInUI(ctxA, USER_A_EMAIL)
    const page = await ctxA.newPage()
    await page.goto('/v2/cycle', { waitUntil: 'networkidle' })
    const text = (await page.textContent('body')) ?? ''

    // A brand-new user with zero cycle data MUST NOT see another
    // user's cycle classifications. Any of these substrings imply a
    // leak from pre-existing rows:
    //   - "Cycle Day N" with N >= 1 (computed from someone else's
    //     menstruation history)
    //   - "follicular" / "luteal" / "ovulatory" phase chips keyed
    //     off another user's menstruation entries
    //
    // Empty-state copy is the expected, isolated outcome ("Log your
    // first period to see your cycle").
    const leakIndicators = [
      /cycle day \d+/i,
      /\bfollicular\b/i,
      /\bluteal\b/i,
      /\bovulatory\b/i,
    ]
    const matchedLeaks = leakIndicators.filter((re) => re.test(text)).map((re) => re.source)
    expect(
      matchedLeaks,
      `User A (zero PHI) saw cycle data leaked from another user. Matches: ${matchedLeaks.join(', ')}`,
    ).toEqual([])

    await ctxA.close()
  })

  test('two users in separate sessions see independent /v2/calories totals', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    await signInUI(ctxA, USER_A_EMAIL)
    await signInUI(ctxB, USER_B_EMAIL)

    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()
    await pageA.goto('/v2/calories', { waitUntil: 'networkidle' })
    await pageB.goto('/v2/calories', { waitUntil: 'networkidle' })

    const textA = (await pageA.textContent('body')) ?? ''
    const textB = (await pageB.textContent('body')) ?? ''

    // Both brand-new users should see the empty / zero state. If
    // either sees a non-zero subtotal under any meal section, that
    // is the other user's data bleeding through.
    const NONZERO_MEAL = /(breakfast|lunch|dinner|snack)[\s\S]{0,100}?\b\d{2,4}\s*cal\b/i
    expect(
      NONZERO_MEAL.test(textA),
      'User A saw a non-zero meal total despite zero PHI',
    ).toBe(false)
    expect(
      NONZERO_MEAL.test(textB),
      'User B saw a non-zero meal total despite zero PHI',
    ).toBe(false)

    await ctxA.close()
    await ctxB.close()
  })

  test('GET /api/v2/cycle/messages does not leak across users', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    await signInUI(ctxA, USER_A_EMAIL)
    await signInUI(ctxB, USER_B_EMAIL)

    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    // Generate messages as A. Reading as B must return only B's
    // messages (or none).
    await pageA.request.post('/api/v2/cycle/messages')
    const respB = await pageB.request.get('/api/v2/cycle/messages')
    expect(respB.ok(), 'GET /api/v2/cycle/messages should respond OK for B').toBe(true)
    const bodyB = (await respB.json()) as { messages: Array<{ user_id?: string }> }
    if (Array.isArray(bodyB.messages)) {
      for (const m of bodyB.messages) {
        if (m.user_id) {
          expect(m.user_id, 'B saw a message belonging to another user').toBe(userBId)
        }
      }
    }

    await ctxA.close()
    await ctxB.close()
  })

  test('GET /api/chat/history does not return another user payload when unauthenticated', async ({ request }) => {
    // Regression check from PR #87: routes must NOT return the legacy
    // single-tenant payload to an unauthenticated caller. Acceptable
    // outcomes are 401 (correct), 500 (current state: column missing,
    // query fails before any data is returned), or 200 with an empty
    // body. A 200 with another user's messages would be the failure.
    const res = await request.get('/api/chat/history')
    expect([200, 401, 500]).toContain(res.status())
    if (res.status() === 200) {
      const body = (await res.json()) as { messages: unknown[] }
      expect(body.messages?.length ?? 0, 'unauthenticated /api/chat/history must not return another user history').toBe(0)
    }
  })

  test('GET /api/timeline does not return another user payload when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/timeline')
    expect([200, 401, 500]).toContain(res.status())
    if (res.status() === 200) {
      const body = (await res.json()) as { events?: unknown[] }
      expect(body.events?.length ?? 0, 'unauthenticated /api/timeline must not return another user events').toBe(0)
    }
  })
})
