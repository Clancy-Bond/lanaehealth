/*
 * /auth/callback failure-mode coverage.
 *
 * The OAuth callback used to throw past its own error handling when
 * Supabase's exchangeCodeForSession threw (missing PKCE verifier
 * cookie, expired code, etc.) -- 500 with an empty body and no
 * diagnostics. Real users hit this when iOS Safari ITP clears
 * cookies during the provider bounce, or when they reload the URL.
 *
 * These tests assert the callback ALWAYS redirects to /v2/login
 * with a useful ?error= message, never serves a 5xx.
 *
 * No real OAuth flow is exercised; we hit the server directly and
 * inspect the redirect.
 */
import { expect, test } from '@playwright/test'

// Pull the `error` param out of a URL string. Using URLSearchParams
// decodes both `%`-escapes and `+`-as-space, which is what the
// callback uses (URL.searchParams.set encodes spaces as `+`).
function readError(location: string): string {
  const queryIndex = location.indexOf('?')
  if (queryIndex < 0) return ''
  const params = new URLSearchParams(location.slice(queryIndex + 1))
  return params.get('error') ?? ''
}

test.describe('/auth/callback failure modes', () => {
  test('missing code redirects to /v2/login with a friendly error', async ({ request }) => {
    const res = await request.get('/auth/callback', { maxRedirects: 0 })
    expect(res.status()).toBe(307)
    const location = res.headers()['location'] ?? ''
    expect(location).toContain('/v2/login')
    expect(readError(location)).toMatch(/no code returned/i)
  })

  test('invalid code never returns 5xx', async ({ request }) => {
    const res = await request.get('/auth/callback?code=this-is-not-a-real-pkce-code', {
      maxRedirects: 0,
    })
    expect(res.status(), 'should redirect, not 500').toBe(307)
    const location = res.headers()['location'] ?? ''
    expect(location).toContain('/v2/login')
    expect(readError(location).length).toBeGreaterThan(0)
  })

  test('error_description from provider is forwarded into the form', async ({ request }) => {
    const res = await request.get(
      '/auth/callback?error_description=' + encodeURIComponent('access_denied: user cancelled'),
      { maxRedirects: 0 },
    )
    expect(res.status()).toBe(307)
    expect(readError(res.headers()['location'] ?? '')).toBe('access_denied: user cancelled')
  })
})
