/**
 * POST /api/auth/passkey/authenticate
 *
 * Two-phase WebAuthn authentication. The user is anonymous at the
 * start of phase=options (we just need to give the browser a
 * challenge). Phase=verify finds the credential, verifies the
 * assertion, and exchanges it for a Supabase session via the admin
 * generateLink('magiclink') trick: we mint a one-time link for the
 * user's email and consume it server-side so the browser ends up
 * with a real Supabase session cookie.
 *
 * The session-id used to scope the challenge is a per-request UUID
 * stored in an httpOnly cookie. This is not a real session, just a
 * way to make sure the same browser that asked for options is the
 * one that comes back to verify.
 */
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { getSupabaseServerClient } from '@/lib/auth/supabase-server'
import {
  buildAuthenticationOptions,
  getPasskeyServiceClient,
  verifyAuthentication,
} from '@/lib/auth/passkey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PASSKEY_SESSION_COOKIE = 'lh_passkey_session'

interface AuthBody {
  phase?: unknown
  challengeId?: unknown
  assertion?: unknown
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function POST(req: Request) {
  let body: AuthBody
  try {
    body = (await req.json()) as AuthBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const cookieStore = await cookies()

  if (body.phase === 'options') {
    let sessionId = cookieStore.get(PASSKEY_SESSION_COOKIE)?.value
    if (!sessionId || sessionId.length < 16) sessionId = newSessionId()
    try {
      const result = await buildAuthenticationOptions({ sessionId })
      const res = NextResponse.json({ ok: true, options: result.options, challengeId: result.challengeId })
      res.cookies.set({
        name: PASSKEY_SESSION_COOKIE,
        value: sessionId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 5 * 60,
      })
      return res
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'could not build options' },
        { status: 500 },
      )
    }
  }

  if (body.phase === 'verify') {
    const sessionId = cookieStore.get(PASSKEY_SESSION_COOKIE)?.value
    if (!sessionId) {
      return NextResponse.json({ error: 'session expired, try again' }, { status: 400 })
    }
    if (typeof body.challengeId !== 'string' || !body.assertion) {
      return NextResponse.json({ error: 'challengeId and assertion required' }, { status: 400 })
    }

    // Find the challenge id by the session id that is shared in
    // the authenticator response payload (callers send back the id
    // from phase=options).
    const result = await verifyAuthentication({
      sessionId,
      challengeId: body.challengeId,
      response: body.assertion as AuthenticationResponseJSON,
    })
    if (!result.ok || !result.userId) {
      return NextResponse.json({ error: result.error ?? 'verification failed' }, { status: 401 })
    }

    // We have a verified user. Mint a Supabase session for them.
    // We use the admin API to generate a magic link for the user's
    // email, then exchange the OTP server-side so the SSR client
    // writes the session cookie to the response.
    const admin = getPasskeyServiceClient()
    if (!result.email) {
      // Fall back to looking up the email directly.
      const { data: u } = await admin.auth.admin.getUserById(result.userId)
      result.email = u?.user?.email ?? undefined
    }
    if (!result.email) {
      return NextResponse.json(
        { error: 'this passkey is not linked to an email account' },
        { status: 400 },
      )
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: result.email,
    })
    if (linkErr || !linkData) {
      return NextResponse.json(
        { error: `could not start session: ${linkErr?.message ?? 'unknown'}` },
        { status: 500 },
      )
    }
    const otp = linkData.properties?.email_otp
    if (!otp) {
      return NextResponse.json({ error: 'session token not issued' }, { status: 500 })
    }
    const supabase = await getSupabaseServerClient()
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      email: result.email,
      token: otp,
    })
    if (verifyErr) {
      return NextResponse.json(
        { error: `could not start session: ${verifyErr.message}` },
        { status: 500 },
      )
    }

    const res = NextResponse.json({ ok: true, userId: result.userId })
    // Clear the passkey-session cookie now that we have a real session.
    res.cookies.set({
      name: PASSKEY_SESSION_COOKIE,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return res
  }

  return NextResponse.json({ error: 'unknown phase' }, { status: 400 })
}
