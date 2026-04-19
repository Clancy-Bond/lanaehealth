/**
 * POST /api/auth/login
 *
 * Browser login flow. Accepts { password } and, on match, sets the
 * session cookie to APP_AUTH_TOKEN so subsequent requests pass the
 * shared-secret auth check.
 *
 * Decision doc: docs/security/2026-04-19-sweep/adr-auth-model.md
 */

import { NextResponse } from 'next/server'
import { constantTimeEqual, SESSION_COOKIE_NAME } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string }
  const provided = typeof body.password === 'string' ? body.password : ''

  const expectedPassword = process.env.APP_AUTH_PASSWORD
  const token = process.env.APP_AUTH_TOKEN

  if (!expectedPassword || !token) {
    return NextResponse.json(
      { error: 'server misconfigured: APP_AUTH_PASSWORD or APP_AUTH_TOKEN not set' },
      { status: 500 },
    )
  }

  if (!constantTimeEqual(provided, expectedPassword)) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
  })
  return res
}
