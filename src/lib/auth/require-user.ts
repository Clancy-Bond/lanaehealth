// ---------------------------------------------------------------------------
// requireUser() — session gate for LanaeHealth API routes
//
// TODO(track-a): This is a STUB. Security sweep Track A owns the real
// implementation (Supabase session + middleware gate). When Track A's
// helper lands, this file moves into their scope; keep the exported
// signature identical so call sites do not change.
//
// Contract (stable):
//   const auth = await requireUser(req)
//   if (!auth.ok) return auth.response
//   const user = auth.user
//
// The stub protects every in-scope PHI route by requiring a shared
// session secret. Without a real user model the "user" is always Lanae.
//
// Accepted credentials, checked in order:
//   1. `x-lanaehealth-session` header
//   2. `Authorization: Bearer <token>` header
//   3. `lanaehealth_session` cookie
//
// The query-string `?token=` path is NOT accepted here because URL
// parameters land in server access logs, browser history, and
// Referer headers. Legacy admin-token routes that still accept `?token=`
// (export/full, share/care-card) were shipped before this helper and
// will be tightened by Track A when the middleware-level gate lands.
//
// Environment:
//   LANAEHEALTH_SESSION_TOKEN   required in production; high-entropy secret.
//   LANAEHEALTH_AUTH_BYPASS     optional dev-only escape hatch (value '1'
//                               + NODE_ENV !== 'production' allows all).
//                               Logs a warning on every request.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server'

export interface AuthenticatedUser {
  id: string
  label: string
}

export type RequireUserResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: Response }

interface HeaderLike {
  get(name: string): string | null
}

interface RequestLike {
  headers: HeaderLike
}

const COOKIE_NAME = 'lanaehealth_session'

function extractToken(req: RequestLike): string | null {
  const headerToken = req.headers.get('x-lanaehealth-session')
  if (headerToken) return headerToken.trim()

  const auth = req.headers.get('authorization')
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim())
    if (match) return match[1].trim()
  }

  const cookieHeader = req.headers.get('cookie')
  if (cookieHeader) {
    const parts = cookieHeader.split(';')
    for (const raw of parts) {
      const [name, ...rest] = raw.split('=')
      if (name && name.trim() === COOKIE_NAME && rest.length > 0) {
        return rest.join('=').trim()
      }
    }
  }

  return null
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function requireUser(req: RequestLike): Promise<RequireUserResult> {
  if (
    process.env.LANAEHEALTH_AUTH_BYPASS === '1' &&
    process.env.NODE_ENV !== 'production'
  ) {
    // Explicit dev-mode bypass. Warn so it is audible in every log line.
    console.warn('[requireUser] LANAEHEALTH_AUTH_BYPASS active; serving request without auth check.')
    return { ok: true, user: { id: 'dev-bypass', label: 'dev' } }
  }

  const expected = process.env.LANAEHEALTH_SESSION_TOKEN
  if (!expected || expected.length < 16) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'server auth is not configured' },
        { status: 500 },
      ),
    }
  }

  const provided = extractToken(req)
  if (!provided || !constantTimeEquals(provided, expected)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'unauthorized' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
      ),
    }
  }

  return { ok: true, user: { id: 'lanae', label: 'patient' } }
}
