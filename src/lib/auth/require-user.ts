/**
 * Shared auth primitive for LanaeHealth.
 *
 * Decision doc: docs/security/2026-04-19-sweep/adr-auth-model.md
 *
 * Single-patient app: one shared secret (APP_AUTH_TOKEN) accepted
 * through either an Authorization: Bearer header (for the iOS
 * Shortcut, CLI, cron tooling) or an HttpOnly session cookie set by
 * POST /api/auth/login.
 *
 * Constant-time comparison via crypto.timingSafeEqual. A fail-closed
 * default: if APP_AUTH_TOKEN is unset in the environment, every
 * request is rejected.
 */

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

const DEFAULT_COOKIE_NAME = 'lh_session'

export const SESSION_COOKIE_NAME =
  process.env.APP_SESSION_COOKIE_NAME ?? DEFAULT_COOKIE_NAME

/**
 * Constant-time string comparison. Returns false if either input is
 * empty or if lengths differ.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  const aBuf = Buffer.from(a, 'utf8')
  const bBuf = Buffer.from(b, 'utf8')
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

function readSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? ''
  if (!cookieHeader) return null
  const target = SESSION_COOKIE_NAME
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const name = trimmed.slice(0, eq)
    if (name === target) {
      return decodeURIComponent(trimmed.slice(eq + 1))
    }
  }
  return null
}

export interface AuthOk {
  ok: true
  via: 'bearer' | 'cookie'
}

export interface AuthFail {
  ok: false
  response: Response
}

export type AuthResult = AuthOk | AuthFail

/**
 * Check whether the incoming request carries a valid credential.
 * Returns a discriminated union. On failure the caller should return
 * the attached 401 Response unchanged.
 *
 * Local-dev escape hatch: when LANAE_REQUIRE_AUTH=false (the same flag
 * the perimeter middleware honors) AND we are not in production, this
 * function passes the request through. This mirrors the middleware
 * bypass so a single flag toggles the entire stack and Playwright
 * suites do not see spurious 500s from "APP_AUTH_TOKEN not set".
 * Production never honors the bypass.
 */
export function checkAuth(req: Request): AuthResult {
  if (
    process.env.LANAE_REQUIRE_AUTH === 'false' &&
    process.env.NODE_ENV !== 'production'
  ) {
    return { ok: true, via: 'cookie' }
  }
  const expected = process.env.APP_AUTH_TOKEN
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'server misconfigured: APP_AUTH_TOKEN not set' },
        { status: 500 },
      ),
    }
  }

  const bearer = readBearerToken(req)
  if (bearer && constantTimeEqual(bearer, expected)) {
    return { ok: true, via: 'bearer' }
  }

  const cookie = readSessionCookie(req)
  if (cookie && constantTimeEqual(cookie, expected)) {
    return { ok: true, via: 'cookie' }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
  }
}

/**
 * Ergonomic wrapper for API route handlers.
 *
 *   export async function GET(req: Request) {
 *     const gate = requireAuth(req)
 *     if (!gate.ok) return gate.response
 *     // ...authenticated logic
 *   }
 *
 * Track B/C/D route handlers should use this.
 */
export function requireAuth(req: Request): AuthResult {
  return checkAuth(req)
}

/**
 * Convenience for a simple `if (!isAuthed(req)) return 401` pattern
 * used by the Next.js middleware (Track D).
 */
export function isAuthed(req: Request): boolean {
  return checkAuth(req).ok
}
