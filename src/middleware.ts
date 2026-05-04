// LanaeHealth perimeter middleware (Track D, sweep 2026-04-19).
//
// Three responsibilities:
//   1. Auth gate. Block unauthenticated requests to PHI-bearing routes.
//      Allowlist covers OAuth callbacks, Vercel cron paths (which carry
//      their own CRON_SECRET check), the public share viewer, the
//      health endpoint, and Next.js / PWA static assets.
//   2. Security headers. Attach HSTS, CSP (with per-request nonce),
//      X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and
//      Permissions-Policy to every response.
//   3. Lightweight bot defense. Reject obvious scraper requests (no
//      Accept header) on PHI-bearing paths so the auth check is the
//      only thing logging them.
//
// Auth check is intentionally local until Track A ships the canonical
// requireUser() helper. When that lands, swap the body of isAuthed().

import { NextResponse, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Allowlist: paths the middleware lets through without an auth token.
// ---------------------------------------------------------------------------

const ALLOWLIST_EXACT = new Set<string>([
  '/api/health',
  '/api/oura/callback',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/icon.svg',
  '/file.svg',
  '/globe.svg',
  '/next.svg',
  '/window.svg',
  '/vercel.svg',
])

const ALLOWLIST_PREFIX: readonly string[] = [
  '/_next/',
  '/raw/', // committed DICOM raw data shipped with the build
  '/share/', // public share viewer; the URL token is the auth
  // NOTE: /api/share/* is intentionally NOT allowlisted. The mint
  // endpoint (POST /api/share/care-card) requires auth. Token-protected
  // public read endpoints, if added later, should live under a separate
  // path like /api/public-share/ so the auth boundary stays clear.
]

// Vercel cron entries from vercel.json. These are POSTed by Vercel's
// scheduler with a CRON_SECRET header (Track C enforces). Middleware
// must not block them.
const CRON_PATHS = new Set<string>([
  '/api/sync',
  '/api/weather',
  '/api/push/send',
  '/api/cron/doctor-prep',
  '/api/cron/build-status',
])

// OAuth callbacks land at /api/integrations/<id>/callback.
const INTEGRATION_CALLBACK_RE = /^\/api\/integrations\/[^/]+\/callback$/

function isAllowlisted(pathname: string): boolean {
  if (ALLOWLIST_EXACT.has(pathname)) return true
  if (CRON_PATHS.has(pathname)) return true
  if (INTEGRATION_CALLBACK_RE.test(pathname)) return true
  for (const prefix of ALLOWLIST_PREFIX) {
    if (pathname.startsWith(prefix)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Auth check. Replace with Track A's helper once it ships.
// ---------------------------------------------------------------------------

const SUPABASE_AUTH_COOKIE_RE = /^sb-[a-zA-Z0-9-]+-auth-token(\.\d+)?$/

function hasSupabaseAuthCookie(req: NextRequest): boolean {
  for (const cookie of req.cookies.getAll()) {
    if (SUPABASE_AUTH_COOKIE_RE.test(cookie.name) && cookie.value.length > 0) {
      return true
    }
  }
  return false
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let acc = 0
  for (let i = 0; i < a.length; i++) {
    acc |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return acc === 0
}

function hasValidBearerToken(req: NextRequest): boolean {
  const expected = process.env.APP_ACCESS_TOKEN
  if (!expected) return false
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) return false
  const presented = header.slice('Bearer '.length).trim()
  return constantTimeEquals(presented, expected)
}

export function isAuthed(req: NextRequest): boolean {
  // Transition switch: when set, the middleware logs an explicit bypass
  // header instead of enforcing. This exists so the live deployment can
  // ship middleware without immediately locking Lanae out before Track A's
  // sign-in flow is wired through. Production must NOT keep this set.
  if (process.env.LANAEHEALTH_AUTH_DISABLED === '1') return true
  return hasSupabaseAuthCookie(req) || hasValidBearerToken(req)
}

// ---------------------------------------------------------------------------
// Security headers.
// ---------------------------------------------------------------------------

const STATIC_HEADERS: Readonly<Record<string, string>> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(self), microphone=(self), geolocation=(self), interest-cohort=(), payment=(), usb=(), serial=(), bluetooth=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  // PHI responses must not be cached by intermediaries / browser back-fwd.
  // /_next/static/ paths are excluded by the matcher, so this Cache-Control
  // never lands on hashed asset bundles.
  'Cache-Control': 'no-store, max-age=0',
}

function generateNonce(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  let s = ''
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i])
  // Use base64 (not base64url) so the nonce parses cleanly in CSP.
  return btoa(s)
}

export function buildCsp(nonce: string, isDev: boolean): string {
  // strict-dynamic lets Next.js's framework chunks load without listing every
  // hash. unsafe-eval is added in dev to keep React fast-refresh / source maps
  // working; production stays strict.
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`
  const directives: string[] = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Tailwind / inline style attributes from the app rely on inline styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://api.ouraring.com",
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      'https://*.supabase.co',
      'https://api.anthropic.com',
      'https://api.openai.com',
      'https://api.voyageai.com',
      'https://api.ouraring.com',
      'https://api.open-meteo.com',
      'https://api.nal.usda.gov',
      'https://world.openfoodfacts.org',
      'https://eutils.ncbi.nlm.nih.gov',
    ].join(' '),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ]
  return directives.join('; ')
}

function attachSecurityHeaders(res: NextResponse, nonce: string): void {
  for (const [name, value] of Object.entries(STATIC_HEADERS)) {
    res.headers.set(name, value)
  }
  // CSP rollback flags: in case `'strict-dynamic'` blocks a Next.js 16
  // framework chunk we did not anticipate, ops can downgrade to
  // Report-Only or disable entirely without a code revert.
  if (process.env.LANAEHEALTH_CSP_DISABLED === '1') return
  const csp = buildCsp(nonce, process.env.NODE_ENV !== 'production')
  const headerName =
    process.env.LANAEHEALTH_CSP_REPORT_ONLY === '1'
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy'
  res.headers.set(headerName, csp)
}

// ---------------------------------------------------------------------------
// CSRF defense (Origin / Referer check on state-changing methods).
//
// Browsers send `Origin` automatically on cross-origin POST / PATCH / PUT /
// DELETE; same-site `SameSite=Lax` cookies attach but attackers cannot
// forge `Origin`. Asserting Origin matches the request host on mutating
// methods is a cheap, strong CSRF defense for endpoints that rely on
// cookie auth.
// ---------------------------------------------------------------------------

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

function failsCsrfCheck(req: NextRequest): boolean {
  if (!MUTATING_METHODS.has(req.method)) return false
  const origin = req.headers.get('origin')
  // Allow missing Origin (e.g. Vercel cron, server-to-server) when the
  // path is in the cron / OAuth allowlist. Those paths bypass middleware
  // entirely upstream of this check; see isAllowlisted().
  if (!origin) {
    // No Origin and not allowlisted: be strict for mutating methods.
    // Fall back to Referer same-origin check before failing.
    const referer = req.headers.get('referer')
    if (!referer) return true
    try {
      const refUrl = new URL(referer)
      return refUrl.host !== req.nextUrl.host
    } catch {
      return true
    }
  }
  try {
    const originUrl = new URL(origin)
    return originUrl.host !== req.nextUrl.host
  } catch {
    return true
  }
}

// ---------------------------------------------------------------------------
// Bot defense. Light, only for PHI-bearing paths.
// ---------------------------------------------------------------------------

const BOT_UA_RE = /(curl|wget|python-requests|libwww|httpie|scrapy|bot\b|spider)/i

function looksLikeScraper(req: NextRequest): boolean {
  const accept = req.headers.get('accept')
  // Browsers always send Accept; tools like raw `curl` do not.
  if (!accept) return true
  const ua = req.headers.get('user-agent') ?? ''
  if (!ua) return true
  return BOT_UA_RE.test(ua)
}

// ---------------------------------------------------------------------------
// Middleware entry point.
// ---------------------------------------------------------------------------

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl
  const allowlisted = isAllowlisted(pathname)
  const nonce = generateNonce()

  // Cross-origin mutating requests on non-allowlisted paths are rejected
  // independently of auth so a leaked / stolen cookie cannot be wielded
  // from an attacker page. OAuth callbacks land via 302 redirect (no
  // Origin) and are allowlisted — they bypass this check.
  if (!allowlisted && failsCsrfCheck(req)) {
    const res = NextResponse.json({ error: 'forbidden' }, { status: 403 })
    attachSecurityHeaders(res, nonce)
    return res
  }

  if (!allowlisted && !isAuthed(req)) {
    if (looksLikeScraper(req)) {
      // Don't even leak which paths exist.
      const res = new NextResponse('not found', {
        status: 404,
        headers: { 'content-type': 'text/plain' },
      })
      attachSecurityHeaders(res, nonce)
      return res
    }
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
      attachSecurityHeaders(res, nonce)
      return res
    }
    // For pages, send the user toward sign-in once it exists. Until then
    // a 401 is the safest visible failure mode.
    const res = new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'content-type': 'text/plain' },
    })
    attachSecurityHeaders(res, nonce)
    return res
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  attachSecurityHeaders(res, nonce)

  if (process.env.LANAEHEALTH_AUTH_DISABLED === '1' && !allowlisted) {
    res.headers.set('X-Lanae-Auth-Bypass', '1')
  }
  return res
}

// Run on every request EXCEPT immutable Next.js asset files (which are
// served straight off the CDN and don't need per-request headers).
export const config = {
  matcher: ['/((?!_next/static/|_next/image/).*)'],
}
