// Perimeter middleware for LanaeHealth.
//
// Two jobs:
//   1. Attach security headers to every response (HSTS, CSP, frame-options,
//      referrer/permissions policies, nosniff).
//   2. Gate access to non-public routes with a lightweight auth check.
//
// The auth check here is intentionally minimal. Track A owns the full
// `requireUser()` helper and the sign-in surface; this middleware just asks
// the coarse question "is there anything that looks like a session on this
// request?" so that an unauthenticated scrape of production doesn't hit PHI.
// Per-route authorization stays at the route handler.
//
// Because Track A's login flow is not yet merged, the auth gate defaults to
// OFF. Set LANAE_REQUIRE_AUTH=true (server env) to turn it on. Header
// attachment always runs.

import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES: readonly string[] = [
  // Public-by-design pages.
  '/login',
  '/share', // one-time share token viewer pages at /share/<token>
  // Stateless callbacks and webhooks.
  '/api/integrations', // /api/integrations/[id]/callback
  '/api/oura/callback',
  // Ops probes.
  '/api/health',
  // PWA / browser requirements.
  '/manifest.json',
  '/favicon.ico',
  '/sw.js',
  '/robots.txt',
]

// Paths that never require auth regardless of method (e.g., static chunks).
const ALWAYS_PUBLIC_PREFIXES: readonly string[] = [
  '/_next/static/',
  '/_next/image',
  '/_next/data/',
  '/icons/',
]

const CSP_DIRECTIVES: string = [
  "default-src 'self'",
  // Next.js 16 ships inline runtime bootstrap and uses eval in dev HMR.
  // `'unsafe-inline'` stays for now; tightening to nonces is a P2 follow-up
  // tracked in findings-track-d.md. `strict-dynamic` is NOT enabled because
  // it would require nonce wiring on every inline script.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://api.ouraring.com https://cloud.ouraring.com",
  "font-src 'self' data:",
  [
    'connect-src',
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.anthropic.com',
    'https://api.openai.com',
    'https://api.voyageai.com',
    'https://api.ouraring.com',
    'https://api.open-meteo.com',
    'https://api.nal.usda.gov',
    'https://world.openfoodfacts.org',
    // Sentry error ingestion. *.ingest.sentry.io covers org-specific
    // ingest subdomains (e.g. o12345.ingest.us.sentry.io).
    'https://*.ingest.sentry.io',
    'https://*.ingest.us.sentry.io',
    'https://*.ingest.de.sentry.io',
  ].join(' '),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ')

const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(self), microphone=(self), geolocation=(self), interest-cohort=()',
  'Content-Security-Policy': CSP_DIRECTIVES,
  'Cross-Origin-Opener-Policy': 'same-origin',
}

function applySecurityHeaders(resp: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    resp.headers.set(name, value)
  }
  return resp
}

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true // landing page
  for (const prefix of ALWAYS_PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true
  }
  for (const p of PUBLIC_ROUTES) {
    if (pathname === p) return true
    if (pathname.startsWith(p + '/')) return true
  }
  return false
}

// Cron and other service-to-service endpoints carry their own secret
// (CRON_SECRET bearer, HEALTH_SYNC_TOKEN bearer). Let them through the
// middleware gate; the route handler validates the secret. This keeps
// Vercel crons working once middleware auth is enabled.
function hasServiceAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Bearer ')) return true
  // Vercel sets this header on cron invocations.
  if (req.headers.get('x-vercel-cron') === '1') return true
  return false
}

function looksAuthed(req: NextRequest): boolean {
  // Accept Track A's session cookie (default `lh_session`, overridable
  // via APP_SESSION_COOKIE_NAME), the legacy `lanae_session` name, and
  // any Supabase auth cookie. Middleware only checks presence; per-
  // route `requireAuth()` validates the token value.
  const trackASessionName = process.env.APP_SESSION_COOKIE_NAME ?? 'lh_session'
  for (const c of req.cookies.getAll()) {
    if (c.name === trackASessionName && c.value) return true
    if (c.name === 'lanae_session' && c.value) return true
    if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) return true
  }
  return false
}

function isAuthEnabled(): boolean {
  return process.env.LANAE_REQUIRE_AUTH === 'true'
}

function unauthorizedResponse(req: NextRequest): NextResponse {
  const wantsHtml = (req.headers.get('accept') ?? '').includes('text/html')
  if (wantsHtml) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!isAuthEnabled() || isPublicPath(pathname) || hasServiceAuth(req) || looksAuthed(req)) {
    return applySecurityHeaders(NextResponse.next())
  }

  return applySecurityHeaders(unauthorizedResponse(req))
}

// Exclude static assets at the matcher level so middleware does not waste
// cycles on every chunk fetch. Auth logic still short-circuits on public
// paths but the matcher is the first line of defense.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|sw.js|manifest.json|icons/).*)',
  ],
}
