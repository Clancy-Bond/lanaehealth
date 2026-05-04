// Regression tests for src/middleware.ts (Track D, sweep 2026-04-19).
//
// The middleware is the perimeter: every PHI-bearing route depends on
// it for auth + headers. These tests exercise each branch so a
// refactor cannot silently strip an enforcement point.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

// Importing the module evaluates `process.env.NODE_ENV` once, at the
// top, so tests reset env around every case to keep them order-safe.
import { middleware, isAuthed, buildCsp } from '../middleware'

const ORIGIN = 'https://lanaehealth.test'

function reqFor(
  pathname: string,
  init?: { headers?: Record<string, string>; cookies?: Record<string, string> },
): NextRequest {
  const headers = new Headers(init?.headers ?? { accept: 'text/html', 'user-agent': 'Mozilla/5.0' })
  if (init?.cookies) {
    const parts = Object.entries(init.cookies).map(([k, v]) => `${k}=${v}`)
    headers.set('cookie', parts.join('; '))
  }
  return new NextRequest(new URL(pathname, ORIGIN), { headers })
}

const ENV_KEYS = [
  'LANAEHEALTH_AUTH_DISABLED',
  'APP_ACCESS_TOKEN',
  'LANAEHEALTH_CSP_DISABLED',
  'LANAEHEALTH_CSP_REPORT_ONLY',
] as const

let savedEnv: Record<string, string | undefined>

beforeEach(() => {
  savedEnv = {}
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
})

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

