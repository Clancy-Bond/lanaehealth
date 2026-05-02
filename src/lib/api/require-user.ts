// Per-route auth helper (Track D placeholder for sweep 2026-04-19).
//
// Track A's `requireUser()` in `src/lib/auth/require-user.ts` is the
// canonical implementation that resolves the Supabase user from the
// session cookie. Until that ships, this placeholder enforces the same
// invariants the middleware enforces at the edge: a Supabase auth
// cookie OR a matching APP_ACCESS_TOKEN bearer. Defense in depth: if
// the matcher ever misses a route, the route handler still fails 401
// rather than falling through to service-role data access.
//
// Cross-track note: when Track A's helper lands, this file's calls
// should be replaced with `import { requireUser } from '@/lib/auth/require-user'`.

import { NextResponse } from 'next/server'

export interface AuthedUser {
  id: string
}

export class UnauthorizedError extends Error {
  constructor(message = 'unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

const SUPABASE_AUTH_COOKIE_RE = /(?:^|;\s*)(sb-[a-zA-Z0-9-]+-auth-token(?:\.\d+)?)=/

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let acc = 0
  for (let i = 0; i < a.length; i++) {
    acc |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return acc === 0
}

function hasSupabaseAuthCookie(req: Request): boolean {
  const cookieHeader = req.headers.get('cookie')
  if (!cookieHeader) return false
  return SUPABASE_AUTH_COOKIE_RE.test(cookieHeader)
}

function hasValidBearerToken(req: Request): boolean {
  const expected = process.env.APP_ACCESS_TOKEN
  if (!expected) return false
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header || !header.startsWith('Bearer ')) return false
  return constantTimeEquals(header.slice('Bearer '.length).trim(), expected)
}

/**
 * Throw UnauthorizedError if the request is not authenticated. Returns
 * the resolved user. Single-patient app for now: every authed request
 * is Lanae. Track A will replace this with a real session resolver.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  if (process.env.LANAEHEALTH_AUTH_DISABLED === '1') {
    return { id: 'lanae' }
  }
  if (hasSupabaseAuthCookie(req) || hasValidBearerToken(req)) {
    return { id: 'lanae' }
  }
  throw new UnauthorizedError()
}

/** Convenience: catch UnauthorizedError and return a 401 JSON response. */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}
