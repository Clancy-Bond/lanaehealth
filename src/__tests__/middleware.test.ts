// Regression tests for the perimeter middleware.
//
// Locks in three behaviors:
//   1. Security headers are attached on every response.
//   2. The auth gate is bypassed when LANAE_REQUIRE_AUTH !== 'true' so
//      turning the gate on is a deliberate operator action.
//   3. When the gate is on, public paths still pass; API requests
//      without auth get a 401 JSON; HTML requests without auth get
//      redirected to /login?next=.
//
// These tests construct a NextRequest directly rather than booting the
// Next runtime. That keeps them fast and independent of the server.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

const ORIGINAL_ENV = process.env.LANAE_REQUIRE_AUTH

function makeRequest(
  path: string,
  init: { headers?: Record<string, string>; cookies?: Record<string, string> } = {},
): NextRequest {
  const url = new URL(`http://localhost:3005${path}`)
  const headers = new Headers(init.headers ?? {})
  const req = new NextRequest(url, { headers })
  for (const [name, value] of Object.entries(init.cookies ?? {})) {
    req.cookies.set(name, value)
  }
  return req
}

beforeEach(() => {
  delete process.env.LANAE_REQUIRE_AUTH
})

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.LANAE_REQUIRE_AUTH
  } else {
    process.env.LANAE_REQUIRE_AUTH = ORIGINAL_ENV
  }
})

describe('middleware: security headers', () => {
  const EXPECTED: Array<[string, string | RegExp]> = [
    ['Strict-Transport-Security', /max-age=\d+;.*includeSubDomains.*preload/i],
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', /interest-cohort=\(\)/],
    ['Content-Security-Policy', /default-src 'self'/],
    ['Content-Security-Policy', /frame-ancestors 'none'/],
    ['Content-Security-Policy', /connect-src [^;]*api\.anthropic\.com/],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
  ]

  it('sets every required header on a plain request', () => {
    const res = middleware(makeRequest('/'))
    for (const [name, matcher] of EXPECTED) {
      const actual = res.headers.get(name)
      expect(actual, `${name} missing`).toBeTruthy()
      if (matcher instanceof RegExp) {
        expect(actual!, `${name} value: ${actual}`).toMatch(matcher)
      } else {
        expect(actual).toBe(matcher)
      }
    }
  })

  it('sets headers on an unauthenticated 401 response too', () => {
    process.env.LANAE_REQUIRE_AUTH = 'true'
    const res = middleware(makeRequest('/api/medications/today'))
    expect(res.status).toBe(401)
    expect(res.headers.get('Strict-Transport-Security')).toBeTruthy()
    expect(res.headers.get('Content-Security-Policy')).toMatch(/default-src/)
  })
})

describe('middleware: auth gate', () => {
  it('is off by default: no cookie, no auth env, request passes', () => {
    const res = middleware(makeRequest('/api/medications/today'))
    // 200-series passthrough means NextResponse.next() which does not
    // set a status; the Response object is treated as 200 by default.
    expect(res.status).toBe(200)
  })

  it('allows public paths even with the gate on', () => {
    process.env.LANAE_REQUIRE_AUTH = 'true'
    for (const path of [
      '/',
      '/api/health',
      '/api/integrations/oura/callback',
      '/api/oura/callback',
      '/login',
      '/share/abc123',
      '/manifest.json',
      '/favicon.ico',
    ]) {
      const res = middleware(makeRequest(path))
      expect(res.status, `path=${path}`).toBe(200)
    }
  })

  it('with gate on, an unauthenticated API request returns 401 JSON', async () => {
    process.env.LANAE_REQUIRE_AUTH = 'true'
    const res = middleware(makeRequest('/api/symptoms/quick-log'))
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
  })

  it('with gate on, an unauthenticated HTML request redirects to /login', () => {
    process.env.LANAE_REQUIRE_AUTH = 'true'
    const res = middleware(
      makeRequest('/today', { headers: { accept: 'text/html' } }),
    )
    expect(res.status).toBe(307) // default NextResponse.redirect
    const location = res.headers.get('location') ?? ''
    expect(location).toMatch(/\/login\?next=%2Ftoday/)
  })

  it('with gate on, a Supabase auth cookie lets the request through', () => {
    process.env.LANAE_REQUIRE_AUTH = 'true'
    const res = middleware(
      makeRequest('/api/symptoms/quick-log', {
        cookies: { 'sb-abc-auth-token': 'whatever' },
      }),
    )
    expect(res.status).toBe(200)
  })

  it('with gate on, a bearer Authorization header lets the request through', () => {
    process.env.LANAE_REQUIRE_AUTH = 'true'
    const res = middleware(
      makeRequest('/api/health-sync', {
        headers: { authorization: 'Bearer some-shortcut-token' },
      }),
    )
    expect(res.status).toBe(200)
  })

  it('with gate on, the x-vercel-cron header lets the request through', () => {
    process.env.LANAE_REQUIRE_AUTH = 'true'
    const res = middleware(
      makeRequest('/api/sync', { headers: { 'x-vercel-cron': '1' } }),
    )
    expect(res.status).toBe(200)
  })
})