describe('middleware auth gate', () => {
  it('blocks unauthenticated calls to a PHI-bearing API route with 401', () => {
    const res = middleware(reqFor('/api/symptoms/quick-log'))
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('blocks unauthenticated page navigation with 401', () => {
    const res = middleware(reqFor('/calories'))
    expect(res.status).toBe(401)
  })

  it('returns 404 (not 401) for scraper-shaped requests so we do not leak path existence', () => {
    const res = middleware(
      new NextRequest(new URL('/api/symptoms/quick-log', ORIGIN), {
        headers: new Headers({ 'user-agent': 'curl/8.0' }),
      }),
    )
    expect(res.status).toBe(404)
  })

  it('allowlists /api/health', () => {
    const res = middleware(reqFor('/api/health'))
    expect(res.status).toBe(200)
  })

  it('allowlists OAuth callbacks (oura)', () => {
    const res = middleware(reqFor('/api/oura/callback?code=abc'))
    expect(res.status).toBe(200)
  })

  it('allowlists generic integration callbacks', () => {
    const res = middleware(reqFor('/api/integrations/dexcom/callback?code=abc'))
    expect(res.status).toBe(200)
  })

  it('allowlists Vercel cron paths (CRON_SECRET enforces, not middleware)', () => {
    expect(middleware(reqFor('/api/sync')).status).toBe(200)
    expect(middleware(reqFor('/api/cron/doctor-prep')).status).toBe(200)
    expect(middleware(reqFor('/api/push/send')).status).toBe(200)
  })

  it('allowlists the public share viewer (URL token IS the auth)', () => {
    expect(middleware(reqFor('/share/abc123')).status).toBe(200)
  })

  it('does NOT allowlist /api/share/* (the mint endpoint requires auth)', () => {
    expect(middleware(reqFor('/api/share/care-card')).status).toBe(401)
  })

  it('does NOT allowlist /raw/* (committed DICOM imaging — D-020)', () => {
    expect(middleware(reqFor('/raw/manifest.json')).status).toBe(401)
    expect(middleware(reqFor('/raw/axial_brain_5mm/0000.raw')).status).toBe(401)
  })

  it('normalizes trailing slash for allowlist matching', () => {
    // /api/health and /api/health/ should both pass through; previously
    // the trailing-slash variant 401'd because Next runs middleware
    // before its 308 normalization.
    expect(middleware(reqFor('/api/health')).status).toBe(200)
    expect(middleware(reqFor('/api/health/')).status).toBe(200)
  })

  it('allowlists static PWA assets', () => {
    expect(middleware(reqFor('/favicon.ico')).status).toBe(200)
    expect(middleware(reqFor('/manifest.json')).status).toBe(200)
    expect(middleware(reqFor('/sw.js')).status).toBe(200)
  })

  it('admits a request carrying a Supabase auth-token cookie', () => {
    const res = middleware(
      reqFor('/api/symptoms/quick-log', {
        cookies: { 'sb-abcdef-auth-token': 'eyJhbGciOi...payload' },
      }),
    )
    expect(res.status).toBe(200)
  })

  it('admits a request carrying a chunked Supabase auth-token cookie', () => {
    const res = middleware(
      reqFor('/api/symptoms/quick-log', {
        cookies: { 'sb-abcdef-auth-token.0': 'first-half', 'sb-abcdef-auth-token.1': 'second-half' },
      }),
    )
    expect(res.status).toBe(200)
  })

  it('admits a request carrying a valid bearer token', () => {
    process.env.APP_ACCESS_TOKEN = 'shared-secret-1234567890'
    const res = middleware(
      reqFor('/api/symptoms/quick-log', {
        headers: { authorization: 'Bearer shared-secret-1234567890', accept: 'application/json', 'user-agent': 'Mozilla/5.0' },
      }),
    )
    expect(res.status).toBe(200)
  })

  it('rejects a request with the wrong bearer token', () => {
    process.env.APP_ACCESS_TOKEN = 'shared-secret-1234567890'
    const res = middleware(
      reqFor('/api/symptoms/quick-log', {
        headers: { authorization: 'Bearer wrong', accept: 'application/json', 'user-agent': 'Mozilla/5.0' },
      }),
    )
    expect(res.status).toBe(401)
  })

  it('LANAEHEALTH_AUTH_DISABLED=1 is a transition bypass that lets traffic through with a marker header', () => {
    process.env.LANAEHEALTH_AUTH_DISABLED = '1'
    const res = middleware(reqFor('/api/symptoms/quick-log'))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Lanae-Auth-Bypass')).toBe('1')
  })
})

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

describe('middleware security headers', () => {
  function authedReq(path: string): NextRequest {
    return reqFor(path, { cookies: { 'sb-abc-auth-token': 'token' } })
  }

  it('attaches HSTS, XCTO, XFO, Referrer-Policy, Permissions-Policy on a passing request', () => {
    const res = middleware(authedReq('/api/symptoms/quick-log'))
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=63072000')
    expect(res.headers.get('Strict-Transport-Security')).toContain('includeSubDomains')
    expect(res.headers.get('Strict-Transport-Security')).toContain('preload')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    const perms = res.headers.get('Permissions-Policy') ?? ''
    expect(perms).toContain('interest-cohort=()')
    expect(perms).toContain('camera=(self)')
  })

  it('attaches headers on 401 responses too (no header gap on errors)', () => {
    const res = middleware(reqFor('/api/symptoms/quick-log'))
    expect(res.status).toBe(401)
    expect(res.headers.get('Strict-Transport-Security')).toBeTruthy()
    expect(res.headers.get('Content-Security-Policy')).toBeTruthy()
  })

  it('emits a CSP with a per-request nonce', () => {
    const a = middleware(authedReq('/api/health'))
    const b = middleware(authedReq('/api/health'))
    const cspA = a.headers.get('Content-Security-Policy') ?? ''
    const cspB = b.headers.get('Content-Security-Policy') ?? ''
    expect(cspA).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)
    expect(cspB).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)
    expect(cspA).not.toBe(cspB)
  })

  it('CSP locks down the dangerous defaults', () => {
    const csp = buildCsp('TESTNONCE', false)
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    // No unsafe-eval in production.
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('CSP allows Supabase, Anthropic, OpenAI, Voyage, Oura, weather, USDA, OpenFoodFacts', () => {
    const csp = buildCsp('TESTNONCE', false)
    expect(csp).toContain('https://*.supabase.co')
    expect(csp).toContain('https://api.anthropic.com')
    expect(csp).toContain('https://api.openai.com')
    expect(csp).toContain('https://api.voyageai.com')
    expect(csp).toContain('https://api.ouraring.com')
    expect(csp).toContain('https://api.open-meteo.com')
    expect(csp).toContain('https://api.nal.usda.gov')
    expect(csp).toContain('https://world.openfoodfacts.org')
  })
})

// ---------------------------------------------------------------------------
// CSRF (Origin / Referer)
// ---------------------------------------------------------------------------

describe('middleware CSRF defense', () => {
  function authedReq(method: string, init?: { origin?: string | null; referer?: string | null }): NextRequest {
    const headers = new Headers({
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
      cookie: 'sb-abc-auth-token=token',
    })
    if (init?.origin === undefined) headers.set('origin', ORIGIN)
    else if (init.origin !== null) headers.set('origin', init.origin)
    if (init?.referer !== undefined && init.referer !== null) {
      headers.set('referer', init.referer)
    }
    return new NextRequest(new URL('/api/symptoms/quick-log', ORIGIN), { method, headers })
  }

  it('admits same-origin POST', () => {
    const res = middleware(authedReq('POST'))
    expect(res.status).toBe(200)
  })

  it('rejects cross-origin POST with 403', () => {
    const res = middleware(authedReq('POST', { origin: 'https://attacker.example' }))
    expect(res.status).toBe(403)
  })

  it('rejects POST with no Origin and no Referer', () => {
    const res = middleware(authedReq('POST', { origin: null }))
    expect(res.status).toBe(403)
  })

  it('admits POST with no Origin but a same-origin Referer', () => {
    const res = middleware(authedReq('POST', { origin: null, referer: `${ORIGIN}/log` }))
    expect(res.status).toBe(200)
  })

  it('rejects POST with no Origin and a cross-origin Referer', () => {
    const res = middleware(authedReq('POST', { origin: null, referer: 'https://attacker.example/x' }))
    expect(res.status).toBe(403)
  })

  it('does not enforce CSRF on GET (read-only)', () => {
    const headers = new Headers({
      accept: 'text/html',
      'user-agent': 'Mozilla/5.0',
      cookie: 'sb-abc-auth-token=token',
      origin: 'https://attacker.example',
    })
    const res = middleware(new NextRequest(new URL('/api/symptoms/quick-log', ORIGIN), { method: 'GET', headers }))
    expect(res.status).toBe(200)
  })

  it('does not enforce CSRF on allowlisted /api/health POST (cron / external)', () => {
    const headers = new Headers({
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
      origin: 'https://attacker.example',
    })
    const res = middleware(new NextRequest(new URL('/api/health', ORIGIN), { method: 'POST', headers }))
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Cache-Control + extra headers
// ---------------------------------------------------------------------------

describe('middleware response hygiene', () => {
  function authedReq(path: string): NextRequest {
    return reqFor(path, { cookies: { 'sb-abc-auth-token': 'token' } })
  }

  it('attaches Cache-Control: no-store on PHI responses', () => {
    const res = middleware(authedReq('/api/symptoms/quick-log'))
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0')
  })

  it('does NOT attach Cache-Control: no-store to PWA static assets (sw.js, manifest, icons)', () => {
    for (const p of ['/sw.js', '/manifest.json', '/favicon.ico', '/icon.svg']) {
      const res = middleware(reqFor(p))
      expect(res.headers.get('Cache-Control')).toBeNull()
      // But security headers must still be attached.
      expect(res.headers.get('Strict-Transport-Security')).toBeTruthy()
    }
  })

  it('locks down extra Permissions-Policy directives (payment, usb, serial, bluetooth)', () => {
    const res = middleware(authedReq('/api/health'))
    const perms = res.headers.get('Permissions-Policy') ?? ''
    expect(perms).toContain('payment=()')
    expect(perms).toContain('usb=()')
    expect(perms).toContain('serial=()')
    expect(perms).toContain('bluetooth=()')
  })

  it('attaches Cross-Origin-Resource-Policy: same-origin', () => {
    const res = middleware(authedReq('/api/health'))
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin')
  })

  it('LANAEHEALTH_CSP_DISABLED=1 strips CSP entirely (rollback)', () => {
    process.env.LANAEHEALTH_CSP_DISABLED = '1'
    const res = middleware(authedReq('/api/health'))
    expect(res.headers.get('Content-Security-Policy')).toBeNull()
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeNull()
    // Other headers must still ship.
    expect(res.headers.get('Strict-Transport-Security')).toBeTruthy()
  })

  it('LANAEHEALTH_CSP_REPORT_ONLY=1 sends Report-Only header (monitor mode)', () => {
    process.env.LANAEHEALTH_CSP_REPORT_ONLY = '1'
    const res = middleware(authedReq('/api/health'))
    expect(res.headers.get('Content-Security-Policy')).toBeNull()
    expect(res.headers.get('Content-Security-Policy-Report-Only')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// isAuthed direct unit coverage (exercises the cookie name pattern)
// ---------------------------------------------------------------------------

describe('isAuthed', () => {
  it('rejects a cookie that merely starts with sb-', () => {
    expect(isAuthed(reqFor('/api/x', { cookies: { 'sb-something-else': 'v' } }))).toBe(false)
  })
  it('rejects an empty auth-token cookie', () => {
    expect(isAuthed(reqFor('/api/x', { cookies: { 'sb-abc-auth-token': '' } }))).toBe(false)
  })
  it('accepts the canonical auth-token cookie', () => {
    expect(isAuthed(reqFor('/api/x', { cookies: { 'sb-abc-auth-token': 'val' } }))).toBe(true)
  })
})
