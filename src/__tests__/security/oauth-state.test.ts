/**
 * Track C - C-003 regression test.
 *
 * OAuth callbacks must reject any request whose query-parameter `state`
 * does not match the signed cookie the authorize step set. Applies to:
 *   - `/api/oura/callback`
 *   - `/api/integrations/[integrationId]/callback`
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

beforeEach(() => {
  process.env.OURA_CLIENT_ID = 'test-oura-id'
  process.env.OURA_REDIRECT_URI = 'https://example.test/api/oura/callback'
  process.env.OURA_CLIENT_SECRET = 'test-oura-secret'
})

afterEach(() => {
  delete process.env.OURA_CLIENT_ID
  delete process.env.OURA_REDIRECT_URI
  delete process.env.OURA_CLIENT_SECRET
  vi.restoreAllMocks()
})

vi.mock('@/lib/oura', () => ({
  exchangeCodeForTokens: vi.fn(async () => ({
    access_token: 'a',
    refresh_token: 'r',
    expires_in: 3600,
    token_type: 'Bearer',
  })),
  storeTokens: vi.fn(async () => {}),
}))

vi.mock('@/lib/integrations/hub', () => ({
  getConnector: (id: string) => ({
    name: id,
    exchangeCode: vi.fn(async () => ({ access_token: 'a' })),
  }),
  saveToken: vi.fn(async () => {}),
}))

function nextReq(url: string, cookieHeader?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookieHeader) headers.cookie = cookieHeader
  return new NextRequest(url, { headers })
}

describe('oura callback state check', () => {
  it('redirects with state_mismatch when no state cookie is present', async () => {
    const { GET } = await import('@/app/api/oura/callback/route')
    const res = await GET(nextReq('https://example.test/api/oura/callback?code=c&state=qs-state'))
    expect(res.headers.get('location')).toMatch(/oura_error=state_mismatch/)
  })

  it('redirects with state_mismatch when query state does not match cookie', async () => {
    const { GET } = await import('@/app/api/oura/callback/route')
    const res = await GET(nextReq(
      'https://example.test/api/oura/callback?code=c&state=attacker-state',
      'oura_oauth_state=real-state',
    ))
    expect(res.headers.get('location')).toMatch(/oura_error=state_mismatch/)
  })

  it('accepts matching state', async () => {
    const { GET } = await import('@/app/api/oura/callback/route')
    const matchingState = 'matching-state-xyz'
    const res = await GET(nextReq(
      `https://example.test/api/oura/callback?code=c&state=${matchingState}`,
      `oura_oauth_state=${matchingState}`,
    ))
    expect(res.headers.get('location')).toMatch(/oura_connected=true/)
  })
})

describe('integration callback state check', () => {
  it('redirects on state_mismatch when no cookie is present', async () => {
    const { GET } = await import('@/app/api/integrations/[integrationId]/callback/route')
    const res = await GET(
      nextReq('https://example.test/api/integrations/myah/callback?code=c&state=qs'),
      { params: Promise.resolve({ integrationId: 'myah' }) },
    )
    expect(res.headers.get('location')).toMatch(/error=state_mismatch/)
  })

  it('redirects on state_mismatch when query state differs from cookie', async () => {
    const { GET } = await import('@/app/api/integrations/[integrationId]/callback/route')
    const res = await GET(
      nextReq(
        'https://example.test/api/integrations/myah/callback?code=c&state=attacker',
        'oauth_state_myah=real',
      ),
      { params: Promise.resolve({ integrationId: 'myah' }) },
    )
    expect(res.headers.get('location')).toMatch(/error=state_mismatch/)
  })
})
