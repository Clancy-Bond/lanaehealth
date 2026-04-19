/**
 * POST /api/auth/logout
 *
 * Clears the session cookie. Safe to call unauthenticated.
 */

import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return res
}
